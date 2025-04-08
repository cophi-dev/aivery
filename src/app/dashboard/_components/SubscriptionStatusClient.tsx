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
    const [isLoadingPortal, setIsLoadingPortal] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);
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
                    setCurrentPlan(data.user?.tier || 'Free');
                })
                .catch(err => {
                     console.error("Failed to fetch user data:", err);
                     setCurrentPlan('Error loading plan'); 
                })
                .finally(() => {
                    setIsLoadingPlan(false);
                });
        }
        if (status === 'unauthenticated') {
            router.push('/login?callbackUrl=/dashboard'); 
        }
    }, [status, router]); 

    const handleManageSubscription = async () => {
        setIsLoadingPortal(true);
        setPortalError(null);
        try {
            const response = await fetch('/api/stripe/create-portal-session', {
                method: 'POST',
            });

            if (response.status === 400) {
                 const errorData = await response.json();
                 if (errorData.message?.includes('Stripe Customer ID not found')) {
                      throw new Error('Subscription management is only available for active subscribers.');
                 } else {
                      throw new Error(errorData.message || 'Failed to create portal session (Bad Request)');
                 }
            } else if (!response.ok) {
                throw new Error(`Failed to create portal session (Status: ${response.status})`);
            }

            const { url } = await response.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error('Portal URL not received');
            }
        } catch (err: any) {
            console.error("Portal Session Error:", err);
            setPortalError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoadingPortal(false);
        }
    };

    if (status === 'loading' || (status === 'authenticated' && isLoadingPlan)) {
        return (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <h2 className="text-lg font-semibold mb-2 text-gray-700">Subscription Status</h2>
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    const isSubscribed = currentPlan && currentPlan !== 'Free' && currentPlan !== 'Error loading plan' && currentPlan !== null;

    return (
        <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Subscription Status</h2>
            <p className="text-gray-600">Your current plan: <span className="font-medium capitalize text-gray-800">{currentPlan || 'N/A'}</span></p>

            {isSubscribed && ( 
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={handleManageSubscription}
                        disabled={isLoadingPortal}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoadingPortal ? 'Processing...' : 'Manage Subscription'}
                    </button>
                    {portalError && (
                        <p className="mt-2 text-sm text-red-600">Error: {portalError}</p>
                    )}
                </div>
            )}

            {!isSubscribed && currentPlan !== null && currentPlan !== 'Error loading plan' && (
                 <div className="mt-4">
                     <p className="text-gray-500 mb-3">Upgrade your plan to unlock more features.</p>
                     <div className="flex flex-col sm:flex-row gap-4">
                         <UpgradeButton plan="premium" currentPlanIsFree={true} className="w-full sm:w-auto">
                             Go Premium (€6.90/month)
                         </UpgradeButton>
                         <UpgradeButton plan="expert" currentPlanIsFree={true} variant="secondary" className="w-full sm:w-auto">
                             Go Expert (€14.90/month)
                         </UpgradeButton>
                     </div>
                 </div>
            )}
        </div>
    );
} 