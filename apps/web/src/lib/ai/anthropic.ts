import { createServiceSupabase } from '../supabase-service'
import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  ANTHROPIC_DEFAULT_TIMEOUT_MS,
  ANTHROPIC_RETRY_ATTEMPTS,
} from './constants'

export type AiPurpose =
  | 'generate_quiz'
  | 'check_quiz_answer'
  | 'compare_location'
  | 'summarize_transcript'
  | 'check_cross_photo'

export interface AnthropicCallOptions {
  model: string
  systemPrompt: string
  /** Одиночное сообщение пользователя (если не передан messages). */
  userMessage?: string
  /** Многоходовой диалог (чат). Если задан — используется вместо userMessage. */
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
  purpose: AiPurpose
  userId?: string | null
  maxTokens?: number
  timeoutMs?: number
  expectJson?: boolean
  /** Изображение для vision-запроса (base64 без префикса data:) */
  imageBase64?: string
  /** MIME изображения, напр. 'image/jpeg' */
  imageMediaType?: string
}

export interface AnthropicCallResult<T = string> {
  text: string
  parsed: T | null
  inputTokens: number
  outputTokens: number
  aiCallId: string | null
  durationMs: number
}

interface AnthropicResponseBody {
  content: Array<{ type: string; text?: string }>
  usage: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}

/**
 * Низкоуровневый вызов Claude Messages API.
 * - Retry с экспоненциальным бэкоффом (3 попытки) при 429/5xx и сетевых ошибках.
 * - Логирование в ai_call_log (через service-role).
 * - Опциональный JSON-парсинг ответа (с устойчивостью к ```json fenced``` и предисловию).
 */
export async function callAnthropic<T = unknown>(
  opts: AnthropicCallOptions
): Promise<AnthropicCallResult<T>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const maxTokens = opts.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS
  const timeoutMs = opts.timeoutMs ?? ANTHROPIC_DEFAULT_TIMEOUT_MS

  // Vision: если передано изображение — content становится массивом блоков
  const userContent = opts.imageBase64
    ? [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: opts.imageMediaType ?? 'image/jpeg',
            data: opts.imageBase64,
          },
        },
        { type: 'text', text: opts.userMessage ?? '' },
      ]
    : opts.userMessage ?? ''

  // Многоходовой чат имеет приоритет над одиночным сообщением.
  const messages =
    opts.messages && opts.messages.length > 0
      ? opts.messages
      : [{ role: 'user', content: userContent }]

  const body = {
    model: opts.model,
    max_tokens: maxTokens,
    system: opts.systemPrompt,
    messages,
  }

  let lastError: unknown = null
  const startedAt = Date.now()

  for (let attempt = 1; attempt <= ANTHROPIC_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastError = new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`)
        if (res.status >= 500 || res.status === 429) {
          await sleep(backoffMs(attempt))
          continue
        }
        // 4xx (кроме 429) — не ретраим
        await logAiCall(opts, null, Date.now() - startedAt, false, String(lastError))
        throw lastError
      }

      const data = (await res.json()) as AnthropicResponseBody
      const text = data.content?.[0]?.text ?? ''
      const parsed = opts.expectJson ? safeJsonParse<T>(text) : null
      const aiCallId = await logAiCall(
        opts,
        { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
        Date.now() - startedAt,
        true,
        null
      )

      return {
        text,
        parsed,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        aiCallId,
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < ANTHROPIC_RETRY_ATTEMPTS) {
        await sleep(backoffMs(attempt))
        continue
      }
    }
  }

  await logAiCall(opts, null, Date.now() - startedAt, false, String(lastError))
  throw lastError instanceof Error ? lastError : new Error('Anthropic call failed')
}

function backoffMs(attempt: number): number {
  // 500мс, 1500мс, 4500мс
  return 500 * 3 ** (attempt - 1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function safeJsonParse<T>(text: string): T | null {
  // Извлекаем JSON из ```json ... ``` или { ... } / [ ... ]
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenced?.[1] ?? extractFirstJson(trimmed) ?? trimmed
  try {
    return JSON.parse(candidate) as T
  } catch {
    return null
  }
}

function extractFirstJson(text: string): string | null {
  const firstObj = text.indexOf('{')
  const firstArr = text.indexOf('[')
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr)
  if (start === -1) return null
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    if (text[i] === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

async function logAiCall(
  opts: AnthropicCallOptions,
  tokens: { input: number; output: number } | null,
  durationMs: number,
  success: boolean,
  errorMessage: string | null
): Promise<string | null> {
  try {
    const supabase = createServiceSupabase()
    const { data, error } = await supabase
      .from('ai_call_log')
      .insert({
        provider: 'anthropic',
        model: opts.model,
        purpose: opts.purpose,
        user_id: opts.userId ?? null,
        input_tokens: tokens?.input ?? null,
        output_tokens: tokens?.output ?? null,
        duration_ms: durationMs,
        success,
        error_message: errorMessage,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[ai_call_log] insert failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch (err) {
    console.error('[ai_call_log] exception:', err)
    return null
  }
}
