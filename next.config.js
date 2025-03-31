/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://2goung6fs7.execute-api.ap-northeast-2.amazonaws.com/prod/:path*',
      },
    ];
  },
};

module.exports = nextConfig;