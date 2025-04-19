'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UpgradeButton } from '@/components/UpgradeButton';

// Client component for Subscription Status and Management
export function SubscriptionStatus() { // Export the function
    const { data: session, status } = useSession();
    const [currentPlan, setCurrentPlan] = useState<string | null>(null);
    const [isLoadingPlan, setIsLoadingPlan] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (status === 'authenticated') {
            setIsLoadingPlan(true);
            fetch('/api/user') 
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch user data');
                    return res.json();
                })
                .then(data => {
                    const fetchedTier = data.user?.tier || 'Free';
                    setCurrentPlan(fetchedTier.toLowerCase());
                })
                .catch(err => {
                     console.error("[SubscriptionStatus] Failed to fetch user data:", err);
                     setCurrentPlan('error loading plan'); 
                })
                .finally(() => {
                    setIsLoadingPlan(false);
                });
        }
        if (status === 'unauthenticated') {
            router.push('/login?callbackUrl=/dashboard'); 
        }
    }, [status, router]); 

    if (status === 'loading' || (status === 'authenticated' && isLoadingPlan)) {
        return (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <h2 className="text-lg font-semibold mb-2 text-gray-700">Subscription Status</h2>
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    const isSubscribed = currentPlan && currentPlan !== 'free' && currentPlan !== 'error loading plan' && currentPlan !== null;

    if (!isSubscribed && currentPlan === 'free') {
        return (
            <div className="mb-6 p-4 border rounded-lg bg-white dark:bg-card dark:border-border shadow-sm">
                <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-card-foreground">Subscription Status</h2>
                <p className="text-gray-600 dark:text-muted-foreground">Your current plan: <span className="font-medium capitalize text-gray-900 dark:text-foreground">Free</span></p>
                <div className="mt-4">
                    <p className="text-gray-500 dark:text-muted-foreground mb-3">Upgrade your plan to unlock more features.</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <UpgradeButton plan="premium" currentPlanIsFree={true} className="w-full sm:w-auto">
                            Go Premium (€12.90/month)
                        </UpgradeButton>
                    </div>
                </div>
            </div>
        );
    }
    
    if (currentPlan === 'error loading plan') {
      return (
          <div className="mb-6 p-4 border rounded-lg bg-destructive/10">
              <h2 className="text-lg font-semibold mb-2 text-destructive">Subscription Status</h2>
              <p className="text-destructive">Error loading subscription status.</p>
          </div>
      );
    }

    return null; 
} 