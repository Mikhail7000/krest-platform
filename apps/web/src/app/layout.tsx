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
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
