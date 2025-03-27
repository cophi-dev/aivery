/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['fit-file-parser'],
    // Drastically increase size limit to handle very large headers
    largePageDataBytes: 2 * 1024 * 1024, // 2MB
  },
  
  // Increase memory cache size
  cacheMaxMemorySize: 50 * 1024 * 1024, // 50MB
  
  // Add headers to prevent caching and handle large requests
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
  
  // Optimize production builds
  swcMinify: true,
  reactStrictMode: false, // Avoid double-rendering that could cause larger state
};

module.exports = nextConfig; 