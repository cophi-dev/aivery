import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/db/models/user';
import { absoluteUrl } from '@/lib/utils'; // Helper for absolute URLs

// Ensure Stripe secret key is defined
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
  typescript: true,
});

// Define the URL users should return to after managing billing
const returnUrl = absoluteUrl('/dashboard'); // Or your account/settings page

// Define a simple interface for the lean user object
interface UserWithStripeId {
  _id: any; // or mongoose.Types.ObjectId if available/imported
  stripeCustomerId?: string | null;
}

export async function POST(req: Request) {
  try {
    // 1. Get User Session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("[Stripe Portal] Unauthorized: No session found.");
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const userId = session.user.id;
    console.log(`[Stripe Portal] User authenticated: ${userId}`);

    // 2. Connect to Database
    await dbConnect();
    console.log("[Stripe Portal] Database connected.");

    // 3. Retrieve User's Stripe Customer ID
    // Use the interface as a type hint for lean()
    const user = await User.findById(userId).select('stripeCustomerId').lean<UserWithStripeId>();
    if (!user) {
        console.error(`[Stripe Portal] User not found in DB for ID: ${userId}`);
        return new NextResponse('User not found', { status: 404 });
    }
    if (!user.stripeCustomerId) {
      console.error(`[Stripe Portal] User ${userId} does not have a Stripe Customer ID.`);
      return NextResponse.json({ error: 'Stripe Customer ID not found for this user.' }, { status: 400 });
    }
    const stripeCustomerId = user.stripeCustomerId;
    console.log(`[Stripe Portal] Found Stripe Customer ID: ${stripeCustomerId} for user ${userId}`);

    // 4. Create a Stripe Billing Portal Session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    console.log(`[Stripe Portal] Created portal session: ${portalSession.id} for customer ${stripeCustomerId}`);

    // 5. Return the Portal Session URL
    return NextResponse.json({ url: portalSession.url });

  } catch (error) {
    console.error('[STRIPE PORTAL API ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
} 