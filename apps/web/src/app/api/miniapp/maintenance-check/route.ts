import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'

export const dynamic = 'force-dynamic'

/**
 * Gate для MiniApp: дёргается из TelegramProvider при маунте.
 * - MAINTENANCE_MODE=false → пускает всех (через resolveUserId, т.е. с
 *   whitelist-проверкой)
 * - MAINTENANCE_MODE=true → дополнительная страховка, не меняет логику
 *   (whitelist всё равно работает в resolveUserId)
 *
 * Whitelist ведётся в БД: profiles.is_whitelisted=TRUE ИЛИ
 * role IN ('super_admin','admin','curator'). Управление через SQL/админку.
 */
export async function POST(request: NextRequest) {
  let initData = ''
  try {
    const body = (await request.json()) as { initData?: string }
    initData = body.initData || ''
  } catch {
    return NextResponse.json({ allowed: false, reason: 'no_init_data' })
  }

  const auth = await resolveUserId(initData)

  if (!auth.ok) {
    return NextResponse.json({
      allowed: false,
      reason: auth.code,
      message: auth.message,
    })
  }

  return NextResponse.json({ allowed: true, viaDevBypass: auth.viaDevBypass })
}
