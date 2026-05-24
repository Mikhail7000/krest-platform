import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { loadDashboardData } from '@/app/m/dashboard/loadDashboard'

export const dynamic = 'force-dynamic'

/**
 * POST /api/m/dashboard
 *
 * Состояние дашборда (блоки, прогресс, разблокировка) для текущего пользователя.
 * Body: { initData }
 *
 * Аутентификация — Telegram initData + resolveUserId (как весь /m/*).
 * Прогресс считается по реальному userId, поэтому у каждого ученика — свой.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const data = await loadDashboardData(auth.userId)
  return NextResponse.json(data)
}
