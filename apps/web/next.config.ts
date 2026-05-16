import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Vercel hard-cap на body Server Actions ~ 4.5 MB всё равно держится,
  // но bodySizeLimit:'5mb' даёт хотя бы небольшой буфер для multipart форм.
  // Большие файлы (>4 MB) — через signed Storage URL, см. /api/m/*/upload-init.
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
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
        { key: 'Permissions-Policy', value: 'fullscreen=*, microphone=*, camera=*' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://kinescope.io https://*.kinescope.io",
            "style-src 'self' 'unsafe-inline' https://kinescope.io https://*.kinescope.io",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data: https://kinescope.io https://*.kinescope.io",
            // connect-src: все наши AI/STT провайдеры + Supabase
            "connect-src 'self' https://api.anthropic.com https://api.openai.com https://api.deepgram.com https://*.supabase.co https://kinescope.io https://*.kinescope.io",
            "frame-src https://kinescope.io https://*.kinescope.io https://telegram.org",
            // media-src: для проигрывания записанных blob (preview кружков) и видео из Storage
            "media-src 'self' blob: https://*.supabase.co https://kinescope.io https://*.kinescope.io",
            "worker-src 'self' blob:",
            // Только Telegram может встраивать MiniApp как iframe
            "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org",
          ].join('; '),
        },
      ],
    },
  ],
}

export default nextConfig
