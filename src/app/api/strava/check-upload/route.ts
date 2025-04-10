import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Configuration for this API route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Simple endpoint to test file uploads without processing
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ 
        success: false, 
        error: "Unauthorized" 
      }, { status: 401 });
    }
    
    // Get form data with file
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: "No file provided" 
      }, { status: 400 });
    }
    
    // Return file info without processing
    return NextResponse.json({
      success: true,
      message: "Upload received successfully",
      fileInfo: {
        name: file.name,
        type: file.type,
        size: file.size,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
      }
    });
    
  } catch (error) {
    console.error("Error in check-upload route:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
} 