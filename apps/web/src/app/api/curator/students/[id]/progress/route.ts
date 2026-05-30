import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorViaInitData } from '@/lib/curator-auth'
import { computeActivity } from '@/lib/activity/streak'
import { getWorkedDates } from '@/lib/activity/worked'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/curator/students/{student_id}/progress
 * Прогресс ученика по блокам + активность (заходы/действия).
 * Авторизация (Telegram initData): curator (только своих) / admin / super_admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCuratorViaInitData(request.headers.get('x-init-data') ?? '')
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, role, supabase } = auth.curator

  const { id: studentId } = await params
  if (!UUID_RE.test(studentId)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid student_id (must be UUID)' } },
      { status: 400 },
    )
  }

  // Доступ: куратор видит только своих учеников
  if (role === 'curator') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studentProfile } = await (supabase as any)
      .from('profiles')
      .select('id, curator_id')
      .eq('id', studentId)
      .maybeSingle()
    if (!studentProfile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 })
    }
    if (studentProfile.curator_id !== userId) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Student is not in your group' } }, { status: 403 })
    }
  }

  // Прогресс по блокам (реальная таблица student_block_progress)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blockProgress, error: bpError } = await (supabase as any)
    .from('student_block_progress')
    .select('block_id, status, block_completed_at, block_passed_at, quiz_passed_at, locations_passed_at')
    .eq('user_id', studentId)
    .order('block_id', { ascending: true })

  if (bpError) {
    console.error('[curator/students/progress] block_progress error', bpError)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Failed to load block progress' } }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = (blockProgress ?? []).map((bp: any) => ({
    block_id: bp.block_id,
    status: bp.status,
    completed_at: bp.block_completed_at ?? bp.block_passed_at ?? null,
    quiz_passed: !!bp.quiz_passed_at,
    locations_passed: !!bp.locations_passed_at,
    passed: !!bp.block_passed_at,
  }))

  // Активность: заходы + дни реальных действий
  const since = addDaysStr(baliToday(), -30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actRows } = await (supabase as any)
    .from('student_daily_activity')
    .select('activity_date')
    .eq('user_id', studentId)
    .eq('opened', true)
    .gte('activity_date', since)
  const opened = ((actRows ?? []) as { activity_date: string }[]).map((r) => r.activity_date)
  const worked = await getWorkedDates(supabase, studentId, since)
  const activity = computeActivity(opened, worked, 14)

  // Эпоха пятницы — впечатления по блокам
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fridayRows } = await (supabase as any)
    .from('student_block_friday_practice')
    .select('block_id, impressions, updated_at')
    .eq('user_id', studentId)
    .order('block_id', { ascending: true })
  const friday = ((fridayRows ?? []) as { block_id: number; impressions: string | null; updated_at: string }[])
    .filter((r) => r.impressions && r.impressions.trim())
    .map((r) => ({ block_id: r.block_id, impressions: r.impressions as string, updated_at: r.updated_at }))

  // Эмоции и свидетельства — текст/аудио/кружок (с подписанными ссылками на медиа)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emoRows } = await (supabase as any)
    .from('student_block_emotions')
    .select('id, block_id, kind, content_text, storage_path, created_at')
    .eq('user_id', studentId)
    .order('created_at', { ascending: false })
  type EmoRow = { id: string; block_id: number; kind: string; content_text: string | null; storage_path: string | null; created_at: string }
  const emoList = (emoRows ?? []) as EmoRow[]
  const emoPaths = emoList.map((r) => r.storage_path).filter((p): p is string => !!p)
  const urlByPath = new Map<string, string>()
  if (emoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('student-recitations')
      .createSignedUrls(emoPaths, 60 * 60)
    for (const s of (signed ?? []) as { path: string | null; signedUrl: string | null }[]) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
    }
  }
  const emotions = emoList.map((r) => ({
    id: r.id,
    block_id: r.block_id,
    kind: r.kind,
    content_text: r.content_text,
    media_url: r.storage_path ? urlByPath.get(r.storage_path) ?? null : null,
    created_at: r.created_at,
  }))

  return NextResponse.json({
    ok: true,
    data: { student_id: studentId, blocks, activity, friday, emotions },
  })
}
