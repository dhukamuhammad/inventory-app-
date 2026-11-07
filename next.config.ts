import type { NextConfig } from "next";
import os from "os";

function getLocalDevOrigins(): string[] {
  const origins: string[] = [
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
    '10.197.19.206',
    '10.197.19.206:3000',
    '10.47.174.20',
    '10.47.174.20:3000',
    '10.139.228.206',
    '10.139.228.206:3000',
    '10.225.77.206',
    '10.225.77.206:3000',
  ];

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          if (!origins.includes(net.address)) {
            origins.push(net.address);
          }
          const withPort = `${net.address}:3000`;
          if (!origins.includes(withPort)) {
            origins.push(withPort);
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to detect local network interfaces:", err);
  }

  return origins;
}

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: getLocalDevOrigins(),
  output: process.env.VERCEL ? undefined : 'standalone',
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/pdf-parse/**/*'],
  },
};

export default nextConfig;
