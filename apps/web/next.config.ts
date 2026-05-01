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
    {
      source: '/m/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'ALLOWALL' },
        { key: 'Permissions-Policy', value: 'fullscreen=*' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://kinescope.io https://*.kinescope.io",
            "style-src 'self' 'unsafe-inline' https://kinescope.io https://*.kinescope.io",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data: https://kinescope.io https://*.kinescope.io",
            "connect-src 'self' https://api.anthropic.com https://*.supabase.co https://kinescope.io https://*.kinescope.io",
            "frame-src https://kinescope.io https://*.kinescope.io https://telegram.org",
            "media-src 'self' blob: https://*.supabase.co https://kinescope.io https://*.kinescope.io",
            "worker-src 'self' blob:",
            "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org",
          ].join('; '),
        },
      ],
    },
  ],
}

export default nextConfig
