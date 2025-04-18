import { handleBlobUpload, type HandleBlobUploadBody } from "@vercel/blob/server";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Simple runtime check to ensure correct environment if needed
export const runtime = 'edge'; // Can use edge or nodejs

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleBlobUploadBody;

  try {
    // --- 1. Authentication Check ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    // --- End Authentication Check ---

    // --- 2. Use handleBlobUpload helper ---
    const jsonResponse = await handleBlobUpload({
      body,
      request,
      // Prefix uploads with user ID for organization and security
      pathname: `strava-imports/${userId}/${body.pathname}`, 
      // Define options:
      options: {
        access: 'public', // Must match client access level
        // Add any other server-side constraints if needed
        // For example, max file size:
        // maxSize: 10 * 1024 * 1024, // 10 MB
      },
      // Optional: Disallow uploads if file already exists (avoids overwrites)
      // Cannot be used with `addRandomSuffix: true` (which is default)
      // handleUpload: async ({ pathname, error }) => {
      //   if (error?.code === 'BLOB_ALREADY_EXISTS') {
      //     throw new Error('File already exists. Please rename and try again.');
      //   }
      // },
      
      // Before completion, you could add metadata or perform checks
      // onBeforeComplete: async ({ pathname /*, clientPayload */ }) => {
      //   console.log('blob upload completed', pathname);
      // },
    });
    // --- End handleBlobUpload ---

    // 3. Return the successful response from the helper
    // The client component (`upload(...)`) uses this response (containing the token/URL)
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Error in handle-blob-upload:", error);
    // Provide a user-friendly error message
    const message = (error instanceof Error && error.message) || 'Could not handle file upload.';
    return NextResponse.json(
      { error: message },
      // Use 400 for client errors (like failed checks), 500 for unexpected server errors
      { status: (error as any)?.statusCode || 500 } 
    );
  }
} 