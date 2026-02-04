/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stabilize dev server webpack chunking
  // Prevent "Cannot find module './xxx.js'" errors in dev mode
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      // Ensure consistent chunk naming and prevent race conditions
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      };
    }
    return config;
  },
  // Disable source maps for server in dev to reduce chunking issues
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig
