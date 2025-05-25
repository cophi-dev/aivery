import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Create a simple branded image as base64 data URL
    // This is a minimal 1200x630 branded image
    const svgContent = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4B9EFF;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#667eea;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <rect width="1200" height="630" fill="url(#bg)"/>
        
        <g transform="translate(600, 315)">
          <text x="0" y="-60" font-family="Inter, sans-serif" font-size="72" font-weight="800" text-anchor="middle" fill="white">Aivery</text>
          <text x="0" y="20" font-family="Inter, sans-serif" font-size="32" font-weight="400" text-anchor="middle" fill="white" opacity="0.9">AI-Powered Fitness Intelligence</text>
          <text x="0" y="80" font-family="Arial, sans-serif" font-size="60" text-anchor="middle">💪</text>
        </g>
      </svg>
    `;

    // Convert SVG to a data URL
    const svgBuffer = Buffer.from(svgContent);
    const base64 = svgBuffer.toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    // Return as SVG response
    return new NextResponse(svgContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('[OG Fallback] Error:', error);
    
    // Return a very simple text-based fallback
    const simpleFallback = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#4B9EFF"/>
        <text x="600" y="320" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="white">Aivery</text>
      </svg>
    `;
    
    return new NextResponse(simpleFallback, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
} 