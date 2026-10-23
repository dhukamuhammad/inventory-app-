import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '10.197.19.206',
    '10.197.19.206:3000',
    '10.47.174.20',
    '10.47.174.20:3000',
    '10.139.228.206',
    '10.139.228.206:3000',
    'localhost:3000'
  ],
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
};

export default nextConfig;
