import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { computeActivity } from '@/lib/activity/streak'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

// Скрытые из трекинга профили (тихий доступ — не показываем никому в списке)
const HIDDEN_IDS = new Set(['314c6920-cb80-471b-9869-770dfb1bd86e'])

/**
 * POST /api/m/tracking  { initData }
 * Список участников теста с прогрессом — все видят друг друга (наглядность).
 * Участники = профили, чей @username есть в testing_whitelist (Оля туда не входит → скрыта).
 */
export async function POST(request: NextRequest) {
  const { initData } = (await request.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const supabase = createServiceSupabase()

  // 1. Белый список → набор @username (lower)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wl } = await (supabase as any).from('testing_whitelist').select('telegram_username')
  const handles = new Set(
    ((wl ?? []) as { telegram_username: string }[]).map((r) => r.telegram_username.toLowerCase()),
  )

  // 2. Профили-участники теста (по username, без скрытых)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profs } = await (supabase as any).from('profiles').select('id, full_name, contact_info, role')
  type Prof = { id: string; full_name: string | null; contact_info: string | null; role: string }
  const participants = ((profs ?? []) as Prof[]).filter(
    (p) => p.contact_info && handles.has(p.contact_info.toLowerCase()) && !HIDDEN_IDS.has(p.id),
  )
  const ids = participants.map((p) => p.id)
  if (ids.length === 0) return NextResponse.json({ ok: true, list: [] })

  // 3. Всего блоков курса
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('blocks')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', 1)
  const total = count ?? 10

  // 4. Прогресс по блокам (батч)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bp } = await (supabase as any)
    .from('student_block_progress')
    .select('user_id, block_passed_at')
    .in('user_id', ids)
  const passedByUser = new Map<string, number>()
  for (const r of (bp ?? []) as { user_id: string; block_passed_at: string | null }[]) {
    if (r.block_passed_at) passedByUser.set(r.user_id, (passedByUser.get(r.user_id) ?? 0) + 1)
  }

  // 5. Заходы за 14 дней (батч)
  const since = addDaysStr(baliToday(), -14)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: act } = await (supabase as any)
    .from('student_daily_activity')
    .select('user_id, activity_date')
    .eq('opened', true)
    .gte('activity_date', since)
    .in('user_id', ids)
  const openedByUser = new Map<string, string[]>()
  for (const r of (act ?? []) as { user_id: string; activity_date: string }[]) {
    const arr = openedByUser.get(r.user_id) ?? []
    arr.push(r.activity_date)
    openedByUser.set(r.user_id, arr)
  }

  const roleLabel = (role: string) =>
    role === 'curator' ? 'Куратор' : role === 'student' ? 'Ученик' : 'Команда'

  const list = participants
    .map((p) => {
      const passed = passedByUser.get(p.id) ?? 0
      const activity = computeActivity(openedByUser.get(p.id) ?? [], [], 7)
      return {
        id: p.id,
        name: (p.full_name ?? '').trim() || p.contact_info || 'Ученик',
        is_self: p.id === auth.userId,
        role: roleLabel(p.role),
        block: Math.min(total, passed + 1),
        total,
        pct: Math.round((passed / total) * 100),
        days_left: (total - passed) * 7,
        streak: activity.streak,
        opened_today: activity.openedToday,
        days: activity.days.map((d) => d.on),
      }
    })
    .sort((a, b) => b.pct - a.pct || b.streak - a.streak)

  return NextResponse.json({ ok: true, list })
}
