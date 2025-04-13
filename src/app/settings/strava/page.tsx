import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getStravaIntegration } from '@/lib/services/stravaService';
import StravaConnectButton from './connect-button';
import StravaDisconnectButton from './disconnect-button';
import RepairStravaDataButton from './repair-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default async function StravaSettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  
  let stravaIntegration = null;
  if (userId) {
    stravaIntegration = await getStravaIntegration(userId);
  }
  
  const isConnected = !!stravaIntegration;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Strava Integration</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Connect with Strava</CardTitle>
          <CardDescription>
            Connect your Strava account to import and sync your activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isConnected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="text-sm">
                    <div className="font-medium">Connected to Strava</div>
                    {stravaIntegration?.athleteId && (
                      <div className="text-muted-foreground">Athlete ID: {stravaIntegration.athleteId}</div>
                    )}
                  </div>
                </div>
                <StravaDisconnectButton />
              </div>
            ) : (
              <Suspense fallback={<Skeleton className="h-10 w-40" />}>
                <StravaConnectButton />
              </Suspense>
            )}
          </div>
        </CardContent>
      </Card>
      
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Tools to manage your imported Strava data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-amber-50 p-4 rounded-md border border-amber-200 mb-6 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-amber-800 font-medium mb-1">Distance Data Issue Detected</h3>
                  <p className="text-amber-700 text-sm mb-2">
                    Your imported workouts may be missing distance data in the summary. Our repair tool can fix this for you.
                  </p>
                  <Link href="/settings/strava/fix-distances">
                    <Button variant="outline" size="sm" className="mt-1">
                      Fix Distance Data
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Repair Workout Data</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Fix issues with distance data in your existing Strava workouts. This will ensure 
                  all distance data is correctly synchronized between workouts and workout exercises.
                </p>
                <RepairStravaDataButton />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 