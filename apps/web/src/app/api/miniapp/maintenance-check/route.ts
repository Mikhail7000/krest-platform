import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram/init-data'
import { ensureWhitelistedProfile } from '@/lib/telegram/ensure-profile'

export const dynamic = 'force-dynamic'

/**
 * Gate для MiniApp: дёргается из TelegramProvider при маунте (один раз за вход).
 *
 * Доступ ведётся по username в testing_whitelist. При первом входе whitelisted
 * пользователя здесь же создаётся профиль и слот привязывается к chat_id
 * (см. ensureWhitelistedProfile). Дальше API-запросы /m/* проходят resolveUserId
 * по уже существующему профилю (is_whitelisted=TRUE).
 */
export async function POST(request: NextRequest) {
  let initData = ''
  try {
    const body = (await request.json()) as { initData?: string }
    initData = body.initData || ''
  } catch {
    return NextResponse.json({ allowed: false, reason: 'no_init_data' })
  }

  // DEV-bypass: вне production с заданным DEV_BYPASS_USER_ID пускаем без проверок
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_USER_ID) {
    return NextResponse.json({ allowed: true, viaDevBypass: true })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({
      allowed: false,
      reason: 'CONFIG_ERROR',
      message: 'Server configuration error',
    })
  }

  const validation = validateTelegramInitData(initData, botToken)
  if (!validation.ok) {
    return NextResponse.json({
      allowed: false,
      reason: 'UNAUTHORIZED',
      message: validation.reason,
    })
  }

  const result = await ensureWhitelistedProfile({
    chatId: validation.chatId,
    username: validation.username,
    firstName: validation.firstName,
    lastName: validation.lastName,
  })

  if (!result.ok) {
    return NextResponse.json({
      allowed: false,
      reason: result.code,
      message: result.message,
    })
  }

  return NextResponse.json({ allowed: true })
}
