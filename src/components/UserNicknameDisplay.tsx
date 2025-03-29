'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export default function UserNicknameDisplay() {
  const { data: session } = useSession();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkNickname = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/debug/nickname', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setDebugInfo(data);
    } catch (err) {
      console.error('Error checking nickname:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      checkNickname();
    }
  }, [session]);

  if (!session || !session.user) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User Nickname Status</CardTitle>
        <CardDescription>Check if your nickname is correctly loaded in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>From Session:</strong>
              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                {session.user.nickname || 'Not set in session'}
              </div>
            </div>
            
            {debugInfo?.nickname && (
              <div>
                <strong>From Database:</strong>
                <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                  {debugInfo.nickname.fromDatabase || 'Not set in database'}
                </div>
              </div>
            )}
          </div>
          
          <div>
            <strong>Effective Nickname:</strong>
            <div className="font-mono text-lg bg-green-50 dark:bg-green-900 p-2 rounded mt-1">
              {debugInfo?.nickname?.effectiveNickname || session.user.nickname || session.user.name || 'No nickname available'}
            </div>
          </div>
          
          {error && (
            <div className="text-red-500 mt-2">
              Error: {error}
            </div>
          )}
          
          <Button 
            onClick={checkNickname} 
            disabled={loading}
            variant="outline"
            className="mt-2"
          >
            {loading ? 'Checking...' : 'Refresh Nickname Info'}
          </Button>
          
          {debugInfo && (
            <div className="mt-4">
              <details>
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  Show Debug Details
                </summary>
                <pre className="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-48">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 