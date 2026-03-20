import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is now the default in Next.js 16
  serverExternalPackages: [
    '@google/generative-ai',
    '@google/generative-ai/server',
    'googleapis',
    'rimraf',
    'jspdf',
    'fflate',
  ],
  // Exclude only unnecessary files from tracing
  outputFileTracingExcludes: {
    '*': [
      '.git/**',
      '.pnpm-store/**',
      'node_modules/@swc/core-linux-x64-musl/**',
      'node_modules/@swc/core-linux-x64-gnu/**',
      'node_modules/@esbuild/linux-x64/**',
      'node_modules/esbuild-linux-64/**',
      'node_modules/**/test/**',
      'node_modules/**/*.test.{js,jsx,ts,tsx}',
      'node_modules/**/*.spec.{js,jsx,ts,tsx}',
    ],
  },
};

export default nextConfig;
