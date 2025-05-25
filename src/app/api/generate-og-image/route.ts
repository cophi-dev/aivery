import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function GET(request: NextRequest) {
  // Dynamically import playwright for image generation
  const playwright = await import('playwright-core');
  const chromium = await import('@sparticuz/chromium');

  let browser = null;
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title') || 'Aivery | AI-Powered Fitness Training Intelligence';
    const description = searchParams.get('description') || 'Transform your workout data into actionable intelligence';
    const type = searchParams.get('type') || 'default';

    console.log('[Generate OG Image] Creating OG image:', { title, description, type });

    // Launch browser
    browser = await playwright.chromium.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: !!chromium.default.headless,
    });

    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 }
    });

    // Create HTML content for the OG image
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              margin: 0;
              padding: 0;
              width: 1200px;
              height: 630px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              overflow: hidden;
            }
            
            .container {
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              max-width: 1100px;
              padding: 0 50px;
              z-index: 2;
            }
            
            .content {
              flex: 1;
              color: white;
              max-width: 600px;
            }
            
            .logo-section {
              display: flex;
              align-items: center;
              margin-bottom: 30px;
            }
            
            .logo {
              width: 80px;
              height: 80px;
              background: white;
              border-radius: 20px;
              margin-right: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 40px;
              font-weight: bold;
              color: #4B9EFF;
            }
            
            .brand-name {
              font-size: 48px;
              font-weight: 800;
              margin: 0;
            }
            
            .title {
              font-size: 36px;
              font-weight: 700;
              margin: 20px 0;
              line-height: 1.2;
            }
            
            .description {
              font-size: 24px;
              font-weight: 400;
              opacity: 0.9;
              line-height: 1.4;
              margin: 0;
            }
            
            .visual {
              flex: 0 0 400px;
              height: 400px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
            }
            
            .visual::before {
              content: '';
              position: absolute;
              top: 20px;
              left: 20px;
              right: 20px;
              bottom: 20px;
              background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
              border-radius: 12px;
            }
            
            .visual-content {
              font-size: 120px;
              z-index: 1;
            }
            
            .background-pattern {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              opacity: 0.1;
              background-image: 
                radial-gradient(circle at 25% 25%, white 2px, transparent 2px),
                radial-gradient(circle at 75% 75%, white 2px, transparent 2px);
              background-size: 60px 60px;
              z-index: 1;
            }
          </style>
        </head>
        <body>
          <div class="background-pattern"></div>
          <div class="container">
            <div class="content">
              <div class="logo-section">
                <div class="logo">A</div>
                <h1 class="brand-name">Aivery</h1>
              </div>
              <h2 class="title">${title.replace('Aivery | ', '').replace('| Aivery', '')}</h2>
              <p class="description">${description}</p>
            </div>
            <div class="visual">
              <div class="visual-content">💪</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Set the HTML content
    await page.setContent(htmlContent);

    // Take screenshot
    const screenshotBuffer = await page.screenshot({ 
      type: 'png',
      fullPage: false 
    });

    // Upload to Vercel Blob
    const filename = `aivery-og-${type}.png`;
    const blob = await put(filename, screenshotBuffer, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
    });

    console.log('[Generate OG Image] Upload complete:', blob.url);

    // Return the image buffer directly
    return new NextResponse(screenshotBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });

  } catch (error) {
    console.error('[Generate OG Image] Error:', error);
    return NextResponse.json({ error: 'Failed to generate OG image' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export const maxDuration = 60; 