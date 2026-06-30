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
 *   1. resolveUserId + block-gate + дневной гейт (не забегать на новый день)
 *   2. Validate image MIME
 *   3. ИИ-сверка с ЭТАЛОНОМ блока ДО записи: если на фото явно не крест блока —
 *      422 PHOTO_REJECTED, день НЕ засчитывается (fail-open при ошибке ИИ)
 *   4. Upload в student-cross-photos/{user_id}/{block_id}/{YYYY-MM-DD}.{ext}
 *   5. UPSERT в student_block_daily_cross + счётчик
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { STUDENT_CROSS_PHOTOS_BUCKET } from '@/lib/ai/constants'
import { checkCrossPhoto } from '@/lib/cross/check'
import { isBlockUnlocked } from '@/lib/access/block-gate'
import { loadDayGate, dayGateRejection } from '@/lib/m/day-gate'
import { notifyCuratorIfDayClosed } from '@/lib/curator/day-close-notify'

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

// Виртуальная дата для ускоренного тест-режима: якорь 2000-01-01 + offset дней.
// Якорь намеренно вне реальных дат, чтобы «закрытые дни» не пересекались с боевыми.
function accelDate(offset: number): string {
  const d = new Date(Date.UTC(2000, 0, 1))
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// local interface — table not yet in generated types
interface DailyCrossInsert {
  user_id: string
  block_id: number
  submitted_date: string
  storage_path: string
}

// Эталон «креста блока» лежит в block-resources/cross-reference/{order}.jpg.
// Возвращает base64 для vision-сверки или null (тогда проверка идёт по текстовой рубрике).
async function loadCrossReference(
  supabase: ReturnType<typeof createServiceSupabase>,
  orderNum: number,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const { data, error } = await supabase.storage
      .from('block-resources')
      .download(`cross-reference/${orderNum}.jpg`)
    if (error || !data) return null
    const buf = Buffer.from(await data.arrayBuffer())
    return { base64: buf.toString('base64'), mediaType: 'image/jpeg' }
  } catch {
    return null
  }
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

  // 3a. Block-gate: проверяем, что блок разблокирован для этого пользователя
  if (!(await isBlockUnlocked(userId, blockId))) {
    return err('Этот блок ещё не открыт.', 'BLOCK_LOCKED', 403)
  }

  const supabase = createServiceSupabase()

  // Ускоренный тест-режим (profiles.test_daily_accel): дневные задания штампуются
  // ВИРТУАЛЬНЫМИ датами от якоря 2000-01-01, чтобы тестировщик закрыл много «дней»
  // за один календарный день. Вирт.дата = 2000-01-01 + (кол-во уже существующих
  // записей этой задачи для user+block). Обычным юзерам — реальная локальная дата.
  const gate = await loadDayGate(supabase, userId, blockId)
  let dateStr = gate.localToday
  const { data: accelProfile } = await supabase
    .from('profiles')
    .select('test_daily_accel')
    .eq('id', userId)
    .maybeSingle()
  const testAccel = Boolean((accelProfile as { test_daily_accel?: boolean } | null)?.test_daily_accel)
  if (testAccel) {
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
    dateStr = accelDate(existing ?? 0)
  } else {
    // Дневной гейт: нельзя забегать на новый день/новый блок раньше 00:00 след. суток.
    // Переотправка фото за сегодня (день уже начат/закрыт) — разрешена.
    const { data: todayRow } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: unknown) => {
            eq: (col: string, val: unknown) => {
              eq: (col: string, val: unknown) => {
                limit: (n: number) => Promise<{ data: Array<{ submitted_date: string }> | null }>
              }
            }
          }
        }
      }
    })
      .from('student_block_daily_cross')
      .select('submitted_date')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .eq('submitted_date', gate.localToday)
      .limit(1)
    const rejection = dayGateRejection(gate, (todayRow?.length ?? 0) > 0)
    if (rejection) return err(rejection, 'DAY_LOCKED', 403)
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // 4. ИИ-проверка «креста блока» ДО записи: сверяем фото ученика с ЭТАЛОНОМ блока.
  // Гейтим только распознаваемые vision-форматы (HEIC vision не читает — пропускаем).
  // Тест-ускорение (accel) не гейтим. Любая ошибка ИИ — fail-open (не блокируем сдачу).
  let aiFeedback: string | null = null
  let aiMatched: boolean | null = null
  const VISION_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  const { data: blk } = await supabase
    .from('blocks')
    .select('order_num, title_ru')
    .eq('id', blockId)
    .maybeSingle()
  const order = (blk as { order_num?: number } | null)?.order_num ?? blockId
  const title = (blk as { title_ru?: string } | null)?.title_ru ?? `Блок ${blockId}`

  if (!testAccel && VISION_MIMES.has(mimeType)) {
    try {
      const reference = await loadCrossReference(supabase, order)
      const r = await checkCrossPhoto(
        fileBuffer.toString('base64'),
        mimeType,
        order,
        title,
        userId,
        reference,
      )
      aiFeedback = r.feedback
      aiMatched = r.matched
    } catch (e) {
      console.error('[cross-photo/upload] AI check failed (fail-open):', e)
    }
  }

  // ИИ уверенно распознал, что это НЕ крест блока (посторонний предмет/косметика/товар/
  // селфи/пейзаж/скриншот/экран/пусто/совсем другой блок) → НЕ засчитываем: фото не
  // сохраняем и день не закрываем. Блокирует ТОЛЬКО явный matched=false. Ошибка ИИ /
  // HEIC (vision не читает) / accel / сбой парсинга → aiMatched=null → пропускаем
  // (fail-open), чтобы не резать настоящие рукописные кресты.
  if (aiMatched === false) {
    return err(
      aiFeedback ||
        'Это не похоже на рукописный крест блока. Пришли, пожалуйста, фото своего креста за этот день 🙏',
      'NOT_A_CROSS',
      422,
    )
  }

  // 5. Upload to Storage (только после прохождения проверки)
  const ext = mimeToExt(mimeType)
  const storagePath = `${userId}/${blockId}/${dateStr}.${ext}`

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

  // Если этим действием день закрылся — уведомить куратора (один раз).
  void notifyCuratorIfDayClosed(supabase, userId, dateStr)

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
