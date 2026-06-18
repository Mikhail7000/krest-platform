/**
 * POST /api/m/block-open/[blockId]
 * Отмечает начало блока: ставит block_unlocked_at (если ещё не стоит).
 * Возвращает прогресс блока для накопительной модели.
 *
 * Body: { initData }
 * Response: { ok, block_unlocked_at, block_passed_at, can_skip,
 *             quiz_passed_at, recitation_audio_passed_at,
 *             recitation_videos_passed_at, cross_days }
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status })
  }

  const { blockId: raw } = await params
  const blockId = parseInt(raw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) {
    return NextResponse.json({ error: { code: 'BAD_BLOCK_ID', message: 'bad block' } }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const userId = auth.userId
  const nowIso = new Date().toISOString()

  const { data: existing } = await supabase
    .from('student_block_progress')
    .select(
      'block_unlocked_at, block_passed_at, quiz_passed_at, recitation_audio_passed_at, recitation_videos_passed_at',
    )
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .maybeSingle()

  let unlockedAt: string | null = existing?.block_unlocked_at ?? null

  if (!existing) {
    await supabase
      .from('student_block_progress')
      .insert({ user_id: userId, block_id: blockId, block_unlocked_at: nowIso, status: 'in_progress' })
    unlockedAt = nowIso
  } else if (!existing.block_unlocked_at) {
    await supabase
      .from('student_block_progress')
      .update({ block_unlocked_at: nowIso })
      .eq('user_id', userId)
      .eq('block_id', blockId)
    unlockedAt = nowIso
  }

  const [{ data: profile }, { data: crossRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('can_skip_block_lock')
      .eq('id', userId)
      .maybeSingle(),
    // Уникальные дни фото креста для этого блока
    supabase
      .from('student_block_daily_cross')
      .select('submitted_date')
      .eq('user_id', userId)
      .eq('block_id', blockId),
  ])

  // Считаем distinct submitted_date в TS
  const crossDays = new Set((crossRows ?? []).map((r: { submitted_date: string }) => r.submitted_date)).size

  return NextResponse.json({
    ok: true,
    block_unlocked_at: unlockedAt,
    block_passed_at: existing?.block_passed_at ?? null,
    can_skip: Boolean(profile?.can_skip_block_lock),
    quiz_passed_at: existing?.quiz_passed_at ?? null,
    recitation_audio_passed_at: existing?.recitation_audio_passed_at ?? null,
    recitation_videos_passed_at: existing?.recitation_videos_passed_at ?? null,
    cross_days: crossDays,
  })
}
