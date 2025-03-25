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
  api: {
    bodyParser: {
      sizeLimit: process.env.MAX_UPLOAD_SIZE || '100mb'
    },
    responseLimit: process.env.MAX_UPLOAD_SIZE || '100mb'
  }
};

module.exports = nextConfig; 