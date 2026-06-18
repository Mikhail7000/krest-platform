/**
 * POST /api/m/locations/[blockId]
 * Список местописаний блока с прогрессом ученика.
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   block_unlocked: boolean,
 *   locked_reason?: 'previous_not_passed' | 'cooldown_7_days',
 *   unlock_at?: string,
 *   can_skip: boolean,
 *   locations: Array<{ id, reference, exact_text, check_mode, topic_label,
 *                       order_index, audio_passed, video_passed,
 *                       audio_attempts, video_attempts }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { isBlockUnlocked } from '@/lib/access/block-gate'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// local interface — medium/created_at пробрасываются для подсчёта recurring-дней
interface LocationAttemptRow {
  location_id: string
  medium: string
  passed: boolean
  created_at: string
}

const DAILY_DAYS_REQUIRED = 7

function dayKey(iso: string): string {
  // YYYY-MM-DD по UTC — достаточно для подсчёта уникальных дней.
  // Локализация по timezone профиля — задача на потом.
  return iso.slice(0, 10)
}

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

  // 3. Block-gate: проверяем, что блок разблокирован для этого пользователя
  if (!(await isBlockUnlocked(userId, blockId))) {
    return err('Этот блок ещё не открыт.', 'BLOCK_LOCKED', 403)
  }

  const supabase = createServiceSupabase()

  // 4. Доступ к местописаниям: либо can_skip_block_lock у профиля (super_admin/тест),
  //    либо квиз блока сдан (quiz_passed_at IS NOT NULL).
  const [{ data: profile }, { data: progress }] = await Promise.all([
    supabase.from('profiles').select('can_skip_block_lock').eq('id', userId).maybeSingle(),
    supabase
      .from('student_block_progress')
      .select('status, quiz_passed_at, locations_passed_at, locations_locked_until')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle(),
  ])

  const canSkip = Boolean(profile?.can_skip_block_lock)
  let locationsUnlocked = canSkip || Boolean(progress?.quiz_passed_at)
  let lockedReason: 'previous_not_passed' | 'cooldown_7_days' | undefined
  let unlockAt: string | undefined

  if (!locationsUnlocked) {
    lockedReason = 'previous_not_passed'
  } else if (!canSkip && progress?.locations_locked_until) {
    const lockedUntil = new Date(progress.locations_locked_until)
    if (lockedUntil > new Date()) {
      lockedReason = 'cooldown_7_days'
      unlockAt = lockedUntil.toISOString()
      locationsUnlocked = false
    }
  }

  // 4. Загрузить местописания блока
  const { data: locations, error: locErr } = await supabase
    .from('block_locations_to_recite')
    .select('id, reference, exact_text, check_mode, topic_label, order_index, is_required, max_record_seconds, practice_mode')
    .eq('block_id', blockId)
    .eq('is_required', true)
    .order('order_index', { ascending: true })

  if (locErr) {
    console.error('[locations/get] fetch error:', locErr)
    return err('Failed to load locations', 'DB_ERROR', 500)
  }

  if (!locations || locations.length === 0) {
    return err('No locations found for this block', 'NO_LOCATIONS', 404)
  }

  // 5. Загрузить попытки ученика по этим местописаниям
  const locationIds = locations.map((l) => l.id)

  // cast через unknown — medium добавлен позже, не в сгенерированных типах
  const { data: attemptsRaw } = await supabase
    .from('student_location_attempts')
    .select('location_id, medium, passed, created_at')
    .eq('user_id', userId)
    .in('location_id', locationIds)

  const attempts = (attemptsRaw ?? []) as LocationAttemptRow[]

  // Агрегируем прогресс по (location_id). Для recurring-режима собираем
  // уникальные дни passed=true; для остального — обычные счётчики этапов.
  interface LocProgress {
    audioPassed: boolean
    videoPassed: boolean
    audioAttempts: number
    videoAttempts: number
    audioPassedDays: Set<string>
    todayHasPassedAudio: boolean
  }
  const progressMap = new Map<string, LocProgress>()
  const todayKey = dayKey(new Date().toISOString())

  for (const attempt of attempts) {
    const key = attempt.location_id
    const cur = progressMap.get(key) ?? {
      audioPassed: false,
      videoPassed: false,
      audioAttempts: 0,
      videoAttempts: 0,
      audioPassedDays: new Set<string>(),
      todayHasPassedAudio: false,
    }

    if (attempt.medium === 'audio') {
      cur.audioAttempts += 1
      if (attempt.passed) {
        cur.audioPassed = true
        const d = dayKey(attempt.created_at)
        cur.audioPassedDays.add(d)
        if (d === todayKey) cur.todayHasPassedAudio = true
      }
    } else if (attempt.medium === 'video_note') {
      cur.videoAttempts += 1
      if (attempt.passed) cur.videoPassed = true
    }

    progressMap.set(key, cur)
  }

  // 6. Собрать ответ
  const locationsWithProgress = locations.map((loc) => {
    const prog = progressMap.get(loc.id) ?? {
      audioPassed: false,
      videoPassed: false,
      audioAttempts: 0,
      videoAttempts: 0,
      audioPassedDays: new Set<string>(),
      todayHasPassedAudio: false,
    }

    // cast через unknown — max_record_seconds + practice_mode добавлены миграциями,
    // ещё не в сгенерированных types.ts
    const locExt = loc as unknown as {
      max_record_seconds?: number | null
      practice_mode?: string | null
    }
    const practiceMode = locExt.practice_mode ?? null
    return {
      id: loc.id,
      reference: loc.reference,
      exact_text: loc.exact_text,
      check_mode: loc.check_mode,
      topic_label: loc.topic_label ?? null,
      order_index: loc.order_index,
      max_record_seconds: locExt.max_record_seconds ?? 60,
      practice_mode: practiceMode,
      audio_passed: prog.audioPassed,
      video_passed: prog.videoPassed,
      audio_attempts: prog.audioAttempts,
      video_attempts: prog.videoAttempts,
      // recurring-режим: число уникальных дней с passed=true, цель и отметка сегодня
      // Тестировщику (canSkip) неделя засчитывается целиком — но только после первой
      // успешной сдачи (нужно реально проверить хотя бы одну запись)
      daily_days_passed:
        canSkip && practiceMode === 'daily_understanding' && prog.audioPassedDays.size >= 1
          ? DAILY_DAYS_REQUIRED
          : prog.audioPassedDays.size,
      daily_days_required: practiceMode === 'daily_understanding' ? DAILY_DAYS_REQUIRED : null,
      today_done: prog.todayHasPassedAudio,
    }
  })

  return NextResponse.json({
    ok: true,
    block_unlocked: locationsUnlocked,
    ...(lockedReason ? { locked_reason: lockedReason } : {}),
    ...(unlockAt ? { unlock_at: unlockAt } : {}),
    can_skip: canSkip,
    locations: locationsWithProgress,
  })
}
