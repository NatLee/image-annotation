/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Dynamic base path handling from environment variables
  basePath: isProd ? process.env.NEXT_PUBLIC_BASE_PATH : '',
  assetPrefix: isProd ? process.env.NEXT_PUBLIC_BASE_PATH : '',
}

module.exports = nextConfig
