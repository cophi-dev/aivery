'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/debug', {
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setDebugInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        color: 'white'
      }}>
        <h2 className="text-2xl font-bold mb-3">Authentication Debug Page</h2>
        <p>This page helps diagnose authentication issues in your application.</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Auth Debug</h1>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button onClick={fetchDebugInfo} variant="outline">
            Refresh
          </Button>
          <Link href="/workouts">
            <Button>Go to Workouts</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Login Page</Button>
          </Link>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      
      {error && (
        <Card className="mb-4 border-red-500">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {debugInfo && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Session Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Session Exists:</strong> {debugInfo.session.exists ? 'Yes ✅' : 'No ❌'}</p>
              <p><strong>Has User:</strong> {debugInfo.session.hasUser ? 'Yes ✅' : 'No ❌'}</p>
              {debugInfo.session.user && (
                <div className="mt-2">
                  <p><strong>User ID:</strong> {debugInfo.session.user.id}</p>
                  <p><strong>Email:</strong> {debugInfo.session.user.email}</p>
                  <p><strong>Name:</strong> {debugInfo.session.user.name}</p>
                </div>
              )}
              {debugInfo.session.error && (
                <div className="mt-2 text-red-500">
                  <p><strong>Error:</strong> {debugInfo.session.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Cookies ({debugInfo.cookies.count})</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Has Session Cookie:</strong> {debugInfo.cookies.hasSessionCookie ? 'Yes ✅' : 'No ❌'}</p>
              <div className="mt-2">
                <p><strong>Cookie Names:</strong></p>
                <ul className="ml-4 list-disc">
                  {debugInfo.cookies.names.map((name: string, index: number) => (
                    <li key={index} className={name.includes('session') || name.includes('next-auth') ? 'font-bold text-green-600' : ''}>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>JWT Token</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Token Exists:</strong> {debugInfo.token.exists ? 'Yes ✅' : 'No ❌'}</p>
              {debugInfo.token.exists && (
                <div className="mt-2">
                  <p><strong>Email:</strong> {debugInfo.token.email}</p>
                  <p><strong>Name:</strong> {debugInfo.token.name}</p>
                </div>
              )}
              {debugInfo.token.error && (
                <div className="mt-2 text-red-500">
                  <p><strong>Error:</strong> {debugInfo.token.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Request Headers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap overflow-x-auto">
                <p><strong>User-Agent:</strong> {debugInfo.headers.userAgent}</p>
                <p><strong>Cookie Header:</strong> {debugInfo.headers.cookieHeader || 'None'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 