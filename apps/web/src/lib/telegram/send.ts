// Отправка сообщения в Telegram-чат. Общий хелпер (используется в кронах,
// уведомлениях и т.д.). Бот-токен — TELEGRAM_BOT_TOKEN.

interface SendOptions {
  /** Добавить кнопку «Открыть КРЕСТ» (Mini App). */
  withMiniAppButton?: boolean
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: SendOptions,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }

  if (options?.withMiniAppButton) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://krest-platform-web.vercel.app'
    body.reply_markup = {
      inline_keyboard: [[{ text: '✝️ Открыть КРЕСТ', web_app: { url: `${baseUrl}/m/dashboard` } }]],
    }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('Telegram sendMessage failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (error) {
    console.error('Failed to send Telegram message:', error)
    return false
  }
}
