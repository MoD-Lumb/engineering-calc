import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';

const isProd = process.env.NODE_ENV === 'production';

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isProd ? '/engineering-calc' : '',
  assetPrefix: isProd ? '/engineering-calc/' : '',
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack(config) {
    config.module.rules.push({
      test: /\.ya?ml$/,
      use: 'yaml-loader',
    });
    return config;
  },
};

export default withMDX(nextConfig);
