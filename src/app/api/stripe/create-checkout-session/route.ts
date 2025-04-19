import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Assuming your NextAuth options are here
import Stripe from 'stripe';
// import { getUserSubscriptionPlan } from '@/lib/stripe/subscription'; // Placeholder for subscription check logic
import { absoluteUrl } from '@/lib/utils'; // Helper for absolute URLs

// Ensure Stripe secret key is defined
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}
// Only check for Premium Price ID
if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
    throw new Error('STRIPE_PREMIUM_PRICE_ID is not set.');
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Cast API version to 'any' to bypass strict type check
  apiVersion: '2024-06-20' as any, 
  typescript: true,
});

// Define price IDs from environment variables 
// Only include premium now
const pricing = {
  premium: {
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
  },
};

// Helper function to ensure absolute URLs (implement in @/lib/utils.ts)
// function absoluteUrl(path: string): string {
//   const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
//   return `${baseUrl}${path}`;
// }

const dashboardUrl = absoluteUrl('/dashboard'); // Adjust if your success/cancel page is different

export async function POST(req: Request) {
  try {
    // 1. Get User Session using NextAuth
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      console.log("[Stripe Checkout] Unauthorized: No session found.");
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const userId = session.user.id;
    const userEmail = session.user.email; // Optional: Use email if available

    console.log(`[Stripe Checkout] User authenticated: ${userId}`);

    // 2. Get the desired priceId from the request body
    let priceId: string;
    try {
        const body = await req.json();
        priceId = body.priceId;
        // Ensure the received priceId is the premium one
        if (priceId !== pricing.premium.priceId) {
             console.error(`[Stripe Checkout] Invalid or non-premium Price ID provided: ${priceId}`);
             // Throw an error instead of just logging to prevent proceeding
             throw new Error("Invalid Price ID provided.");
        }
    } catch (error) {
        console.error("[Stripe Checkout] Invalid request body or Price ID:", error);
        // Return a clear error message
        const errorMessage = error instanceof Error ? error.message : 'Missing or invalid priceId in request body.';
        return new NextResponse(`Bad Request: ${errorMessage}`, { status: 400 });
    }

    console.log(`[Stripe Checkout] Received valid premium priceId: ${priceId}`);

    // 3. TODO: Check for existing subscription (Optional but Recommended)
    // const subscriptionPlan = await getUserSubscriptionPlan(userId); // Implement this function
    // ... (logic to redirect to billing portal if already subscribed) ...

    console.log(`[Stripe Checkout] Creating new checkout session for user ${userId} and price ${priceId}`);

    // 4. Create a new Stripe Checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: `${dashboardUrl}?stripe_session=success`, // Add params for feedback
      cancel_url: `${dashboardUrl}?stripe_session=cancel`,  // Add params for feedback
      payment_method_types: ['card'], // Add other methods like 'paypal' if needed
      mode: 'subscription',
      billing_address_collection: 'auto',
      customer_email: userEmail || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
      },
    });

    console.log(`[Stripe Checkout] Session created: ${stripeSession.id} for user ${userId}`);
    
    // 5. Return the session ID (or the full URL if you prefer)
    // The UpgradeButton expects `id` by default for redirectToCheckout
    return NextResponse.json({ id: stripeSession.id }); 

  } catch (error) {
    console.error('[STRIPE CHECKOUT API ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
} 