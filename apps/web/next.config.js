/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  transpilePackages: ['@repo/ui', '@repo/api'],
  images: {
    domains: ['images.unsplash.com'],
  },
};
