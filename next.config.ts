import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  agentRules: false,
};

export default nextConfig;
