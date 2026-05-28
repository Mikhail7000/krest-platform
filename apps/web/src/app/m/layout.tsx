import Script from 'next/script'
import { TelegramProvider } from '@/components/telegram/TelegramProvider'
import { ThemeProvider, themeNoFlashScript } from '@/components/theme/ThemeProvider'
import { ThemedBackground } from '@/components/theme/ThemedBackground'
import { MiniAppGate } from './_components/MiniAppGate'
import './miniapp.css'

export const metadata = {
  title: 'КРЕСТ',
  description: 'Платформа управляемого ученичества',
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Ставит data-theme на <html> до отрисовки — без вспышки темы */}
      <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <ThemeProvider>
        <TelegramProvider>
          <div className="miniapp-root">
            <ThemedBackground />
            <div className="miniapp-content">
              <MiniAppGate>{children}</MiniAppGate>
            </div>
          </div>
        </TelegramProvider>
      </ThemeProvider>
    </>
  )
}
