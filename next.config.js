/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/strava/import',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'max-http-buffer-size',
            value: '50mb',
          },
        ],
      },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ['fit-file-parser'],
  },
};

module.exports = nextConfig; 