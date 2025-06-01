'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugAccessPage() {
  const { data: session, status } = useSession();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [refreshResult, setRefreshResult] = useState<any>(null);

  useEffect(() => {
    // Fetch debug info from API
    fetch('/api/debug-auth')
      .then(res => res.json())
      .then(data => setDebugInfo(data))
      .catch(err => console.error('Error fetching debug info:', err));
  }, []);

  const handleRefreshSession = async () => {
    try {
      const res = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      setRefreshResult(data);
      
      // Reload after a short delay to allow session to update
      if (data.success) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      setRefreshResult({ error: (error as Error).message });
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Access Debug Information</h1>
      
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Client-Side Session</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Status:</strong> {status}</p>
          {session && (
            <>
              <p><strong>User ID:</strong> {session.user?.id}</p>
              <p><strong>Email:</strong> {session.user?.email}</p>
              <p><strong>Name:</strong> {session.user?.name}</p>
            </>
          )}
          {!session && status === 'loading' && (
            <p className="text-gray-600">Loading session...</p>
          )}
          {!session && status === 'unauthenticated' && (
            <p className="text-red-600">Not authenticated</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Server-Side Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          {debugInfo ? (
            <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          ) : (
            <p>Loading debug info...</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={handleRefreshSession} variant="outline">
            Refresh Session
          </Button>
          <Button onClick={() => window.location.href = '/api/auth/signout'} variant="destructive">
            Sign Out
          </Button>
          <Button onClick={() => window.location.href = '/login'} variant="default">
            Go to Login
          </Button>
        </CardContent>
      </Card>

      {refreshResult && (
        <Card>
          <CardHeader>
            <CardTitle>Refresh Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded">
              {JSON.stringify(refreshResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 