/**
 * POST /api/m/locations/upload
 * Загрузка попытки местописания (audio или video_note).
 *
 * Body: multipart/form-data
 *   initData    (text)
 *   location_id (text, UUID)
 *   medium      ('audio' | 'video_note')
 *   file        (Blob)
 *
 * Алгоритм:
 *   1. resolveUserId
 *   2. Upload в student-recitations/{user_id}/locations/{location_id}/{medium}_{ts}.{ext}
 *   3. Deepgram транскрипция
 *   4. checkLocation — verbatim или meaning
 *   5. INSERT student_location_attempts (с полем medium)
 *   6. Ответ с passed / transcript / similarity_score
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { callDeepgram } from '@/lib/ai/deepgram'
import { checkLocation } from '@/lib/locations/check'
import { STUDENT_RECITATIONS_BUCKET } from '@/lib/ai/constants'

export const dynamic = 'force-dynamic'

// local interface — medium не в сгенерированных типах
interface LocationAttemptInsert {
  user_id: string
  location_id: string
  source_type: string
  medium: string
  storage_path: string
  transcript: string | null
  similarity_score: number | null
  passed: boolean
  ai_comment: string | null
  ai_call_id: string | null
  duration_seconds: number | null
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

const VALID_MEDIUM = new Set(['audio', 'video_note'])

function mimeToExt(mimeType: string, medium: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('video')) return 'mp4'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('m4a') || mimeType.includes('mp4a')) return 'm4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return medium === 'video_note' ? 'mp4' : 'ogg'
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
  const locationId = (formData.get('location_id') as string | null) ?? ''
  const medium = (formData.get('medium') as string | null) ?? ''
  const file = formData.get('file') as File | null

  // 2. Validate
  if (!locationId || locationId.length < 36) {
    return err('location_id is required', 'BAD_LOCATION_ID', 400)
  }
  if (!VALID_MEDIUM.has(medium)) {
    return err('medium must be audio or video_note', 'BAD_MEDIUM', 400)
  }
  if (!file || file.size === 0) {
    return err('file is required', 'NO_FILE', 400)
  }

  // 3. Auth
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const supabase = createServiceSupabase()

  // 4. Load location (эталон)
  const { data: location, error: locErr } = await supabase
    .from('block_locations_to_recite')
    .select('id, reference, exact_text, check_mode, similarity_threshold, is_required')
    .eq('id', locationId)
    .maybeSingle()

  if (locErr || !location) {
    return err('Location not found', 'NOT_FOUND', 404)
  }

  // 5. Upload file to Storage
  const mimeType = file.type || (medium === 'video_note' ? 'video/mp4' : 'audio/ogg')
  const ext = mimeToExt(mimeType, medium)
  const timestamp = Date.now()
  const storagePath = `${userId}/locations/${locationId}/${medium}_${timestamp}.${ext}`

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from(STUDENT_RECITATIONS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadErr) {
    console.error('[locations/upload] storage upload error:', uploadErr)
    return err('Failed to upload file', 'STORAGE_ERROR', 500)
  }

  // 6. Deepgram транскрипция
  let transcript = ''
  let durationSec = 0

  try {
    const deepgramResult = await callDeepgram({
      audio: fileBuffer,
      mimeType,
      languageHint: 'ru',
      userId,
      purpose: 'transcribe_audio',
    })
    transcript = deepgramResult.transcript
    durationSec = deepgramResult.durationSec
  } catch (transcribeErr) {
    console.error('[locations/upload] Deepgram error:', transcribeErr)
    return err(
      'Не удалось расшифровать аудио. Попробуйте ещё раз.',
      'TRANSCRIPTION_FAILED',
      500,
    )
  }

  // 7. AI-проверка
  const checkResult = await checkLocation(
    transcript,
    location.exact_text,
    location.check_mode as 'verbatim' | 'meaning',
    location.reference,
    userId,
  )

  // Нормализуем similarity_score в 0..1 для БД (поле NUMERIC(4,3))
  const similarityDb = Math.round(checkResult.similarity_score) / 100

  // 8. INSERT student_location_attempts
  const insertRow: LocationAttemptInsert = {
    user_id: userId,
    location_id: locationId,
    source_type: medium === 'video_note' ? 'video_note' : 'voice',
    medium,
    storage_path: storagePath,
    transcript: transcript || null,
    similarity_score: similarityDb,
    passed: checkResult.passed,
    ai_comment: checkResult.ai_comment || null,
    ai_call_id: checkResult.ai_call_id,
    duration_seconds: durationSec > 0 ? durationSec : null,
  }

  // cast через unknown — поле medium добавлено миграцией 20260510140000, ещё не в types.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await supabase
    .from('student_location_attempts')
    .insert(insertRow as unknown as any)

  if (insertErr) {
    console.error('[locations/upload] insert attempt error:', insertErr)
    // Non-fatal: file uploaded, respond with result
  }

  // 9. Считаем агрегированные попытки для ответа
  const { data: attemptsRaw } = await supabase
    .from('student_location_attempts')
    .select('medium, passed')
    .eq('user_id', userId)
    .eq('location_id', locationId)

  const allAttempts = (attemptsRaw ?? []) as Array<{ medium: string; passed: boolean }>
  const audioAttempts = allAttempts.filter((a) => a.medium === 'audio').length
  const videoAttempts = allAttempts.filter((a) => a.medium === 'video_note').length

  return NextResponse.json({
    ok: true,
    passed: checkResult.passed,
    transcript,
    similarity_score: checkResult.similarity_score,
    ai_comment: checkResult.ai_comment,
    attempts: {
      audio: audioAttempts,
      video: videoAttempts,
    },
  })
}
