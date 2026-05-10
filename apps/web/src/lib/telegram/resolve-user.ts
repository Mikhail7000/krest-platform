/**
 * Универсальный резолвер user_id для MiniApp API:
 * - Проверяет Telegram WebApp initData (HMAC).
 * - В development mode + DEV_BYPASS_USER_ID — возвращает этот UUID без валидации.
 *
 * Используется в /api/m/* эндпоинтах вместо прямого validateTelegramInitData,
 * чтобы можно было тестировать MiniApp в обычном браузере локально.
 */

import { validateTelegramInitData } from './init-data'
import { createServiceSupabase } from '@/lib/supabase-service'

export type ResolveResult =
  | { ok: true; userId: string; viaDevBypass: boolean }
  | { ok: false; status: number; code: string; message: string }

export async function resolveUserId(initData: string): Promise<ResolveResult> {
  // Dev-bypass — только если NODE_ENV !== 'production' и переменная задана
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', validation.chatId)
    .maybeSingle()

  if (!profile) {
    return { ok: false, status: 404, code: 'PROFILE_NOT_FOUND', message: 'Profile not found' }
  }

  return { ok: true, userId: profile.id, viaDevBypass: false }
}
