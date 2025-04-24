import { NextResponse } from 'next/server';
import playwright from 'playwright-core';
import chromium from '@sparticuz/chromium';
import { put } from '@vercel/blob';

// Determine the base URL based on Vercel environment or fallback to localhost
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Ensure NEXT_PUBLIC_APP_URL is set if needed

// We'll use POST requests to trigger screenshot generation
export async function POST(request: Request) {
  let browser = null;
  try {
    const body = await request.json();
    const targetPath = body.targetPath as string; // e.g., '/exercises/some-id'
    const forceUpdate = body.forceUpdate as boolean | undefined; // Optional flag to force regeneration

    if (!targetPath || !targetPath.startsWith('/')) {
      return NextResponse.json({ error: 'Valid targetPath starting with / is required' }, { status: 400 });
    }

    // Construct the filename for the blob storage
    // Replace leading/trailing slashes and use underscores
    const filename = `og-images${targetPath.replace(/^\/|\/$/g, '').replace(/\//g, '_')}.png`;

    console.log(`[OG Screenshot] Request received for path: ${targetPath}, filename: ${filename}`);

    // --- Playwright Logic --- 

    // 1. Launch Browser
    console.log('[OG Screenshot] Launching browser...');
    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(), // Use @sparticuz/chromium 
      headless: !!chromium.headless, // Explicitly cast to boolean
    });

    // 2. Create Page and Set Viewport
    const page = await browser.newPage({
        viewport: { width: 1200, height: 630 } // Standard OG image size
    });

    // 3. Construct full URL and Navigate
    const fullUrl = `${baseUrl}${targetPath}`;
    console.log(`[OG Screenshot] Navigating to ${fullUrl}...`);
    await page.goto(fullUrl, {
        waitUntil: 'networkidle', // Wait for network activity to settle
        timeout: 15000 // Increase timeout for potentially slow pages
    });

    // Optional: Wait for a specific element if needed for your pages
    // await page.waitForSelector('#specific-content-loaded-indicator');

    // Give a little extra time for rendering (optional, adjust as needed)
    await page.waitForTimeout(500);

    // 4. Take Screenshot
    console.log('[OG Screenshot] Taking screenshot...');
    const screenshotBuffer = await page.screenshot({ type: 'png' });

    // 5. Upload to Vercel Blob
    console.log(`[OG Screenshot] Uploading ${filename} to Vercel Blob...`);
    const blob = await put(filename, screenshotBuffer, {
      access: 'public', // Make the image publicly accessible
      contentType: 'image/png',
      addRandomSuffix: false, // Use the exact filename we constructed
      // Optionally add caching headers if needed
      // cacheControlMaxAge: 60 * 60 * 24 * 30 // 30 days
    });
    console.log(`[OG Screenshot] Upload complete: ${blob.url}`);

    // 6. Return Blob URL
    return NextResponse.json({ 
        message: 'Screenshot generated and uploaded successfully.', 
        blobUrl: blob.url // The public URL of the uploaded image
    });

  } catch (error) {
    console.error('[OG Screenshot] Error generating screenshot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Log specific playwright errors if available
    if (error instanceof Error && 'message' in error) {
        console.error('[OG Screenshot] Playwright error details:', error.message);
    }
    return NextResponse.json({ error: 'Failed to generate screenshot', details: errorMessage }, { status: 500 });
  } finally {
    // 7. Ensure browser is closed
    if (browser !== null) {
        console.log('[OG Screenshot] Closing browser...');
        await browser.close();
    }
  }
}

// Optional: Increase the max duration for the serverless function 
// (Default is 10s on Hobby, 60s on Pro - might need more for Playwright)
// Replace the deprecated config object:
// export const config = {
//   maxDuration: 60,
// };

// Use direct export for route segment config (Next.js 14+)
export const maxDuration = 60; 

// Optional: Add a GET handler for testing or simple checks if needed
// export async function GET() {
//   return NextResponse.json({ message: 'OG Screenshot API Ready' });
// } 