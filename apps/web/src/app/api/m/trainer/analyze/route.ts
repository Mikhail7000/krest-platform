/**
 * POST /api/m/trainer/analyze
 * УЧЕБНЫЙ разбор записи местописания (аудио или видеокружок).
 * Транскрибирует и сравнивает с эталоном — но НИЧЕГО не сохраняет
 * (ни файл в Storage, ни запись в student_location_attempts). Только фидбэк.
 *
 * Body: multipart/form-data { initData, location_id, medium, file }
 * Response: { ok, transcript, similarity_score (0..100), ai_comment, passed }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { callDeepgram } from '@/lib/ai/deepgram'
import { checkLocation } from '@/lib/locations/check'

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

const VALID_MEDIUM = new Set(['audio', 'video_note'])

export async function POST(req: NextRequest) {
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

  if (!locationId || locationId.length < 36) return err('location_id is required', 'BAD_LOCATION_ID', 400)
  if (!VALID_MEDIUM.has(medium)) return err('medium must be audio or video_note', 'BAD_MEDIUM', 400)
  if (!file || file.size === 0) return err('file is required', 'NO_FILE', 400)

  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const supabase = createServiceSupabase()

  const { data: location, error: locErr } = await supabase
    .from('block_locations_to_recite')
    .select('id, reference, exact_text, check_mode')
    .eq('id', locationId)
    .maybeSingle()

  if (locErr || !location) return err('Location not found', 'NOT_FOUND', 404)

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const mimeType = (file.type || (medium === 'video_note' ? 'video/mp4' : 'audio/ogg')).split(';')[0].trim()

  // Транскрипция (без сохранения файла)
  let transcript = ''
  try {
    const dg = await callDeepgram({
      audio: fileBuffer,
      mimeType,
      languageHint: 'ru',
      userId,
      purpose: 'transcribe_audio',
    })
    transcript = dg.transcript
  } catch (e) {
    console.error('[trainer/analyze] Deepgram error:', e)
    return err('Не удалось расшифровать запись. Попробуйте ещё раз.', 'TRANSCRIPTION_FAILED', 500)
  }

  // Сравнение с эталоном (учебный режим — attemptNumber=1, мягкая планка)
  const check = await checkLocation(
    transcript,
    location.exact_text,
    location.check_mode as 'verbatim' | 'meaning',
    location.reference,
    userId,
    1,
  )

  return NextResponse.json({
    ok: true,
    transcript,
    similarity_score: check.similarity_score,
    ai_comment: check.ai_comment,
    passed: check.passed,
  })
}
