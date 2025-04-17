import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
// --- MongoDB/Mongoose Imports ---
import dbConnect from '@/lib/db/mongodb'; // Import the Mongoose connection function
import User from '@/lib/db/models/user'; // Import the User model using lowercase path

export const dynamic = 'force-dynamic'; // Force dynamic rendering

// Ensure secrets are defined
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set.');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
}
if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
    throw new Error('STRIPE_PREMIUM_PRICE_ID is not set.');
}
if (!process.env.STRIPE_EXPERT_PRICE_ID) {
    throw new Error('STRIPE_EXPERT_PRICE_ID is not set.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Cast API version to 'any' to bypass strict type check
  apiVersion: '2024-06-20' as any, 
  typescript: true,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Define price IDs for mapping
const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
const expertPriceId = process.env.STRIPE_EXPERT_PRICE_ID;

export async function POST(req: Request) {
  console.log("[Stripe Webhook] Received request");
  const body = await req.text(); // Need raw body for signature verification
  const signature = headers().get('Stripe-Signature') as string;

  if (!signature) {
      console.error("[Stripe Webhook] Missing Stripe-Signature header");
      return new NextResponse('Missing Stripe-Signature header', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Use the correct variable names from this scope
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret! // Non-null assertion as we checked above
    );
    console.log(`[Stripe Webhook] Verified event: ${event.id}, Type: ${event.type}`);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error verifying webhook signature: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // --- Handle the checkout.session.completed event ---
  if (event.type === 'checkout.session.completed') {
    // Cast the event data object to access the session ID
    const sessionFromEvent = event.data.object as { id: string; metadata?: { userId?: string }; customer?: string | Stripe.Customer | null; };
    const sessionId = sessionFromEvent.id;
    console.log(`[Stripe Webhook] Handling checkout.session.completed for session ID: ${sessionId}`);

    // --- Connect to DB ---
    try {
      await dbConnect(); // Ensure database connection is established
      console.log("[Stripe Webhook] Database connected.");
    } catch (dbConnError: any) {
      console.error("[Stripe Webhook] Database connection failed:", dbConnError);
      return new NextResponse('Webhook Error: Could not connect to database', { status: 500 });
    }
    // -------------------

    // --- Retrieve the session with expanded subscription ---
    let retrievedSession: Stripe.Checkout.Session;
    try {
        retrievedSession = await stripe.checkout.sessions.retrieve(
            sessionId,
            { expand: ['subscription'] } // Explicitly expand the subscription object
        );
        console.log(`[Stripe Webhook] Retrieved session ${sessionId} with expanded subscription.`);
    } catch (retrieveError: any) {
        console.error(`[Stripe Webhook] Error retrieving session ${sessionId}: ${retrieveError.message}`);
        return new NextResponse(`Webhook Error: Could not retrieve session ${sessionId}`, { status: 500 });
    }
    // ----------------------------------------------------

    // Now, access the subscription from the *retrieved* session object
    const subscription = retrievedSession.subscription;
    if (!subscription || typeof subscription === 'string') {
        // This check handles cases where expansion might fail or return only an ID (though expand should prevent this)
        console.error(`[Stripe Webhook] Subscription object not found or invalid on retrieved session ${sessionId}. Subscription: ${subscription}`);
        return new NextResponse(`Webhook Error: Missing or invalid subscription object on session ${sessionId}`, { status: 400 });
    }
    // Ensure subscription is a Stripe.Subscription object (not DeletedSubscription)
    if (subscription.object !== 'subscription') {
        console.error(`[Stripe Webhook] Retrieved subscription object is not a valid subscription: ${JSON.stringify(subscription)}`);
        return new NextResponse(`Webhook Error: Invalid subscription object type for session ${sessionId}`, { status: 400 });
    }
    console.log(`[Stripe Webhook] Successfully retrieved subscription ${subscription.id} from expanded session ${sessionId}.`);

    // Get user ID from metadata (use retrievedSession.metadata)
    const userId = retrievedSession.metadata?.userId;
    if (!userId) {
      console.error(`[Stripe Webhook] Missing userId in metadata for retrieved session: ${sessionId}`);
      return new NextResponse('Webhook Error: Missing userId in metadata', { status: 400 });
    }
    console.log(`[Stripe Webhook] User ID from metadata: ${userId}`);

    // --- Database Update Logic (using Mongoose) ---
    try {
        // Determine the plan based on the Price ID in the *retrieved* subscription
        const priceId = subscription.items.data[0]?.price.id;
        let newTier: 'premium' | 'expert' | 'free' | null = null; // Include 'free' for typing

        if (priceId === premiumPriceId) {
            newTier = 'premium';
        } else if (priceId === expertPriceId) {
            newTier = 'expert';
        } else {
             console.error(`[Stripe Webhook] Unknown priceId ${priceId} in subscription ${subscription?.id} for user ${userId}.`);
             return new NextResponse(`Webhook Error: Unknown Price ID ${priceId}`, { status: 400 });
        }
        console.log(`[Stripe Webhook] Determined tier: ${newTier} for user ${userId}`);

        // Update user record in MongoDB using Mongoose
        const updatedUser = await User.findOneAndUpdate(
          { _id: userId },
          {
            $set: {
              tier: newTier,
              stripeCustomerId: typeof retrievedSession.customer === 'string' ? retrievedSession.customer : retrievedSession.customer?.id,
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionStatus: subscription.status,
              planExpiresAt: subscription ? new Date((subscription as any)['current_period_end'] * 1000) : null,
            }
          },
          { new: true }
        );

        if (!updatedUser) {
             console.error(`[Stripe Webhook] User not found in DB for ID: ${userId}`);
             return new NextResponse(`Webhook Error: User with ID ${userId} not found`, { status: 404 });
        }

      console.log(`[Stripe Webhook] Successfully updated DB for user: ${userId}, New Tier: ${updatedUser.tier}, SubID: ${updatedUser.stripeSubscriptionId}`);

    } catch (dbError: any) {
      console.error(`[Stripe Webhook] Database update failed for user ${userId}: ${dbError.message}`);
      return new NextResponse(`Webhook Database Error: ${dbError.message}`, { status: 500 });
    }
    // --- End database update logic ---
  }
  // --- Handle other events (Optional) ---
  else if (event.type === 'customer.subscription.updated') {
    // Ensure DB connection for this event handler too
    try { await dbConnect(); } catch (e) { /* Handle error */ return new NextResponse('Webhook Error: DB connection failed', { status: 500 }); }
    console.log(`[Stripe Webhook] Received ${event.type}`);
    const subscription = event.data.object as Stripe.Subscription;

    // --- Prepare update data conditionally ---
    const updateData: Record<string, any> = {
      stripeSubscriptionStatus: subscription.status,
    };

    // Safely check and update planExpiresAt
    const currentPeriodEnd = (subscription as any)['current_period_end'];
    if (typeof currentPeriodEnd === 'number') {
      updateData.planExpiresAt = new Date(currentPeriodEnd * 1000);
      console.log(`[Stripe Webhook] Setting planExpiresAt for ${subscription.id} to ${updateData.planExpiresAt.toISOString()}`);
    } else {
      console.warn(`[Stripe Webhook] current_period_end missing or invalid for subscription ${subscription.id}. Not updating planExpiresAt.`);
      // Optionally set planExpiresAt to null if the status indicates cancellation without an end date
      if (subscription.status === 'canceled') {
          updateData.planExpiresAt = null;
      }
    }
    // --- End prepare update data ---

     try {
       await User.findOneAndUpdate(
            { stripeSubscriptionId: subscription.id },
            {
                $set: updateData // Use the prepared update data
             }
         );
         console.log(`[Stripe Webhook] Updated subscription status for ${subscription.id} to ${subscription.status}`);
     } catch(dbError: any) {
          console.error(`[Stripe Webhook] DB update failed for subscription ${subscription.id} update: ${dbError.message}`);
          return new NextResponse(`Webhook DB Error: ${dbError.message}`, { status: 500 });
     }
  }
  else if (event.type === 'customer.subscription.deleted') {
    try { await dbConnect(); } catch (e) { /* Handle error */ return new NextResponse('Webhook Error: DB connection failed', { status: 500 }); }
    console.log(`[Stripe Webhook] Received ${event.type}`);
    const subscription = event.data.object as Stripe.Subscription;
     try {
         await User.findOneAndUpdate(
             { stripeSubscriptionId: subscription.id },
             {
                 $set: {
                     tier: 'free',
                     stripeSubscriptionId: null,
                     stripeSubscriptionStatus: subscription.status,
                     planExpiresAt: null,
                 }
             }
         );
          console.log(`[Stripe Webhook] Handled subscription deletion for ${subscription.id}, user set to free tier.`);
     } catch(dbError: any) {
         console.error(`[Stripe Webhook] DB update failed for subscription ${subscription.id} deletion: ${dbError.message}`);
         return new NextResponse(`Webhook DB Error: ${dbError.message}`, { status: 500 });
     }
  }
  else {
    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  // Return a 200 OK response to acknowledge receipt of the event
  return new NextResponse(null, { status: 200 });
}
