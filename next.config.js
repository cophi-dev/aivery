/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
    largePageDataBytes: 128 * 1000,
  },
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
  
  serverRuntimeConfig: {
    largeHeaderSize: true,
  },

  cookies: {
    pkce: {
      enabled: true,
    },
  },
}

module.exports = nextConfig 