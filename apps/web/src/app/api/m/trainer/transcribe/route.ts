/**
 * POST /api/m/trainer/transcribe  (multipart)
 *   initData, medium ('audio'|'video_note'), file
 *
 * Распознаёт голосовой/видео-ответ ученика в ИИ-тренажёре через Deepgram и
 * возвращает текст. Ничего не хранит и не оценивает — оценку даёт чат-ИИ.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { callDeepgram } from '@/lib/ai/deepgram'

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return err('Invalid multipart body', 'BAD_REQUEST', 400)
  }

  const initData = (formData.get('initData') as string | null) ?? ''
  const file = formData.get('file') as File | null

  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  if (!file || file.size === 0) return err('file is required', 'NO_FILE', 400)
  // Защита от слишком больших загрузок (≈ минута видео-кружка)
  if (file.size > 25 * 1024 * 1024) return err('Файл слишком большой', 'TOO_LARGE', 413)

  const rawMime = file.type || 'audio/webm'
  const mimeType = rawMime.split(';')[0].trim()
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  try {
    const { transcript } = await callDeepgram({
      audio: fileBuffer,
      mimeType,
      languageHint: 'ru',
      userId: auth.userId,
      purpose: 'transcribe_audio',
    })
    return NextResponse.json({ ok: true, transcript: (transcript ?? '').trim() })
  } catch (e) {
    console.error('[trainer/transcribe] deepgram error:', e)
    return err('Не удалось распознать запись. Попробуй ещё раз.', 'TRANSCRIBE_FAILED', 502)
  }
}
