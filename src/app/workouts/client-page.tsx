'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucidePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

export default function ClientWorkoutsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get session info
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        });
        
        // Parse response
        const data = await res.json();
        console.log('Session data:', data);
        
        if (data.user) {
          setUser(data.user);
          
          // Fetch workouts for the authenticated user
          try {
            const workoutsRes = await fetch('/api/workouts', {
              cache: 'no-store',
              credentials: 'include',
            });
            
            if (workoutsRes.ok) {
              const workoutsData = await workoutsRes.json();
              setWorkouts(workoutsData);
            } else {
              console.error('Failed to fetch workouts:', workoutsRes.statusText);
            }
          } catch (workoutsError) {
            console.error('Error fetching workouts:', workoutsError);
          }
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError('Failed to check authentication status');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <p className="text-center mt-4">Loading authentication status...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h2 className="text-2xl font-bold mb-3">Client-Side Authentication Check</h2>
          <p>Not authenticated from client-side check</p>
          <p>Try clicking the login button below</p>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4">
          <p className="mb-4">Please log in to view your workouts.</p>
          <Button onClick={() => router.push('/login')} className="bg-gradient-to-r from-indigo-500 to-cyan-500">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // Authenticated - show workouts
  return (
    <div className="container mx-auto px-4 py-8">
      {/* DEBUG VISUAL CHANGE - Bright background */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        color: 'white'
      }}>
        <h2 className="text-2xl font-bold mb-3">NEW DESIGN - Client-Side Workout Tracker</h2>
        <p>This is the client-side version with direct auth check</p>
        <p>Logged in as: {user.email}</p>
      </div>
      
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
          <p className="text-muted-foreground mt-2">Track and manage your training sessions</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link href="/workouts/new" prefetch={false}>
            <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600">
              <LucidePlus className="mr-2 h-5 w-5" />
              New Workout
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-8 border-2 border-indigo-200">
        <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-cyan-50">
          <CardTitle>Workouts (Client Rendered)</CardTitle>
        </CardHeader>
        <CardContent>
          {workouts.length > 0 ? (
            <div>
              <p className="mb-4">Found {workouts.length} workouts</p>
              <ul className="space-y-2">
                {workouts.map((workout, index) => (
                  <li key={index} className="border p-3 rounded-md">
                    <p><strong>{workout.title || 'Untitled Workout'}</strong></p>
                    <p className="text-sm text-gray-500">
                      {new Date(workout.date).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No workouts found. Create your first one!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 