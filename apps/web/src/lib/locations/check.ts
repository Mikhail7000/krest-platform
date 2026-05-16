/**
 * Утилиты AI-проверки местописаний (цитат Писания).
 * Используется в /api/m/locations/upload.
 *
 * Два режима:
 *   verbatim — слово-в-слово. Знаки препинания и регистр игнорируются.
 *   meaning  — пересказ смысла. Дословность не требуется.
 */

import { callAnthropic } from '@/lib/ai/anthropic'
import { CLAUDE_HAIKU_MODEL } from '@/lib/ai/constants'

export type CheckMode = 'verbatim' | 'meaning'

export interface LocationCheckResult {
  passed: boolean
  similarity_score: number
  ai_comment: string
  ai_call_id: string | null
}

interface AiLocationResponse {
  passed: boolean
  similarity_score: number
  comment: string
}

export async function checkLocation(
  transcript: string,
  exactText: string,
  checkMode: CheckMode,
  reference: string,
  userId: string,
): Promise<LocationCheckResult> {
  const systemPrompt = buildSystemPrompt(checkMode, reference)
  const userMessage = buildUserMessage(transcript, exactText, checkMode)

  try {
    const result = await callAnthropic<AiLocationResponse>({
      model: CLAUDE_HAIKU_MODEL,
      systemPrompt,
      userMessage,
      purpose: 'compare_location',
      userId,
      expectJson: true,
      maxTokens: 300,
    })

    const parsed = result.parsed
    const passed = parsed?.passed === true
    const score = typeof parsed?.similarity_score === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.similarity_score)))
      : 0
    const comment = parsed?.comment ?? result.text.slice(0, 400)

    return { passed, similarity_score: score, ai_comment: comment, ai_call_id: result.aiCallId }
  } catch (err) {
    console.error('[checkLocation] AI call failed:', err)
    return {
      passed: false,
      similarity_score: 0,
      ai_comment: 'Не удалось проверить автоматически. Попробуйте ещё раз.',
      ai_call_id: null,
    }
  }
}

function buildSystemPrompt(checkMode: CheckMode, reference: string): string {
  if (checkMode === 'verbatim') {
    return [
      `Ты — система AI-проверки, которая оценивает дословное произнесение библейской цитаты (${reference}).`,
      '',
      'ЗАДАЧА: сравни транскрипт ученика с эталонным текстом.',
      'ПРАВИЛА:',
      '  1. Знаки препинания и регистр букв ИГНОРИРУЙ — они не влияют на оценку.',
      '  2. Незначительные расхождения в окончаниях (падежи, числа) допустимы.',
      '  3. Засчитывай (passed=true) если все слова присутствуют в правильном порядке.',
      '  4. НЕ засчитывай если пропущено ≥2 значимых слов или порядок сильно нарушен.',
      '  5. similarity_score 0..100: 100 = дословное совпадение, 0 = совсем другой текст.',
      '',
      'Верни ТОЛЬКО валидный JSON без лишнего текста:',
      '{ "passed": true/false, "similarity_score": 0..100, "comment": "краткий комментарий на русском" }',
    ].join('\n')
  }

  // meaning
  return [
    `Ты — система AI-проверки, которая оценивает пересказ библейской цитаты или притчи (${reference}) своими словами.`,
    '',
    'ЗАДАЧА: определи, передан ли смысл эталонного текста. Дословность не требуется.',
    'ПРАВИЛА:',
    '  1. Засчитывай (passed=true) если ученик передал КЛЮЧЕВУЮ ИДЕЮ фрагмента.',
    '  2. Допускай свободные формулировки и упущение второстепенных деталей.',
    '  3. НЕ засчитывай если ученик говорит о другом или искажает смысл.',
    '  4. similarity_score 0..100: 100 = вся суть передана точно, 0 = совсем о другом.',
    '',
    'Верни ТОЛЬКО валидный JSON без лишнего текста:',
    '{ "passed": true/false, "similarity_score": 0..100, "comment": "краткий комментарий на русском" }',
  ].join('\n')
}

function buildUserMessage(transcript: string, exactText: string, checkMode: CheckMode): string {
  const modeLabel = checkMode === 'verbatim' ? 'дословная сдача' : 'пересказ своими словами'
  return [
    `Режим проверки: ${modeLabel}`,
    '',
    `Эталонный текст:`,
    exactText,
    '',
    `Транскрипт ученика:`,
    transcript || '(пусто — ничего не произнесено)',
  ].join('\n')
}
