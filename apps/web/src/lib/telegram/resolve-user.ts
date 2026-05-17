/**
 * Универсальный резолвер user_id для MiniApp API.
 * - DEV: NODE_ENV !== 'production' + DEV_BYPASS_USER_ID → возвращает этот UUID без проверок.
 * - PROD: валидирует Telegram WebApp initData (HMAC) → ищет profile по telegram_chat_id →
 *   проверяет whitelist (is_whitelisted=TRUE или role IN super_admin/admin/curator).
 *
 * Если пользователь валидный но НЕ в whitelist → возвращает 403 WAITLIST.
 * Клиент обрабатывает это и показывает экран «Скоро откроемся».
 */

import { validateTelegramInitData } from './init-data'
import { createServiceSupabase } from '@/lib/supabase-service'

export type ResolveResult =
  | { ok: true; userId: string; viaDevBypass: boolean }
  | { ok: false; status: number; code: string; message: string }

const PRIVILEGED_ROLES = new Set(['super_admin', 'admin', 'curator'])

export async function resolveUserId(initData: string): Promise<ResolveResult> {
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_USER_ID) {
    return {
      ok: true,
      userId: process.env.DEV_BYPASS_USER_ID,
      viaDevBypass: true,
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return { ok: false, status: 500, code: 'CONFIG_ERROR', message: 'Server configuration error' }
  }

  const validation = validateTelegramInitData(initData, botToken)
  if (!validation.ok) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: validation.reason }
  }

  const supabase = createServiceSupabase()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_whitelisted')
    .eq('telegram_chat_id', validation.chatId)
    .maybeSingle()

  // TEMP DEBUG — remove after fix
  console.log('[resolveUserId DEBUG]', {
    chatId: validation.chatId,
    chatIdType: typeof validation.chatId,
    profileFound: !!profile,
    profile,
    profileError,
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 12),
    nodeEnv: process.env.NODE_ENV,
  })

  if (!profile) {
    return { ok: false, status: 404, code: 'PROFILE_NOT_FOUND', message: 'Profile not found' }
  }

  const isPrivileged = profile.role !== null && PRIVILEGED_ROLES.has(profile.role)
  const isWhitelisted = profile.is_whitelisted === true
  if (!isPrivileged && !isWhitelisted) {
    return {
      ok: false,
      status: 403,
      code: 'WAITLIST',
      message: 'Платформа ещё не открыта публично. Спасибо что ждёшь — мы скоро.',
    }
  }

  return { ok: true, userId: profile.id, viaDevBypass: false }
}
