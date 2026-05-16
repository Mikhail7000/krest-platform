import Script from 'next/script'
import { TelegramProvider } from '@/components/telegram/TelegramProvider'
import './miniapp.css'

export const metadata = {
  title: 'КРЕСТ',
  description: 'Платформа управляемого ученичества',
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <TelegramProvider>
        <div className="miniapp-root">{children}</div>
      </TelegramProvider>
    </>
  )
}
