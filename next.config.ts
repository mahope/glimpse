import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: 'standalone',
  
  experimental: {
    // Turbopack is stable in Next.js 16, no need for experimental config
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
}

export default nextConfig