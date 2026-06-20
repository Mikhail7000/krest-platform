import { createHash, createHmac } from 'node:crypto'

/**
 * Проверка данных Telegram Login Widget (вход на сайт /panel).
 * Документация: https://core.telegram.org/widgets/login#checking-authorization
 *
 * secret_key = SHA256(bot_token); проверяем HMAC по отсортированным полям.
 */

export interface VerifiedLogin {
  ok: true
  id: number
  username: string | null
  firstName: string | null
}

export function verifyTelegramLogin(
  data: Record<string, string>,
  botToken: string,
): VerifiedLogin | { ok: false; reason: string } {
  const { hash, ...fields } = data
  if (!hash) return { ok: false, reason: 'Нет hash' }

  const dataCheckString = Object.keys(fields)
    .filter((k) => fields[k] !== undefined && fields[k] !== '')
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')

  const secret = createHash('sha256').update(botToken).digest()
  const computed = createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (computed !== hash) return { ok: false, reason: 'Подпись не сходится' }

  const authDate = parseInt(fields.auth_date ?? '0', 10)
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return { ok: false, reason: 'Ссылка входа устарела' }
  }

  const id = parseInt(fields.id ?? '0', 10)
  if (!id) return { ok: false, reason: 'Нет id' }

  return { ok: true, id, username: fields.username ?? null, firstName: fields.first_name ?? null }
}
