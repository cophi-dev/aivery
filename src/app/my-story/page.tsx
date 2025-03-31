'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { fetchWithAuth } from '@/lib/client-utils';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyStoryPage() {
  const { data: session, status } = useSession();
  const [story, setStory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const generateStory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth('/api/my-story');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate your story');
      }
      
      const data = await response.json();
      setStory(data.story);
    } catch (err) {
      console.error('Error generating story:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      
      // If we encountered an error, show a simplified fallback story
      if (retryCount > 1) {
        setStory(`
          <h1>Your Fitness Journey</h1>
          <p>We couldn't generate your complete fitness story right now, but that doesn't mean your journey isn't important!</p>
          <p>Keep logging your workouts and activities in Aivery, and we'll create an amazing story about your progress soon.</p>
          <p>Every step you take brings you closer to your goals. Keep going!</p>
        `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    generateStory();
  };

  useEffect(() => {
    if (status === 'authenticated') {
      generateStory();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Fitness Story</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Please Log In</h1>
          <p className="mb-6">You need to be logged in to view your fitness story.</p>
          <Button asChild>
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">My Fitness Story</h1>
        </div>
        <Button 
          onClick={handleRetry} 
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Regenerate Story
        </Button>
      </div>

      {error && (
        <div className="mb-8 bg-destructive/10 text-destructive p-6 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <h2 className="text-xl font-bold mb-2">Error</h2>
              <p className="mb-4">{error}</p>
              <Button onClick={handleRetry} variant="destructive" size="sm">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6 prose prose-slate dark:prose-invert max-w-none">
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-1/2 mb-6" />
              <Skeleton className="h-32 w-full mb-4" />
              <Skeleton className="h-32 w-full mb-4" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: story }} />
          )}
        </CardContent>
      </Card>
    </div>
  );
} 