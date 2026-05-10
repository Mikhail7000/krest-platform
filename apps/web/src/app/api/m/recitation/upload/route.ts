/**
 * POST /api/m/recitation/upload
 * Загрузка пересказа блока (аудио или видеокружок).
 *
 * Body: multipart/form-data
 *   initData  (text)
 *   block_id  (text, integer)
 *   medium    ('audio' | 'video_note')
 *   file      (Blob)
 *
 * Алгоритм:
 *   1. resolveUserId
 *   2. Upload в student-recitations/{user_id}/recitations/{block_id}/{medium}_{ts}.{ext}
 *   3. Deepgram транскрипция
 *   4. Загрузить summary_md блока из block_resources
 *   5. checkRecitation — мягкая AI-проверка
 *   6. INSERT student_block_recitations
 *   7. Если passed — обновить student_block_progress
 *   8. Ответ
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { callDeepgram } from '@/lib/ai/deepgram'
import { checkRecitation } from '@/lib/recitation/check'
import { STUDENT_RECITATIONS_BUCKET } from '@/lib/ai/constants'

export const dynamic = 'force-dynamic'

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

// local interface — table not yet in generated types
interface RecitationInsert {
  user_id: string
  block_id: number
  medium: string
  storage_path: string
  transcript: string | null
  duration_seconds: number | null
  ai_score: number | null
  ai_comment: string | null
  passed: boolean
  ai_call_id: string | null
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
  const medium = (formData.get('medium') as string | null) ?? ''
  const file = formData.get('file') as File | null

  const blockId = parseInt(blockIdRaw, 10)

  // 2. Validate
  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('block_id is required and must be a positive integer', 'BAD_BLOCK_ID', 400)
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

  // 4. Upload file to Storage
  const mimeType = file.type || (medium === 'video_note' ? 'video/mp4' : 'audio/ogg')
  const ext = mimeToExt(mimeType, medium)
  const timestamp = Date.now()
  const storagePath = `${userId}/recitations/${blockId}/${medium}_${timestamp}.${ext}`

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from(STUDENT_RECITATIONS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadErr) {
    console.error('[recitation/upload] storage upload error:', uploadErr)
    return err('Failed to upload file', 'STORAGE_ERROR', 500)
  }

  // 5. Deepgram транскрипция
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
    console.error('[recitation/upload] Deepgram error:', transcribeErr)
    return err(
      'Не удалось расшифровать аудио. Попробуйте ещё раз.',
      'TRANSCRIPTION_FAILED',
      500,
    )
  }

  // 6. Загрузить summary_md блока (берём main_video ресурс, у которого есть summary)
  const { data: blockResources } = await supabase
    .from('block_resources')
    .select('summary_md')
    .eq('block_id', blockId)
    .eq('resource_type', 'main_video')
    .not('summary_md', 'is', null)
    .limit(1)
    .maybeSingle()

  const summaryMd = blockResources?.summary_md ?? ''

  // 7. AI-проверка пересказа
  const checkResult = await checkRecitation(transcript, summaryMd, userId)

  // 8. INSERT student_block_recitations
  const insertRow: RecitationInsert = {
    user_id: userId,
    block_id: blockId,
    medium,
    storage_path: storagePath,
    transcript: transcript || null,
    duration_seconds: durationSec > 0 ? Math.round(durationSec) : null,
    ai_score: checkResult.ai_score,
    ai_comment: checkResult.ai_comment || null,
    passed: checkResult.passed,
    ai_call_id: checkResult.ai_call_id,
  }

  // cast через unknown — таблица не в сгенерированных типах
  const { error: insertErr } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (row: RecitationInsert) => Promise<{ error: unknown }>
    }
  })
    .from('student_block_recitations')
    .insert(insertRow)

  if (insertErr) {
    console.error('[recitation/upload] insert error:', insertErr)
    // Non-fatal — respond with check result anyway
  }

  // 9. Update student_block_progress recitation_*_passed_at on first pass
  if (checkResult.passed) {
    const now = new Date().toISOString()
    if (medium === 'audio') {
      await supabase
        .from('student_block_progress')
        .update({ recitation_audio_passed_at: now })
        .eq('user_id', userId)
        .eq('block_id', blockId)
        .is('recitation_audio_passed_at', null)
    } else {
      await supabase
        .from('student_block_progress')
        .update({ recitation_videos_passed_at: now })
        .eq('user_id', userId)
        .eq('block_id', blockId)
        .is('recitation_videos_passed_at', null)
    }
  }

  return NextResponse.json({
    ok: true,
    passed: checkResult.passed,
    ai_score: checkResult.ai_score,
    ai_comment: checkResult.ai_comment,
    transcript,
  })
}
