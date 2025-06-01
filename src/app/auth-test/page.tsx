import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function AuthTestPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Not Authenticated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">You are not logged in.</p>
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Get user tier from database
  const { default: dbConnect } = await import('@/lib/db/mongodb');
  const { default: UserModel } = await import('@/lib/db/models/user');
  
  await dbConnect();
  const user = await UserModel.findById(session.user.id).select('tier email').lean();
  const tier = user ? (user as any).tier : 'unknown';
  
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Session Status:</strong> Authenticated ✓</p>
          <p><strong>User ID:</strong> {session.user.id}</p>
          <p><strong>Email:</strong> {session.user.email}</p>
          <p><strong>Name:</strong> {session.user.name}</p>
          <p><strong>Database Tier:</strong> {tier}</p>
          <p><strong>Session Expires:</strong> {session.expires}</p>
          
          <div className="mt-6 space-x-2">
            <Link href="/dashboard">
              <Button>Try Dashboard</Button>
            </Link>
            <Link href="/subscribe">
              <Button variant="outline">Try Subscribe</Button>
            </Link>
            <Link href="/api/auth/signout">
              <Button variant="destructive">Sign Out</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 