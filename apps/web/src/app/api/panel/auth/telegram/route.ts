import { NextRequest, NextResponse } from 'next/server'
import { verifyTelegramLogin } from '@/lib/admin/telegram-login'
import { signSession, ADMIN_COOKIE, ADMIN_COOKIE_MAXAGE } from '@/lib/admin/session'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/auth/telegram
 * Тело — объект Telegram Login Widget { id, first_name, username, auth_date, hash, ... }.
 * Проверяем подпись → ищем профиль по telegram_chat_id → требуем роль admin/super_admin
 * → ставим подписанную cookie-сессию krest_admin.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 500 })
  }

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const data: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && v !== undefined) data[k] = String(v)
  }

  const verified = verifyTelegramLogin(data, botToken)
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('telegram_chat_id', verified.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return NextResponse.json(
      { ok: false, error: 'Нет доступа: только администраторы платформы' },
      { status: 403 },
    )
  }

  const token = signSession({
    uid: profile.id,
    role: profile.role,
    name: profile.full_name ?? verified.firstName,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: ADMIN_COOKIE_MAXAGE,
  })
  return res
}
