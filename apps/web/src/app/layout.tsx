import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'КРЕСТ — Платформа ученичества',
  description: 'Управляемое ученичество для русскоязычных церквей',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: Telegram WebApp SDK (telegram-web-app.js) инжектит
    // на <html> inline-стили --tg-viewport-height/--tg-viewport-stable-height,
    // которых нет в SSR-разметке → ожидаемый клиент-серверный mismatch на этом узле.
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
