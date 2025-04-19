"use client";

import { useState } from 'react';
import { Button, ButtonProps } from "@/components/ui/button"; // Assuming shadcn/ui Button
import { LucideSparkles } from "lucide-react"; // Icons - Removed LucideLoader
import { useToast } from "@/components/ui/use-toast"; // For feedback
import { loadStripe } from '@stripe/stripe-js';
import { InlineSpinner } from "@/components/ui/inline-spinner";

// Ensure the publishable key is available
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UpgradeButtonProps extends ButtonProps {
  // Plan prop is now only needed to potentially display plan name, 
  // but we only have one plan ('premium') that triggers checkout.
  // We could simplify this further later if needed.
  plan: 'premium'; // Only premium plan is purchasable
  currentPlanIsFree: boolean; 
}

export function UpgradeButton({ plan, currentPlanIsFree, children, ...props }: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Get the premium Price ID 
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID!;

   // Check if required environment variables are set client-side
   if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
     console.error("Stripe publishable key not set in client environment variables.");
     return <Button disabled {...props}>Error: Config Missing (PK)</Button>; // Indicate missing Publishable Key
   }
   // Only check for the premium price ID now
   if (!priceId) {
       console.error("Stripe premium price ID not set in client environment variables.");
       return <Button disabled {...props}>Error: Config Missing (Price)</Button>; // Indicate missing Price ID
   }

  const handleCheckout = async () => {
    setIsLoading(true);
    console.log(`[UpgradeButton] Initiating checkout for plan: ${plan}, priceId: ${priceId}`);

    try {
      // 1. Call your backend API to create the checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: priceId }), // Send the target price ID
      });

      const session = await response.json();

      // Check if response is OK AND if the session ID exists in the response
      if (!response.ok || !session.id) { 
         console.error("[UpgradeButton] Failed to create checkout session:", session);
         // Use error message from session if available, otherwise provide a default
         throw new Error(session.error || 'Failed to create checkout session. Please try again.');
      }

      console.log("[UpgradeButton] Checkout session created, redirecting with ID:", session.id);

      // 2. Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
          throw new Error('Stripe.js failed to load.');
      }

      // Use the session ID returned from your API to redirect
      const { error } = await stripe.redirectToCheckout({
          sessionId: session.id 
      });

      if (error) {
        console.error("[UpgradeButton] Stripe redirectToCheckout error:", error);
        throw new Error(`Stripe redirect error: ${error.message}`);
      }

    } catch (error: any) {
      console.error("[UpgradeButton] Checkout Error:", error);
      toast({
        title: "Upgrade Error",
        description: error.message || "Could not initiate the upgrade process. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false); // Ensure loading state is reset on error
    }
    // No need to set isLoading false on success, as the page redirects
  };

  // Determine button text/content
  const buttonText = children || `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;

  // Disable button if not on free tier OR if loading
  return (
    <Button onClick={handleCheckout} disabled={isLoading || !currentPlanIsFree} {...props}>
      {isLoading ? (
        <InlineSpinner size={16} className="mr-2" />
      ) : (
        <LucideSparkles className="mr-2 h-4 w-4" /> // Example icon
      )}
      {isLoading ? 'Processing...' : buttonText}
    </Button>
  );
} 