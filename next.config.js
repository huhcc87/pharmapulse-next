/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable source maps in development to avoid file reading issues
  productionBrowserSourceMaps: false,
  // Explicitly use webpack (Turbopack is default in Next.js 16)
  // If you want to use Turbopack, remove the webpack config and add: turbopack: {}
  webpack: (config, { isServer }) => {
    // Disable file watching to avoid permission issues
    if (!isServer) {
      config.watchOptions = {
        poll: false,
        ignored: /node_modules/,
      };
    }
    return config;
  },
  // Add empty turbopack config to allow webpack usage
  turbopack: undefined,
}

module.exports = nextConfig
