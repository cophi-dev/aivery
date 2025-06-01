'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function DebugTokenPage() {
  const { data: session, status } = useSession();
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    // Fetch the raw JWT token from the API
    const fetchTokenInfo = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        setTokenInfo(data);
      } catch (error) {
        console.error('Error fetching token:', error);
      }
    };

    // Fetch user info
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        setUserInfo(data);
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    if (status === 'authenticated') {
      fetchTokenInfo();
      fetchUserInfo();
    }
  }, [status]);

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Token - Not Authenticated</h1>
        <p>Please <a href="/login" className="text-blue-600 hover:underline">login</a> to debug the token.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">JWT Token Debug Information</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Session Data */}
        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Next-Auth Session</h2>
          <pre className="text-sm overflow-auto bg-white dark:bg-gray-800 p-4 rounded border">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        {/* Raw Token Info */}
        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Raw Token Response</h2>
          <pre className="text-sm overflow-auto bg-white dark:bg-gray-800 p-4 rounded border">
            {JSON.stringify(tokenInfo, null, 2)}
          </pre>
        </div>

        {/* User API Data */}
        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">User API Data</h2>
          <pre className="text-sm overflow-auto bg-white dark:bg-gray-800 p-4 rounded border">
            {JSON.stringify(userInfo, null, 2)}
          </pre>
        </div>

        {/* Key Information Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Key Information</h2>
          <div className="space-y-2 text-sm">
            <div><strong>User ID:</strong> {session?.user?.id || 'Not found'}</div>
            <div><strong>Email:</strong> {session?.user?.email || 'Not found'}</div>
            <div><strong>Tier (from user API):</strong> {userInfo?.user?.tier || 'Not found'}</div>
            <div><strong>Session contains tier:</strong> {(session as any)?.user?.tier ? 'Yes' : 'No'}</div>
            <div><strong>Token contains tier:</strong> {tokenInfo?.user?.tier ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <a 
          href="/dashboard" 
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
        <a 
          href="/subscribe" 
          className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-4"
        >
          Go to Subscribe
        </a>
      </div>
    </div>
  );
} 