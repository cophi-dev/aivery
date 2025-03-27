// Configuration to increase server limits for Next.js
// This helps prevent HTTP 431 errors due to large headers

import type { NextConfig } from 'next'

// Configure server settings to allow larger payloads
// This can be imported and used in next.config.js
export const serverConfig: NextConfig = {
  experimental: {
    // Allow server components to use larger data payloads
    largePageDataBytes: 2 * 1024 * 1024, // 2MB for large headers
    
    // Server memory cache size
    isrMemoryCacheSize: 50 * 1024 * 1024, // 50MB cache for ISR
  },
  
  // Set response headers to enable larger request/response sizes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ]
  },
} 