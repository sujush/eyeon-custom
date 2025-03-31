/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://v0ozwhw3k5.execute-api.ap-northeast-2.amazonaws.com/prod/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // infra 폴더의 파일을 무시
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;