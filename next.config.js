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
      bodySizeLimit: '10mb', // Increased to handle 8.5MB+ Strava files
      allowedOrigins: ['*'],
    },
    largePageDataBytes: 128 * 1000, // 128KB
    serverComponentsExternalPackages: ['mongodb'],
    // disableOptimizedLoading: true, // <-- Temporarily commented out
  },
  
  // Cache busting for builds
  generateBuildId: () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  },

  // Configure headers for cache control and CORS
  // --- RESTORING HEADERS --- 
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
          { key: 'Vary', value: '*' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
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
  // --- HEADERS RESTORED ---

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
  },

  // Add Webpack configuration to handle Playwright bundling issues
  webpack: (config, { isServer, webpack }) => {
    // Exclude problematic modules from server bundle
    if (isServer) {
      config.externals.push(
        'electron',
        'bufferutil',        // Add bufferutil
        'utf-8-validate'    // Add utf-8-validate
        // Add other modules if they cause issues
        // '@playwright/test' // If you were using the full test runner
      );
    }

    // Add a fallback for 'electron' to prevent client-side bundling attempts
    // or issues where `isServer` condition might not cover all cases.
    config.resolve.alias = {
      ...config.resolve.alias,
      'electron': false, // This tells webpack to treat 'electron' as an empty module
      // The existing aliases for chromium-bidi should remain
      'chromium-bidi/lib/cjs/bidiMapper/BidiMapper': false, 
      'chromium-bidi/lib/cjs/cdp/CdpConnection': false,
    };
    
    // Existing rules for fonts and playwright-core html files should remain
    if (isServer) {
      // Ignore font files
      config.module.rules.push({
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
            filename: 'static/media/[name].[hash][ext]',
        },
      });
      
      // Ignore .html files specifically from playwright-core
      config.module.rules.push({
          test: /index\.html$/,
          include: [/node_modules\/playwright-core/],
          use: 'ignore-loader',
      });
    }

    // Important: return the modified config
    return config;
  },
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