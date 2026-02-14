/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // Suppress the DuckDB-WASM critical dependency warning
    config.module.exprContextCritical = false;
    return config;
  },
};

export default nextConfig;
