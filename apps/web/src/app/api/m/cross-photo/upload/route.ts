/**
 * POST /api/m/cross-photo/upload
 * Загрузка ежедневного фото нарисованного креста.
 *
 * Body: multipart/form-data
 *   initData  (text)
 *   block_id  (text, integer)
 *   file      (Blob, image/*)
 *
 * Алгоритм:
 *   1. resolveUserId
 *   2. Validate image MIME
 *   3. Upload в student-cross-photos/{user_id}/{block_id}/{YYYY-MM-DD}.{ext}
 *   4. INSERT в student_block_daily_cross — ON CONFLICT (user, block, date) UPDATE storage_path
 *   5. Обновить счётчик (SELECT COUNT)
 *
 * AI содержимое НЕ проверяет — только факт загрузки.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { STUDENT_CROSS_PHOTOS_BUCKET } from '@/lib/ai/constants'
import { checkCrossPhoto } from '@/lib/cross/check'

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

const VALID_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'image/heif',
])

function mimeToExt(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('heic') || mimeType.includes('heif')) return 'heic'
  if (mimeType.includes('webp')) return 'webp'
  return 'jpg'
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// local interface — table not yet in generated types
interface DailyCrossInsert {
  user_id: string
  block_id: number
  submitted_date: string
  storage_path: string
}

export async function POST(req: NextRequest) {
  // 1. Parse multipart
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return err('Invalid multipart body', 'BAD_REQUEST', 400)
  }

  const initData = (formData.get('initData') as string | null) ?? ''
  const blockIdRaw = (formData.get('block_id') as string | null) ?? ''
  const file = formData.get('file') as File | null

  const blockId = parseInt(blockIdRaw, 10)

  // 2. Validate
  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('block_id is required and must be a positive integer', 'BAD_BLOCK_ID', 400)
  }
  if (!file || file.size === 0) {
    return err('file is required', 'NO_FILE', 400)
  }

  const mimeType = file.type || 'image/jpeg'
  // Допускаем image/* — некоторые клиенты могут не установить точный тип
  if (file.type && !VALID_IMAGE_MIMES.has(file.type) && !file.type.startsWith('image/')) {
    return err('file must be an image (jpeg, png, heic, webp)', 'INVALID_MIME', 400)
  }

  // 3. Auth
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const supabase = createServiceSupabase()

  // Тестовый байпас: тестировщику (can_skip_block_lock) засчитываем дни подряд —
  // каждая загрузка = следующий «день» (виртуальная дата = старт + N), без ожидания суток.
  let dateStr = todayDateStr()
  const { data: bypassProfile } = await supabase
    .from('profiles')
    .select('can_skip_block_lock')
    .eq('id', userId)
    .maybeSingle()
  const canSkip = Boolean((bypassProfile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)
  if (canSkip) {
    const { data: prog } = await supabase
      .from('student_block_progress')
      .select('block_unlocked_at')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle()
    const { count: existing } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string, opts: { count: 'exact'; head: boolean }) => {
          eq: (col: string, val: unknown) => {
            eq: (col: string, val: unknown) => Promise<{ count: number | null }>
          }
        }
      }
    })
      .from('student_block_daily_cross')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('block_id', blockId)
    const unlockedAt = (prog as { block_unlocked_at?: string | null } | null)?.block_unlocked_at
    const start = unlockedAt ? new Date(unlockedAt) : new Date()
    start.setUTCHours(0, 0, 0, 0)
    start.setUTCDate(start.getUTCDate() + (existing ?? 0))
    dateStr = start.toISOString().slice(0, 10)
  }

  // 4. Upload to Storage
  const ext = mimeToExt(mimeType)
  const storagePath = `${userId}/${blockId}/${dateStr}.${ext}`

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // upsert=true — перезаписываем если уже было фото за сегодня
  const { error: uploadErr } = await supabase.storage
    .from(STUDENT_CROSS_PHOTOS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadErr) {
    console.error('[cross-photo/upload] storage upload error:', uploadErr)
    return err('Failed to upload photo', 'STORAGE_ERROR', 500)
  }

  // 5. INSERT student_block_daily_cross — UPSERT по UNIQUE (user, block, date)
  const insertRow: DailyCrossInsert = {
    user_id: userId,
    block_id: blockId,
    submitted_date: dateStr,
    storage_path: storagePath,
  }

  // cast через unknown — таблица не в сгенерированных типах
  const { error: upsertErr } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (
        row: DailyCrossInsert,
        opts: { onConflict: string },
      ) => Promise<{ error: unknown }>
    }
  })
    .from('student_block_daily_cross')
    .upsert(insertRow, { onConflict: 'user_id,block_id,submitted_date' })

  if (upsertErr) {
    console.error('[cross-photo/upload] upsert error:', upsertErr)
    return err('Failed to save photo record', 'DB_ERROR', 500)
  }

  // 6. Считаем итоговый счётчик загруженных дней
  const { count: countResult } = await (supabase as unknown as {
    from: (t: string) => {
      select: (
        cols: string,
        opts: { count: 'exact'; head: boolean },
      ) => {
        eq: (col: string, val: unknown) => {
          eq: (col: string, val: unknown) => Promise<{ count: number | null; error: unknown }>
        }
      }
    }
  })
    .from('student_block_daily_cross')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('block_id', blockId)

  const completedCount = countResult ?? 0

  await supabase
    .from('student_block_progress')
    .update({ daily_cross_count: completedCount })
    .eq('user_id', userId)
    .eq('block_id', blockId)

  // Подписываем URL для немедленного показа превью на клиенте (bucket private).
  const { data: signed } = await supabase.storage
    .from(STUDENT_CROSS_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  const photoUrl = signed?.signedUrl ?? null

  // ИИ-проверка «креста блока» по фото (мягко, не блокирует). HEIC пропускаем —
  // vision принимает jpeg/png/webp/gif.
  let aiFeedback: string | null = null
  let aiMatched: boolean | null = null
  const VISION_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  if (VISION_MIMES.has(mimeType)) {
    try {
      const { data: blk } = await supabase
        .from('blocks')
        .select('order_num, title_ru')
        .eq('id', blockId)
        .maybeSingle()
      const order = (blk as { order_num?: number } | null)?.order_num ?? blockId
      const title = (blk as { title_ru?: string } | null)?.title_ru ?? `Блок ${blockId}`
      const r = await checkCrossPhoto(fileBuffer.toString('base64'), mimeType, order, title, userId)
      aiFeedback = r.feedback
      aiMatched = r.matched
    } catch (e) {
      console.error('[cross-photo/upload] AI check failed:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    date: dateStr,
    storage_path: storagePath,
    photo_url: photoUrl,
    completed_count: completedCount,
    ai_feedback: aiFeedback,
    ai_matched: aiMatched,
  })
}
