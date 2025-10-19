/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '/image-annotation-system' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/image-annotation-system/' : '',
}

module.exports = nextConfig
