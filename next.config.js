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
    // Added to fix static generation issues
    appRouterDirectInvokeAllowed: true,
    isrMemoryCacheSize: 0,
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
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' }
        ]
      }
    ]
  },

  // Force server-side rendering for all pages
  distDir: '.next',
  poweredByHeader: false,
  compress: true,
  
  // Added to force dynamic rendering
  staticPageGenerationTimeout: 1000,
  serverRuntimeConfig: {
    dynamicRoutes: true
  },
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