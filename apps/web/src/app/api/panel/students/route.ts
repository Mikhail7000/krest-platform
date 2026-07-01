import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { resolveIsOwner } from '@/lib/admin/owner'
import { resolvePanelScope, cityCuratorIds, studentInScope } from '@/lib/admin/scope'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/students
 * Список учеников (role='student') для дашборда админа.
 * Один проход: profiles + карта кураторов + passed_blocks_all() + closed_dates_all().
 * Гард: только admin/super_admin (cookie-сессия), иначе 401.
 */

const MAX_BLOCKS = 10

export interface PanelStudentRow {
  id: string
  fullName: string | null
  contact: string | null
  avatarUrl: string | null
  cityName: string | null
  curatorName: string | null
  curatorId: string | null
  passedBlocks: number
  currentBlock: number
  closedDays: number
  isProtected: boolean
  /** Профиль под личным управлением владельца — менять может только он. */
  locked: boolean
  hidden: boolean
  courseStartedAt: string | null
  createdAt: string | null
  /** Последний заход в приложение (ISO) за 60 дней; null = не заходил. */
  lastActiveAt: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  contact_info: string | null
  role: string | null
  city_id: number | null
  curator_id: string | null
  avatar_path: string | null
  is_protected: boolean | null
  owner_locked: boolean | null
  hidden_from_tracking: boolean | null
  course_started_at: string | null
  created_at: string | null
  cities: { name_ru: string | null } | null
}

function avatarUrl(path: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/avatars/${path}`
}

export async function POST(req: NextRequest) {
  const session = await getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Видимость по роли: куратор → свои ученики; лидер города → весь город; admin → все.
  const scope = await resolvePanelScope(supabase, session)

  // 1. Все профили (нужны и кураторы — для карты имён).
  const { data: profilesRaw, error: profErr } = await supabase
    .from('profiles')
    .select(
      'id, full_name, contact_info, role, city_id, curator_id, avatar_path, is_protected, owner_locked, hidden_from_tracking, course_started_at, created_at, cities(name_ru)',
    )
    .order('created_at', { ascending: false })

  if (profErr) {
    console.error('[panel/students] profiles', profErr)
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }

  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const nameById = new Map<string, string | null>()
  for (const p of profiles) nameById.set(p.id, p.full_name)
  // Для scope лидера города — id кураторов его города.
  const cityCurators = scope.scopeCityId != null ? cityCuratorIds(profiles, scope.scopeCityId) : null

  // 2. Сданные блоки всех учеников одним запросом.
  const passedById = new Map<string, number>()
  const { data: passedRaw, error: passedErr } = await supabase.rpc('passed_blocks_all')
  if (passedErr) console.error('[panel/students] passed_blocks_all', passedErr)
  for (const r of (passedRaw ?? []) as { user_id: string; blocks_passed: number }[]) {
    passedById.set(r.user_id, r.blocks_passed ?? 0)
  }

  // 3. Закрытые дни всех учеников одним запросом (всего по курсу — без разбивки по блокам).
  const closedById = new Map<string, number>()
  const { data: closedRaw, error: closedErr } = await supabase.rpc('closed_dates_all')
  if (closedErr) console.error('[panel/students] closed_dates_all', closedErr)
  for (const r of (closedRaw ?? []) as { user_id: string; d: string }[]) {
    closedById.set(r.user_id, (closedById.get(r.user_id) ?? 0) + 1)
  }

  // 4. Последний заход (окно 60 дней — не тянуть всю историю; старше = «давно»).
  const sinceIso = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)
  const lastActiveById = new Map<string, string>()
  const { data: actRaw } = await supabase
    .from('student_daily_activity')
    .select('user_id, opened_at')
    .eq('opened', true)
    .gte('activity_date', sinceIso)
  for (const a of (actRaw ?? []) as { user_id: string; opened_at: string | null }[]) {
    if (!a.opened_at) continue
    const cur = lastActiveById.get(a.user_id)
    if (!cur || a.opened_at > cur) lastActiveById.set(a.user_id, a.opened_at)
  }

  const rows: PanelStudentRow[] = profiles
    .filter((p) => p.role === 'student' && studentInScope(p as ProfileRow, scope, cityCurators))
    .map((p) => {
      const passed = passedById.get(p.id) ?? 0
      return {
        id: p.id,
        fullName: p.full_name,
        contact: p.contact_info,
        avatarUrl: avatarUrl(p.avatar_path),
        cityName: p.cities?.name_ru ?? null,
        curatorName: p.curator_id ? (nameById.get(p.curator_id) ?? null) : null,
        curatorId: p.curator_id,
        passedBlocks: passed,
        currentBlock: Math.min(passed + 1, MAX_BLOCKS),
        closedDays: closedById.get(p.id) ?? 0,
        isProtected: !!p.is_protected,
        locked: !!p.owner_locked,
        hidden: !!p.hidden_from_tracking,
        courseStartedAt: p.course_started_at,
        createdAt: p.created_at,
        lastActiveAt: lastActiveById.get(p.id) ?? null,
      }
    })

  // Список кураторов для выпадашки «Куратор». admin → все; лидер города → кураторы его
  // города; куратор → пустой (переназначать не может).
  const curators = scope.isAdmin
    ? profiles
        .filter((p) => p.role === 'curator' || p.role === 'admin' || p.role === 'super_admin')
        .map((p) => ({ id: p.id, name: p.full_name, role: p.role }))
    : scope.scopeCityId != null
      ? profiles
          .filter((p) => p.role === 'curator' && p.city_id === scope.scopeCityId)
          .map((p) => ({ id: p.id, name: p.full_name, role: p.role }))
      : []

  // Владелец (is_protected) видит и правит замкнутые (owner_locked) профили; остальным UI
  // показывает замок. Серверные гарды в actions/* не дадут обойти в любом случае.
  const isOwner = await resolveIsOwner(supabase, session.uid)

  return NextResponse.json({ ok: true, students: rows, curators, isOwner })
}
