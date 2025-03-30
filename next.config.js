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
  
  // Server rendering configuration
  output: 'standalone',
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['*'],
    },
    largePageDataBytes: 128 * 1000, // 128KB
    serverComponentsExternalPackages: ['mongodb'],
    disableOptimizedLoading: true,
  },
  
  // Cache busting for builds
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

  // Rendering configuration
  distDir: '.next',
  poweredByHeader: false,
  compress: true,
  staticPageGenerationTimeout: 1,
  serverRuntimeConfig: {
    dynamicRoutes: true
  },
  trailingSlash: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  
  async redirects() {
    return [];
  },
  
  // Route workouts path to dedicated workouts-direct page
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

// Vercel deployment configuration
if (process.env.VERCEL) {
  nextConfig.compiler = {
    ...nextConfig.compiler,
    styledComponents: true,
    removeConsole: false,
    reactRemoveProperties: false,
  }
  
  process.env.NEXT_DISABLE_STATIC_GENERATION = 'true';
  process.env.VERCEL_FORCE_NO_BUILD_CACHE = '1';
  process.env.NEXT_RUNTIME = 'nodejs';
}

module.exports = nextConfig 