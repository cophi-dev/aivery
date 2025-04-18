import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Use Node.js runtime as dependencies require it (e.g., for auth)
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    // --- 1. Authentication Check ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // We might need userId later if adding DB logic in onUploadCompleted
    const userId = session.user.id; 
    // --- End Authentication Check ---

    // --- 2. Use handleUpload helper ---
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        // Pathname comes from client, just validate user is authenticated (done above)
        console.log(`[handleBlobUpload] Generating token for client-requested path: ${pathname}`);
        // Return minimal options required by the type
        return { }; // Return empty object if no specific server constraints needed
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Client blob upload completed:', blob.pathname);
      },
    });
    // --- End handleUpload ---

    // 3. Return the successful response
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Error in handle-blob-upload:", error);
    const message = (error instanceof Error && error.message) || 'Could not handle file upload.';
    return NextResponse.json(
      { error: message },
      { status: (error as any)?.statusCode || 500 }
    );
  }
} 