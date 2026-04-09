import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Required for monorepo: trace files from the repo root
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
