import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/miniapp/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'ALLOWALL' },
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
        },
      ],
    },
  ],
}

export default nextConfig
