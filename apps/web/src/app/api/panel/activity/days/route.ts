import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { resolveIsOwner } from '@/lib/admin/owner'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/activity/days  { userIds: string[] }
 * Поденная активность выбранных учеников (что выполнено в какой день).
 * Видимость как везде в панели: владелец — все (вкл. скрытых); админ — без скрытых;
 * куратор — только свои (curator_id===session.uid). Невидимые id молча отбрасываются.
 */
interface DayRow {
  user_id: string
  d: string
  opened: boolean
  cross_done: boolean
  prayer_done: boolean
  recit_done: boolean
  loc_done: boolean
  quiz_done: boolean
}

export async function POST(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { userIds?: unknown }
  const ids = Array.isArray(body.userIds)
    ? (body.userIds.filter((x) => typeof x === 'string') as string[]).slice(0, 50)
    : []
  if (ids.length === 0) return NextResponse.json({ ok: true, students: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const scopeCuratorId: string | null = session.role === 'curator' ? session.uid : null
  const isOwner = scopeCuratorId ? false : await resolveIsOwner(supabase, session.uid)

  // Оставляем только видимых вызывающему учеников.
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, full_name, role, curator_id, hidden_from_tracking')
    .in('id', ids)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visible = ((profs ?? []) as any[]).filter(
    (p) =>
      p.role === 'student' &&
      (scopeCuratorId ? p.curator_id === scopeCuratorId : isOwner || !p.hidden_from_tracking),
  )
  if (visible.length === 0) return NextResponse.json({ ok: true, students: [] })

  const visibleIds: string[] = visible.map((p) => p.id)
  const nameById = new Map<string, string | null>(visible.map((p) => [p.id, p.full_name]))

  const { data: daysRaw, error } = await supabase.rpc('student_days', { p_user_ids: visibleIds })
  if (error) {
    console.error('[panel/activity/days] rpc', error)
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки активности' }, { status: 500 })
  }

  const byUser = new Map<string, unknown[]>()
  for (const r of (daysRaw ?? []) as DayRow[]) {
    const arr = byUser.get(r.user_id) ?? []
    arr.push({
      date: r.d,
      opened: r.opened,
      cross: r.cross_done,
      prayer: r.prayer_done,
      recit: r.recit_done,
      loc: r.loc_done,
      quiz: r.quiz_done,
      closed: r.cross_done && r.prayer_done && r.recit_done && r.loc_done,
    })
    byUser.set(r.user_id, arr)
  }

  const students = visibleIds.map((id) => ({
    id,
    name: nameById.get(id) ?? null,
    days: byUser.get(id) ?? [],
  }))

  return NextResponse.json({ ok: true, students })
}
