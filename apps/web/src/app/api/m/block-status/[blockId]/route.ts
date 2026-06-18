/**
 * POST /api/m/block-status/[blockId]
 * Сводный статус выполнения практических пунктов блока для Stage4Nav.
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   quiz:        boolean,
 *   locations:   boolean,           // audio + video сданы хотя бы по одному местописанию
 *   recitation:  boolean,           // audio_passed + video_passed
 *   cross_photo: { done: number, target: 7 },
 *   prayer:      { done: number, target: 7 },
 *   friday:      boolean,
 *   emotions:    boolean,           // опциональный: хоть одна запись
 *   completed:   number,            // сколько обязательных пунктов выполнено
 *   total:       number,            // всего обязательных пунктов
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CROSS_TARGET = 7
const PRAYER_TARGET = 7

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// Обязательные пункты для подсчёта completed/total
const REQUIRED_KEYS = ['quiz', 'locations', 'recitation', 'cross_photo', 'prayer', 'friday'] as const

export async function POST(req: NextRequest, { params }: Params) {
  // 1. Auth
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  // 2. blockId
  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('Invalid block id', 'BAD_BLOCK_ID', 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // 3. Параллельно читаем все источники
  const [
    { data: sbp },
    { data: profile },
    { data: crossRows },
    { data: prayerRows },
    { data: fridayRow },
    { data: emotionsRows },
    { data: recitRows },
  ] = await Promise.all([
    // student_block_progress: quiz_passed_at, locations_passed_at,
    // recitation_audio_passed_at, recitation_videos_passed_at, daily_cross_count
    supabase
      .from('student_block_progress')
      .select(
        'quiz_passed_at, locations_passed_at, recitation_audio_passed_at, recitation_videos_passed_at, daily_cross_count',
      )
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle() as Promise<{ data: Record<string, unknown> | null }>,

    // Профиль: can_skip_block_lock (тестовый режим)
    supabase
      .from('profiles')
      .select('can_skip_block_lock')
      .eq('id', userId)
      .maybeSingle() as Promise<{ data: { can_skip_block_lock?: boolean } | null }>,

    // Ежедневные фото креста — считаем уникальные даты
    supabase
      .from('student_block_daily_cross')
      .select('submitted_date')
      .eq('user_id', userId)
      .eq('block_id', blockId) as Promise<{ data: Array<{ submitted_date: string }> | null }>,

    // Ежедневная молитва — считаем уникальные даты
    supabase
      .from('student_block_daily_prayer')
      .select('prayed_date')
      .eq('user_id', userId)
      .eq('block_id', blockId) as Promise<{ data: Array<{ prayed_date: string }> | null }>,

    // Эпоха пятницы
    supabase
      .from('student_block_friday_practice')
      .select('id')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle() as Promise<{ data: { id: string } | null }>,

    // Эмоции (опциональный пункт)
    supabase
      .from('student_block_emotions')
      .select('id')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .limit(1) as Promise<{ data: Array<{ id: string }> | null }>,

    // Пересказ (audio + video_note) — последние passed-записи
    supabase
      .from('student_block_recitations')
      .select('medium, passed')
      .eq('user_id', userId)
      .eq('block_id', blockId) as Promise<{ data: Array<{ medium: string; passed: boolean }> | null }>,
  ])

  const canSkip = Boolean(profile?.can_skip_block_lock)

  // 4. Считаем статусы

  // Quiz
  const quizDone = Boolean((sbp as Record<string, unknown> | null)?.quiz_passed_at)

  // Местописания: locations_passed_at — итоговый флаг в sbp (выставляется после прохождения всех)
  const locationsDone = Boolean((sbp as Record<string, unknown> | null)?.locations_passed_at)

  // Пересказ: audio + video_note должны быть пройдены
  const recitList = (recitRows ?? []) as Array<{ medium: string; passed: boolean }>
  const audioPassed = recitList.some((r) => r.medium === 'audio' && r.passed)
  const videoPassed = recitList.some((r) => r.medium === 'video_note' && r.passed)
  const recitDone = Boolean((sbp as Record<string, unknown> | null)?.recitation_audio_passed_at) || audioPassed
  const recitFullDone =
    (Boolean((sbp as Record<string, unknown> | null)?.recitation_audio_passed_at) || audioPassed) &&
    (Boolean((sbp as Record<string, unknown> | null)?.recitation_videos_passed_at) || videoPassed)

  // Ежедневное фото креста
  const crossCount = crossRows?.length ?? 0
  // Тестировщику засчитываем 7 дней при >= 1 загрузке
  const crossDone = canSkip ? crossCount >= 1 : crossCount >= CROSS_TARGET
  const crossDisplayCount = canSkip && crossCount >= 1 ? CROSS_TARGET : crossCount

  // Молитва
  const prayerCount = prayerRows?.length ?? 0
  const prayerDone = canSkip ? prayerCount >= 1 : prayerCount >= PRAYER_TARGET
  const prayerDisplayCount = canSkip && prayerCount >= 1 ? PRAYER_TARGET : prayerCount

  // Эпоха пятницы
  const fridayDone = Boolean(fridayRow)

  // Эмоции (опциональный)
  const emotionsDone = (emotionsRows?.length ?? 0) > 0

  // 5. Сводка обязательных пунктов
  const statusMap: Record<(typeof REQUIRED_KEYS)[number], boolean> = {
    quiz: quizDone,
    locations: locationsDone,
    recitation: recitFullDone,
    cross_photo: crossDone,
    prayer: prayerDone,
    friday: fridayDone,
  }
  const completed = REQUIRED_KEYS.filter((k) => statusMap[k]).length
  const total = REQUIRED_KEYS.length

  return NextResponse.json({
    ok: true,
    quiz: quizDone,
    locations: locationsDone,
    recitation: recitDone, // audio сдан (ключевой этап)
    recitation_full: recitFullDone, // audio + video оба сданы
    cross_photo: { done: crossDisplayCount, target: CROSS_TARGET },
    prayer: { done: prayerDisplayCount, target: PRAYER_TARGET },
    friday: fridayDone,
    emotions: emotionsDone,
    completed,
    total,
  })
}
