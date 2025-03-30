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
  
  // Force server rendering with absolutely no static generation
  output: 'standalone',
  
  // Disable any kind of optimization or static generation
  experimental: {
    // Force dynamic components and prevent static optimization
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['*'],
    },
    // Support for larger page data
    largePageDataBytes: 128 * 1000, // 128KB
    // Only transpile external packages
    serverComponentsExternalPackages: ['mongodb'],
    // Disable static generation
    disableOptimizedLoading: true,
  },
  
  // Cache busting for builds - ensure unique for every deployment
  generateBuildId: () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  },

  // Configure headers for cache control 
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0, stale-while-revalidate=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '-1' },
          { key: 'Surrogate-Control', value: 'no-store' },
          { key: 'X-Accel-Expires', value: '0' },
          { key: 'Vary', value: '*' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0, stale-while-revalidate=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '-1' },
          { key: 'Surrogate-Control', value: 'no-store' },
          { key: 'X-Accel-Expires', value: '0' },
          { key: 'Vary', value: '*' }
        ]
      }
    ]
  },

  // Force server-side rendering for all pages
  distDir: '.next',
  poweredByHeader: false,
  compress: true,
  
  // Completely disable static generation with extreme timeouts
  staticPageGenerationTimeout: 1,
  serverRuntimeConfig: {
    dynamicRoutes: true
  },

  // Disable any Vercel static optimization
  trailingSlash: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  
  // Handle route redirects explicitly to prevent loops
  async redirects() {
    return [];
  },
  
  // Fix the workouts page redirect loop by explicitly showing the workouts page
  async rewrites() {
    return [
      {
        source: '/workouts',
        destination: '/workouts-direct',
        has: [
          {
            type: 'cookie',
            key: 'next-auth.session-token',
          },
        ],
      }
    ];
  }
}

// Ensure we're using proper configuration for Vercel deployment
if (process.env.VERCEL) {
  nextConfig.compiler = {
    ...nextConfig.compiler,
    // Eliminate static optimization
    styledComponents: true,
    // Disable all optimizations
    removeConsole: false,
    reactRemoveProperties: false,
  }
  
  // Force env variables to disable static generation
  process.env.NEXT_DISABLE_STATIC_GENERATION = 'true';
  process.env.VERCEL_FORCE_NO_BUILD_CACHE = '1';
  process.env.NEXT_RUNTIME = 'nodejs';
}

module.exports = nextConfig 