/**
 * POST /api/m/block-status/[blockId]
 * Статус выполнения блока по дневной модели.
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   closedDays: number,          // закрытых дней (из user_closed_days rpc)
 *   target: 7,
 *   today: {                     // сделано ли каждое из 5 заданий за сегодня
 *     cross: boolean,
 *     prayer: boolean,
 *     recitationAudio: boolean,  // student_block_recitations medium='audio' passed + created_at::date=today
 *     recitationVideo: boolean,  // medium='video_note' passed + created_at::date=today
 *     trainer: boolean,          // student_block_daily_trainer за today
 *   },
 *   quiz: boolean,               // quiz_passed_at IS NOT NULL
 *   friday: boolean,             // student_block_friday_practice exists
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { studentLocalToday } from '@/lib/time/local-day'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  // «Сегодня» — по локальному поясу ученика (день закрывается в 00:00 его пояса)
  const today = await studentLocalToday(supabase, userId)

  // 3. Параллельно: rpc + 5 exists-запросов за сегодня + quiz + friday
  const [
    { data: closedDaysRows },
    { data: crossToday },
    { data: prayerToday },
    { data: recitAudioToday },
    { data: requiredLocs },
    { data: locDoneToday },
    { data: sbp },
    { data: fridayRow },
    { data: maxClosedDateRaw },
    { data: practiceRows },
  ] = await Promise.all([
    // user_closed_days — закрытые дни по каждому блоку
    supabase.rpc('user_closed_days', { p_user_id: userId }) as Promise<{
      data: Array<{ block_id: number; days: number }> | null
    }>,

    // Фото креста за сегодня
    supabase
      .from('student_block_daily_cross')
      .select('submitted_date')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .eq('submitted_date', today)
      .limit(1) as Promise<{ data: Array<{ submitted_date: string }> | null }>,

    // Молитва за сегодня
    supabase
      .from('student_block_daily_prayer')
      .select('prayed_date')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .eq('prayed_date', today)
      .limit(1) as Promise<{ data: Array<{ prayed_date: string }> | null }>,

    // Пересказ аудио: все passed записи (дата = COALESCE(effective_date, created_at::UTC),
    // как в гейте — старые записи имеют effective_date=NULL)
    supabase
      .from('student_block_recitations')
      .select('effective_date, created_at')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .eq('medium', 'audio')
      .eq('passed', true) as Promise<{
      data: Array<{ effective_date: string | null; created_at: string }> | null
    }>,

    // Обязательные стихи-ВИДЕО блока (practice_mode IS NULL — аудио-притчи не входят
    // в видео-местописания, иначе день никогда не закрылся бы)
    supabase
      .from('block_locations_to_recite')
      .select('id')
      .eq('block_id', blockId)
      .eq('is_required', true)
      .is('practice_mode', null) as Promise<{ data: Array<{ id: string }> | null }>,

    // Местописания (видеокружок): все passed записи (дата = COALESCE(effective_date, created_at::UTC))
    supabase
      .from('student_location_attempts')
      .select('location_id, effective_date, created_at')
      .eq('user_id', userId)
      .eq('medium', 'video_note')
      .eq('passed', true) as Promise<{
      data: Array<{ location_id: string; effective_date: string | null; created_at: string }> | null
    }>,

    // Квиз
    supabase
      .from('student_block_progress')
      .select('quiz_passed_at')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle() as Promise<{ data: { quiz_passed_at: string | null } | null }>,

    // Эпоха пятницы
    supabase
      .from('student_block_friday_practice')
      .select('id')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .limit(1) as Promise<{ data: Array<{ id: string }> | null }>,

    // Последняя полностью закрытая дата по всем блокам — для дневного гейта
    supabase.rpc('user_max_closed_date', { p_user_id: userId }) as Promise<{
      data: string | null
    }>,

    // Независимые счётчики дней по 4 практикам (для разбивки прогресса)
    supabase.rpc('user_practice_day_counts', { p_user_id: userId }) as Promise<{
      data: Array<{
        block_id: number
        cross_days: number
        prayer_days: number
        recv_days: number
        loc_days: number
        loc_required: boolean
      }> | null
    }>,
  ])

  // 4. Подсчёт закрытых дней для текущего блока
  const closedDaysRow = (closedDaysRows ?? []).find(
    (r: { block_id: number; days: number }) => r.block_id === blockId,
  )
  const closedDays = closedDaysRow ? Number(closedDaysRow.days) : 0

  // Дата записи = COALESCE(effective_date, UTC-дата created_at) — ровно как в гейте.
  const recDate = (r: { effective_date: string | null; created_at: string }): string =>
    r.effective_date ?? new Date(r.created_at).toISOString().slice(0, 10)

  // 5. Пересказ сегодня + местописания сегодня (все обязательные видео закрыты)
  const pereskazToday = (recitAudioToday ?? []).some((r) => recDate(r) === today)

  const requiredIds = new Set((requiredLocs ?? []).map((r: { id: string }) => r.id))
  const doneTodayIds = new Set(
    (locDoneToday ?? []).filter((r) => recDate(r) === today).map((r) => r.location_id),
  )
  const mestopisaniyaToday =
    requiredIds.size > 0 && [...requiredIds].every((id) => doneTodayIds.has(id))

  // 6. Статусы «сделано сегодня».
  const todayStatus = {
    cross: (crossToday?.length ?? 0) > 0,
    prayer: (prayerToday?.length ?? 0) > 0,
    pereskaz: pereskazToday,
    mestopisaniya: mestopisaniyaToday,
  }

  const quiz = Boolean(sbp?.quiz_passed_at)
  const friday = (fridayRow?.length ?? 0) > 0

  // Дневной гейт: действовать сегодня можно, только если localToday строго позже
  // последней полностью закрытой даты (по всем блокам). nextDayLocked → показываем
  // «следующий день откроется в 00:00».
  const maxClosedDate = (maxClosedDateRaw as string | null) ?? null
  const blockComplete = closedDays >= 7
  const canActToday = !blockComplete && (maxClosedDate === null || today > maxClosedDate)
  const nextDayLocked = !blockComplete && maxClosedDate !== null && today <= maxClosedDate

  // Разбивка прогресса по 4 практикам (независимый подсчёт; closedDays = минимум).
  const cap = (n: number) => Math.min(7, Number(n) || 0)
  const pr = (practiceRows ?? []).find((r) => Number(r.block_id) === blockId)
  const progress = {
    cross: cap(pr?.cross_days ?? 0),
    prayer: cap(pr?.prayer_days ?? 0),
    mestopisaniya: cap(pr?.loc_days ?? 0),
    pereskaz: cap(pr?.recv_days ?? 0),
  }

  return NextResponse.json({
    ok: true,
    closedDays,
    target: 7,
    today: todayStatus,
    quiz,
    friday,
    canActToday,
    nextDayLocked,
    progress,
  })
}
