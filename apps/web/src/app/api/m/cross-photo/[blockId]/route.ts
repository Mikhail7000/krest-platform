/**
 * POST /api/m/cross-photo/[blockId]
 * Состояние календаря ежедневных фото крестов.
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   block_unlocked_at: string | null,
 *   today_index: number,          // 1..7 (день с момента block_completed_at), может быть >7
 *   days: Array<{
 *     day_index: number,           // 1..7
 *     date: string (YYYY-MM-DD),
 *     submitted: boolean,
 *     storage_path: string | null,
 *   }>,
 *   completed_count: number,       // кол-во уникальных дней с фото
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// local interfaces — tables not yet in generated types
interface DailyCrossRow {
  submitted_date: string
  storage_path: string
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
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

  // 3. Загружаем progress для получения block_completed_at (= дата разблокировки)
  const { data: progress } = await supabase
    .from('student_block_progress')
    .select('block_completed_at')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .maybeSingle()

  const blockCompletedAt = progress?.block_completed_at ?? null

  // 4. Загружаем записи из student_block_daily_cross
  const { data: rowsRaw, error: fetchErr } = await (supabase as unknown as {
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
    .order('submitted_date', { ascending: true })

  if (fetchErr) {
    console.error('[cross-photo/state] fetch error:', fetchErr)
    return err('Failed to load cross photos', 'DB_ERROR', 500)
  }

  const rows = (rowsRaw ?? []) as DailyCrossRow[]

  // 5. Вычисляем today_index — сколько дней прошло с block_completed_at
  const today = new Date()
  const todayStr = formatDate(today)

  let todayIndex = 1
  if (blockCompletedAt) {
    const startDate = new Date(blockCompletedAt)
    // Разница в полных сутках
    const diffMs = today.setHours(0, 0, 0, 0) - new Date(startDate).setHours(0, 0, 0, 0)
    todayIndex = Math.max(1, Math.floor(diffMs / 86_400_000) + 1)
  }

  // 6. Строим calendar на 7 дней, начиная с block_completed_at
  const submittedMap = new Map<string, string>() // date → storage_path
  for (const row of rows) {
    submittedMap.set(row.submitted_date, row.storage_path)
  }

  const days: Array<{
    day_index: number
    date: string
    submitted: boolean
    storage_path: string | null
  }> = []

  if (blockCompletedAt) {
    const startDate = new Date(blockCompletedAt)
    startDate.setHours(0, 0, 0, 0)
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = formatDate(d)
      const storagePath = submittedMap.get(dateStr) ?? null
      days.push({
        day_index: i + 1,
        date: dateStr,
        submitted: submittedMap.has(dateStr),
        storage_path: storagePath,
      })
    }
  } else {
    // Блок ещё не разблокирован — показываем 7 пустых слотов начиная с сегодня
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      days.push({
        day_index: i + 1,
        date: formatDate(d),
        submitted: false,
        storage_path: null,
      })
    }
  }

  // 7. Добавляем сегодняшний день, если он за пределами 7 дней (>7)
  // Это нужно, если ученик ещё не загрузил фото за сегодня после дня 7
  if (todayIndex > 7) {
    const alreadyInDays = days.some((d) => d.date === todayStr)
    if (!alreadyInDays) {
      days.push({
        day_index: todayIndex,
        date: todayStr,
        submitted: submittedMap.has(todayStr),
        storage_path: submittedMap.get(todayStr) ?? null,
      })
    }
  }

  const completedCount = rows.length

  return NextResponse.json({
    ok: true,
    block_unlocked_at: blockCompletedAt,
    today_index: todayIndex,
    days,
    completed_count: completedCount,
  })
}
