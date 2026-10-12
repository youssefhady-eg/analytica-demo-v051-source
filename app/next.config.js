/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // file:// viewing: emit relative asset URLs so the double-clickable
  // static build resolves _next chunks without a server
  assetPrefix: './',
};

module.exports = nextConfig;
