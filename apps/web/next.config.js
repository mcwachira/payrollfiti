const withSerwist = require('@serwist/next').default({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@repo/api', '@repo/pricing'],
  images: {
    domains: ['images.unsplash.com'],
  },
};

module.exports = withSerwist(nextConfig);
