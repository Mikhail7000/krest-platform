import { createHmac, timingSafeEqual } from 'node:crypto'

export type ValidatedInitData =
  | { ok: true; chatId: number }
  | { ok: false; reason: string }

const DEFAULT_MAX_AGE_SECONDS = 8 * 60 * 60 // 8 часов = одна учебная сессия (рекомендация Алекса)

/**
 * Валидирует Telegram WebApp initData по протоколу HMAC SHA256.
 * Возвращает chat_id юзера при успехе.
 *
 * - Сравнение HMAC через timingSafeEqual (защита от timing-атак).
 * - Проверка auth_date ≤ 8 часов (защита от replay-атак).
 *
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS,
): ValidatedInitData {
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

  // timingSafeEqual требует одинаковой длины — иначе кидает.
  // Hex-строка hash из Telegram должна быть 64 символа, как и computed.
  let hashBuf: Buffer
  let computedBuf: Buffer
  try {
    hashBuf = Buffer.from(hash, 'hex')
    computedBuf = Buffer.from(computed, 'hex')
  } catch {
    return { ok: false, reason: 'bad_hmac' }
  }
  if (hashBuf.length !== computedBuf.length) return { ok: false, reason: 'bad_hmac' }
  if (!timingSafeEqual(hashBuf, computedBuf)) return { ok: false, reason: 'bad_hmac' }

  // Защита от replay: initData не должен быть старше maxAgeSeconds.
  const authDateRaw = params.get('auth_date')
  if (!authDateRaw) return { ok: false, reason: 'no_auth_date' }
  const authDate = Number(authDateRaw)
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, reason: 'bad_auth_date' }
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, reason: 'expired_auth_date' }
  }

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
