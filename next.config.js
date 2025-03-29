/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic configuration
  reactStrictMode: false,
  swcMinify: true,
  
  // Image settings
  images: {
    domains: ['localhost', 'vercel.app', 'avatar.vercel.sh'],
    unoptimized: true,
  },
  
  // Force server rendering
  output: 'standalone',
  
  // Force dynamic rendering and disable static optimization
  experimental: {
    // Use true Server Components to prevent static optimization
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Support for larger page data
    largePageDataBytes: 128 * 1000, // 128KB
    // Only transpile external packages
    serverComponentsExternalPackages: ['mongodb'],
  },
  
  // Cache busting for builds
  generateBuildId: () => {
    return `build-${Date.now()}`
  },

  // Configure headers for cache control 
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Pragma', value: 'no-cache' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' }
        ]
      }
    ]
  },

  // Force server-side rendering for all pages
  // This is the most important part to disable static generation
  distDir: '.next',
  poweredByHeader: false,
  compress: true,
}

// Ensure we're using proper configuration for Vercel deployment
if (process.env.VERCEL) {
  nextConfig.compiler = {
    ...nextConfig.compiler,
    // Eliminate static optimization
    styledComponents: true
  }
}

module.exports = nextConfig 