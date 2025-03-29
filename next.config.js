/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turn off static optimization for improved dynamic support
  reactStrictMode: false,
  images: {
    domains: ['localhost', 'vercel.app', 'avatar.vercel.sh'],
    unoptimized: true,
  },
  experimental: {
    // Add support for dynamic API routes with headers
    serverActions: true,
    // Support for larger page data
    largePageDataBytes: 128 * 1000, // 128KB
    // Support for external packages in server components
    serverComponentsExternalPackages: ['mongodb', 'headers', 'cookies']
  },
  // Use standalone output for Vercel
  output: 'standalone',
  // Generate a unique build ID to prevent caching issues
  generateBuildId: () => {
    return `build-${Date.now()}`
  },
  // Set cache headers for all routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig 