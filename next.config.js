/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isProd ? '/engineering-calc' : '',
  assetPrefix: isProd ? '/engineering-calc/' : '',
  trailingSlash: true,
};

module.exports = nextConfig;
