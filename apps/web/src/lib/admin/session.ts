import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Подписанная cookie-сессия админ-дашборда (/panel).
 * Формат токена: base64url(payload) + "." + HMAC_SHA256(payload).
 * Секрет: ADMIN_SESSION_SECRET (fallback — TELEGRAM_BOT_TOKEN).
 */

export const ADMIN_COOKIE = 'krest_admin'
export const ADMIN_COOKIE_MAXAGE = 60 * 60 * 24 * 7 // 7 дней

// View-as: отдельная подписанная cookie-наложение. Реальная сессия (krest_admin)
// сохраняется; view-as применяется ТОЛЬКО если реальная роль super_admin и `by`
// совпадает с реальным uid. Короткий срок жизни — режим временный.
export const VIEW_AS_COOKIE = 'krest_view_as'
export const VIEW_AS_MAXAGE = 60 * 60 * 2 // 2 часа

export type AdminRole = 'admin' | 'super_admin' | 'curator'

export function isCuratorRole(r: AdminRole): boolean {
  return r === 'curator'
}

export interface AdminSession {
  uid: string
  role: AdminRole
  name: string | null
  exp: number
  /** Если задан — это режим view-as: реальный (super_admin) uid, смотрящий «как» uid. */
  via?: string
  viaName?: string | null
}

/** Полезная нагрузка view-as cookie: цель (t*) + кто включил (by, super_admin uid). */
export interface ViewAsToken {
  tuid: string
  trole: AdminRole
  tname: string | null
  by: string
  byName: string | null
  exp: number
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN || 'dev-secret-change-me'
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function signSession(s: { uid: string; role: AdminRole; name: string | null }): string {
  const payload: AdminSession = {
    uid: s.uid,
    role: s.role,
    name: s.name,
    exp: Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAXAGE,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

/**
 * Короткоживущий токен (10 мин) для входа по ссылке из Telegram-бота.
 * Формат тот же, что у сессии → проверяется тем же verifySession.
 */
export function signLoginToken(s: { uid: string; role: AdminRole; name: string | null }): string {
  const payload: AdminSession = {
    uid: s.uid,
    role: s.role,
    name: s.name,
    exp: Math.floor(Date.now() / 1000) + 600,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

/** Подписать view-as токен (включает super_admin → открыть панель цели). */
export function signViewAs(s: {
  tuid: string
  trole: AdminRole
  tname: string | null
  by: string
  byName: string | null
}): string {
  const payload: ViewAsToken = {
    tuid: s.tuid,
    trole: s.trole,
    tname: s.tname,
    by: s.by,
    byName: s.byName,
    exp: Math.floor(Date.now() / 1000) + VIEW_AS_MAXAGE,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyViewAs(token: string | undefined | null): ViewAsToken | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(sign(body))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as ViewAsToken
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!payload.tuid || !payload.by) return null
    return payload
  } catch {
    return null
  }
}

export function verifySession(token: string | undefined | null): AdminSession | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as AdminSession
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
