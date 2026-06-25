/**
 * POST /api/m/cross-photo/[blockId]
 * Состояние ежедневных фото крестов — СЧЁТЧИК-модель (канон 2026-06-25).
 *
 * Никаких фиксированных будущих дат: дни идут по одному, следующий открывается
 * только с 00:00 следующих суток по поясу ученика (см. lib/m/day-gate.ts).
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   closed_days: number,            // закрытых дней блока (все 4 практики)
 *   target: 7,
 *   block_complete: boolean,
 *   today: string,                  // локальная дата ученика YYYY-MM-DD
 *   today_done: boolean,            // фото за сегодня уже загружено
 *   can_submit_today: boolean,      // можно загрузить фото за сегодня
 *   next_day_locked: boolean,       // следующий день откроется в 00:00
 *   photo_days: number,             // уникальных дней с фото
 *   days: Array<{
 *     index: number,                // 1..7
 *     state: 'done' | 'today' | 'waiting' | 'future',
 *     date: string | null,          // только для done/today
 *     photo_url: string | null,
 *   }>,
 *   test_mode?: boolean,
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { loadDayGate, DAY_TARGET } from '@/lib/m/day-gate'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// local interface — table not yet in generated types
interface DailyCrossRow {
  submitted_date: string
  storage_path: string
}

type DayState = 'done' | 'today' | 'waiting' | 'future'

interface DayRow {
  index: number
  state: DayState
  date: string | null
  photo_url: string | null
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

  const supabase = createServiceSupabase()

  // 3. Дневной гейт (локальная дата, закрытые дни, можно ли действовать сегодня)
  const [gate, { data: profile }, { data: rowsRaw, error: fetchErr }] = await Promise.all([
    loadDayGate(supabase, userId, blockId),
    supabase.from('profiles').select('can_skip_block_lock').eq('id', userId).maybeSingle(),
    (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: unknown) => {
            eq: (col: string, val: unknown) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{
                data: DailyCrossRow[] | null
                error: unknown
              }>
            }
          }
        }
      }
    })
      .from('student_block_daily_cross')
      .select('submitted_date, storage_path')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .order('submitted_date', { ascending: true }),
  ])

  if (fetchErr) {
    console.error('[cross-photo/state] fetch error:', fetchErr)
    return err('Failed to load cross photos', 'DB_ERROR', 500)
  }

  const rows = (rowsRaw ?? []) as DailyCrossRow[]

  // 4. Уникальные даты с фото (по возрастанию) + путь к файлу
  const pathByDate = new Map<string, string>()
  for (const r of rows) {
    if (!pathByDate.has(r.submitted_date)) pathByDate.set(r.submitted_date, r.storage_path)
  }
  const photoDates = [...pathByDate.keys()].sort() // YYYY-MM-DD лексикографически = хронологически
  const todayDone = pathByDate.has(gate.localToday)
  const canSubmitToday = gate.canActToday && !todayDone

  // 5. Подписываем URL для submitted дней (bucket private)
  const submittedPaths = [...pathByDate.values()]
  const urlByPath = new Map<string, string>()
  if (submittedPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('student-cross-photos')
      .createSignedUrls(submittedPaths, 60 * 60)
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl)
    }
  }

  // 6. Строим список дней: [done…] + [today | waiting] + [future…] до 7.
  // Виртуальные даты ускоренного тест-режима (якорь 2000-01-..) не показываем —
  // для accel-тестировщика день идёт по счётчику, реальной даты у него нет.
  const isVirtual = (d: string) => d.startsWith('2000-')

  const days: DayRow[] = []
  for (let i = 0; i < photoDates.length; i++) {
    const date = photoDates[i]
    const path = pathByDate.get(date) ?? null
    days.push({
      index: i + 1,
      state: 'done',
      date: isVirtual(date) ? null : date,
      photo_url: path ? urlByPath.get(path) ?? null : null,
    })
  }
  if (!gate.blockComplete) {
    // Следующий слот: сегодня (можно сдать) ИЛИ ожидание (фото за сегодня уже сдано /
    // первый день нового блока — откроется в 00:00 след. суток).
    const nextState: DayState = canSubmitToday ? 'today' : 'waiting'
    days.push({
      index: days.length + 1,
      state: nextState,
      date: nextState === 'today' ? gate.localToday : null,
      photo_url: null,
    })
    // заполняем оставшиеся слоты до 7 как future (без дат — открываются по одному)
    while (days.length < DAY_TARGET) {
      days.push({ index: days.length + 1, state: 'future', date: null, photo_url: null })
    }
  }

  // Тестировщику (can_skip_block_lock) неделя засчитывается целиком — но только
  // после первой загрузки фото (нужно реально проверить хотя бы одно фото)
  const isTester = Boolean((profile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)
  const weekCounted = isTester && rows.length >= 1

  return NextResponse.json({
    ok: true,
    closed_days: gate.closedDays,
    target: DAY_TARGET,
    block_complete: gate.blockComplete,
    today: gate.localToday,
    today_done: todayDone,
    can_submit_today: canSubmitToday,
    next_day_locked: gate.nextDayLocked,
    photo_days: weekCounted ? DAY_TARGET : photoDates.length,
    days,
    test_mode: weekCounted,
  })
}
