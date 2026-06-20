// Отправка сообщений через Telegram Bot API. Общий хелпер.
// Бот-токен — TELEGRAM_BOT_TOKEN.

type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } }
  | { text: string; url: string }

interface SendOptions {
  /** Добавить кнопку «Открыть КРЕСТ» (Mini App). */
  withMiniAppButton?: boolean
  /** Произвольный inline_keyboard (переопределяет withMiniAppButton). */
  inlineKeyboard?: InlineKeyboardButton[][]
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

  if (options?.inlineKeyboard) {
    body.reply_markup = { inline_keyboard: options.inlineKeyboard }
  } else if (options?.withMiniAppButton) {
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

/** Ответ на callback_query (обязателен, иначе Telegram крутит спиннер). */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    })
  } catch (err) {
    console.error('answerCallbackQuery failed:', err)
  }
}

/** Редактирование текста уже отправленного сообщения. */
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
      }),
    })
    if (!res.ok) {
      console.error('editMessageText failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('editMessageText error:', err)
  }
}
