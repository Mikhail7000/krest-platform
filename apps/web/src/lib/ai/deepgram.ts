/**
 * Обёртка Deepgram STT API (nova-2).
 * - POST binary audio/video → transcript + duration.
 * - Retry 3 попытки с backoff 500/1500/4500ms на 5xx и 429.
 * - Timeout 60s per attempt.
 * - Логирует в ai_call_log (provider='deepgram').
 */

import { createServiceSupabase } from '../supabase-service'
import { DEEPGRAM_API_URL, DEEPGRAM_MODEL, DEEPGRAM_TIMEOUT_MS } from './constants'

export interface DeepgramCallOptions {
  /** Бинарные данные аудио/видео. Buffer из Node.js совместим с fetch body. */
  audio: Buffer
  mimeType: string
  languageHint?: string
  userId?: string | null
  purpose?: string
}

export interface DeepgramCallResult {
  transcript: string
  durationSec: number
  language: string
  confidence: number
  aiCallId: string | null
}

interface DeepgramResponse {
  metadata?: {
    duration?: number
    channels?: number
  }
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string
        confidence?: number
        words?: unknown[]
      }>
      detected_language?: string
    }>
  }
}

const RETRY_ATTEMPTS = 3

function backoffMs(attempt: number): number {
  // 500ms, 1500ms, 4500ms
  return 500 * 3 ** (attempt - 1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function callDeepgram(opts: DeepgramCallOptions): Promise<DeepgramCallResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY не задан, попроси Михаила настроить')
  }

  const language = opts.languageHint ?? 'ru'
  const url = `${DEEPGRAM_API_URL}?model=${DEEPGRAM_MODEL}&language=${language}&punctuate=true&smart_format=true`

  let lastError: unknown = null
  const startedAt = Date.now()

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': opts.mimeType,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: opts.audio as any,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastError = new Error(`Deepgram ${res.status}: ${errText.slice(0, 300)}`)
        if (res.status >= 500 || res.status === 429) {
          await sleep(backoffMs(attempt))
          continue
        }
        await logDeepgramCall(opts, null, Date.now() - startedAt, false, String(lastError))
        throw lastError
      }

      const data = (await res.json()) as DeepgramResponse
      const channel = data.results?.channels?.[0]
      const alt = channel?.alternatives?.[0]

      const transcript = alt?.transcript?.trim() ?? ''
      const durationSec = data.metadata?.duration ?? 0
      const confidence = alt?.confidence ?? 0
      const detectedLanguage = channel?.detected_language ?? language

      const aiCallId = await logDeepgramCall(
        opts,
        transcript.length,
        Date.now() - startedAt,
        true,
        null,
      )

      return { transcript, durationSec, language: detectedLanguage, confidence, aiCallId }
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(backoffMs(attempt))
        continue
      }
    }
  }

  await logDeepgramCall(opts, null, Date.now() - startedAt, false, String(lastError))
  throw lastError instanceof Error ? lastError : new Error('Deepgram call failed')
}

async function logDeepgramCall(
  opts: DeepgramCallOptions,
  outputLength: number | null,
  durationMs: number,
  success: boolean,
  errorMessage: string | null,
): Promise<string | null> {
  try {
    const supabase = createServiceSupabase()
    const { data, error } = await supabase
      .from('ai_call_log')
      .insert({
        provider: 'deepgram',
        model: DEEPGRAM_MODEL,
        purpose: opts.purpose ?? 'transcribe_audio',
        user_id: opts.userId ?? null,
        input_tokens: null,
        output_tokens: outputLength,
        duration_ms: durationMs,
        success,
        error_message: errorMessage,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ai_call_log] deepgram insert failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch (err) {
    console.error('[ai_call_log] deepgram exception:', err)
    return null
  }
}
