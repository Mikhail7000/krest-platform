import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { resolvePanelScope, studentCardAllowed } from '@/lib/admin/scope'

export const dynamic = 'force-dynamic'

/**
 * GET /api/panel/student/[id]
 * Детальная карточка ученика: профиль + куратор + город + прогресс по каждому блоку
 * (закрыто дней X/7, квиз, сдан ли). Гард: admin/super_admin, иначе 401.
 */

const REQUIRED_DAYS = 7
const MAX_BLOCKS = 10

export interface PanelBlockProgress {
  blockId: number
  orderNum: number
  title: string
  closedDays: number
  done: boolean
}

export interface PanelStudentDetail {
  id: string
  fullName: string | null
  contact: string | null
  avatarUrl: string | null
  cityName: string | null
  curatorName: string | null
  curatorId: string | null
  role: string | null
  isProtected: boolean
  hidden: boolean
  courseStartedAt: string | null
  createdAt: string | null
  passedBlocks: number
  currentBlock: number
  lastActivity: string | null
  blocks: PanelBlockProgress[]
}

function avatarUrl(path: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/avatars/${path}`
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await ctx.params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select(
      'id, full_name, contact_info, role, city_id, curator_id, avatar_path, is_protected, hidden_from_tracking, course_started_at, created_at, cities(name_ru)',
    )
    .eq('id', id)
    .maybeSingle()

  if (profErr) {
    console.error('[panel/student] profile', profErr)
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }

  // Доступ к карточке по роли: куратор — только свои; лидер города — только свой город
  // (по city_id ученика или по городу его куратора); скрытых видит только владелец.
  // 404 (не 403), чтобы не раскрывать существование ученика чужого scope.
  const scope = await resolvePanelScope(supabase, session)
  if (!(await studentCardAllowed(supabase, scope, profile))) {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }

  // Имя куратора.
  let curatorName: string | null = null
  if (profile.curator_id) {
    const { data: cur } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', profile.curator_id)
      .maybeSingle()
    curatorName = cur?.full_name ?? null
  }

  // Список блоков курса (order_num 1..10; служебный 0 пропускаем).
  const { data: blocksRaw } = await supabase
    .from('blocks')
    .select('id, order_num, title_ru')
    .gt('order_num', 0)
    .order('order_num', { ascending: true })

  const blocksMeta = (blocksRaw ?? []) as { id: number; order_num: number; title_ru: string }[]

  // Закрытые дни по блокам.
  const daysByBlock = new Map<number, number>()
  const { data: closedRaw, error: closedErr } = await supabase.rpc('user_closed_days', {
    p_user_id: id,
  })
  if (closedErr) console.error('[panel/student] user_closed_days', closedErr)
  for (const r of (closedRaw ?? []) as { block_id: number; days: number }[]) {
    daysByBlock.set(r.block_id, Number(r.days) || 0)
  }

  // Последняя активность (квизов в модели НЕТ — блок сдан по 7 закрытым дням,
  // как в passed_blocks_all; раньше done требовал quiz_passed_at и блоки с 7/7
  // висели «В работе» вразрез со сводкой «Сдано блоков»).
  let lastActivity: string | null = null
  const { data: sbpRaw } = await supabase
    .from('student_block_progress')
    .select('block_id, updated_at')
    .eq('user_id', id)
  for (const r of (sbpRaw ?? []) as { block_id: number; updated_at: string | null }[]) {
    if (r.updated_at && (!lastActivity || r.updated_at > lastActivity)) lastActivity = r.updated_at
  }

  const blocks: PanelBlockProgress[] = blocksMeta.map((b) => {
    const closedDays = daysByBlock.get(b.id) ?? 0
    return {
      blockId: b.id,
      orderNum: b.order_num,
      title: b.title_ru,
      closedDays,
      done: closedDays >= REQUIRED_DAYS,
    }
  })

  // Сдано блоков из RPC (источник истины для gate).
  let passedBlocks = 0
  const { data: passedRaw } = await supabase.rpc('passed_blocks_all')
  for (const r of (passedRaw ?? []) as { user_id: string; blocks_passed: number }[]) {
    if (r.user_id === id) passedBlocks = r.blocks_passed ?? 0
  }

  const detail: PanelStudentDetail = {
    id: profile.id,
    fullName: profile.full_name,
    contact: profile.contact_info,
    avatarUrl: avatarUrl(profile.avatar_path),
    cityName: profile.cities?.name_ru ?? null,
    curatorName,
    curatorId: profile.curator_id,
    role: profile.role,
    isProtected: !!profile.is_protected,
    hidden: !!profile.hidden_from_tracking,
    courseStartedAt: profile.course_started_at,
    createdAt: profile.created_at,
    passedBlocks,
    currentBlock: Math.min(passedBlocks + 1, MAX_BLOCKS),
    lastActivity,
    blocks,
  }

  return NextResponse.json({ ok: true, student: detail })
}
