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

  // 3. Дата разлока блока (откуда отсчитываем 7 дней).
  //    Используем block_unlocked_at из student_block_progress.
  //    Если у пользователя can_skip_block_lock — для удобства тестов считаем,
  //    что блок открылся "сегодня" и календарь начинается с текущей даты.
  const [{ data: profile }, { data: progress }] = await Promise.all([
    supabase.from('profiles').select('can_skip_block_lock').eq('id', userId).maybeSingle(),
    supabase
      .from('student_block_progress')
      .select('block_unlocked_at')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle(),
  ])

  let blockUnlockedAt: string | null = progress?.block_unlocked_at ?? null
  if (!blockUnlockedAt && profile?.can_skip_block_lock) {
    blockUnlockedAt = new Date().toISOString()
  }
  const blockCompletedAt = blockUnlockedAt

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

  // 5. Вычисляем today_index в UTC (хранение в БД — DATE без timezone, формат ISO YYYY-MM-DD).
  const today = new Date()
  const todayStr = formatDate(today)

  let todayIndex = 1
  if (blockCompletedAt) {
    const startDate = new Date(blockCompletedAt)
    startDate.setUTCHours(0, 0, 0, 0)
    const todayUtc = new Date(today)
    todayUtc.setUTCHours(0, 0, 0, 0)
    const diffMs = todayUtc.getTime() - startDate.getTime()
    todayIndex = Math.max(1, Math.floor(diffMs / 86_400_000) + 1)
  }

  // 6. Строим calendar на 7 дней, начиная с block_completed_at (всё в UTC).
  const submittedMap = new Map<string, string>()
  for (const row of rows) {
    submittedMap.set(row.submitted_date, row.storage_path)
  }

  const days: Array<{
    day_index: number
    date: string
    submitted: boolean
    storage_path: string | null
    photo_url: string | null
  }> = []

  if (blockCompletedAt) {
    const startDate = new Date(blockCompletedAt)
    startDate.setUTCHours(0, 0, 0, 0)
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setUTCDate(d.getUTCDate() + i)
      const dateStr = formatDate(d)
      const storagePath = submittedMap.get(dateStr) ?? null
      days.push({
        day_index: i + 1,
        date: dateStr,
        submitted: submittedMap.has(dateStr),
        storage_path: storagePath,
        photo_url: null,
      })
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() + i)
      days.push({
        day_index: i + 1,
        date: formatDate(d),
        submitted: false,
        storage_path: null,
        photo_url: null,
      })
    }
  }

  // 7. Добавляем сегодняшний день, если он за пределами 7 дней (>7)
  if (todayIndex > 7) {
    const alreadyInDays = days.some((d) => d.date === todayStr)
    if (!alreadyInDays) {
      days.push({
        day_index: todayIndex,
        date: todayStr,
        submitted: submittedMap.has(todayStr),
        storage_path: submittedMap.get(todayStr) ?? null,
        photo_url: null,
      })
    }
  }

  // 8. Подписываем URL для каждого submitted дня (bucket private, public-URL не работает).
  const submittedPaths = days
    .map((d) => d.storage_path)
    .filter((p): p is string => Boolean(p))
  if (submittedPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('student-cross-photos')
      .createSignedUrls(submittedPaths, 60 * 60)
    const urlByPath = new Map<string, string>()
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl)
    }
    for (const d of days) {
      if (d.storage_path) d.photo_url = urlByPath.get(d.storage_path) ?? null
    }
  }

  // Тестировщику (can_skip_block_lock) неделя засчитывается целиком — без ожидания 7 дней
  const testMode = Boolean(profile?.can_skip_block_lock)
  const completedCount = testMode ? 7 : rows.length

  return NextResponse.json({
    ok: true,
    block_unlocked_at: blockCompletedAt,
    today_index: todayIndex,
    days,
    completed_count: completedCount,
    test_mode: testMode,
  })
}
