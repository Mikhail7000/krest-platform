import { createHmac } from 'node:crypto'

export type ValidatedInitData =
  | { ok: true; chatId: number }
  | { ok: false; reason: string }

/**
 * Валидирует Telegram WebApp initData по протоколу HMAC SHA256.
 * Возвращает chat_id юзера при успехе.
 *
 * Описание протокола: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string, botToken: string): ValidatedInitData {
  if (!initData) return { ok: false, reason: 'no_init_data' }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'no_hash' }
  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (computed !== hash) return { ok: false, reason: 'bad_hmac' }

  const userJson = params.get('user')
  if (!userJson) return { ok: false, reason: 'no_user' }

  try {
    const u = JSON.parse(userJson) as { id?: number }
    if (!u.id) return { ok: false, reason: 'bad_user' }
    return { ok: true, chatId: u.id }
  } catch {
    return { ok: false, reason: 'bad_user' }
  }
}
