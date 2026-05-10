/**
 * Утилиты AI-проверки пересказа блока своими словами.
 * Используется в /api/m/recitation/upload.
 *
 * МЯГКИЙ режим: засчитываем если ученик уловил суть,
 * даже если не все детали воспроизведены.
 * Соответствует паттерну checkFreeText в lib/quiz/check.ts.
 */

import { callAnthropic } from '@/lib/ai/anthropic'
import { CLAUDE_HAIKU_MODEL } from '@/lib/ai/constants'

export interface RecitationCheckResult {
  passed: boolean
  ai_score: number
  ai_comment: string
  ai_call_id: string | null
}

interface AiRecitationResponse {
  passed: boolean
  score: number
  comment: string
}

/**
 * Проверяет пересказ блока.
 *
 * @param transcript    Транскрипт от Deepgram (что сказал ученик).
 * @param blockSummaryMd  Markdown-конспект блока (из block_resources.summary_md).
 *                         Используется как «эталон» для AI.
 * @param userId        UUID ученика для ai_call_log.
 */
export async function checkRecitation(
  transcript: string,
  blockSummaryMd: string,
  userId: string,
): Promise<RecitationCheckResult> {
  const systemPrompt = [
    'Ты — преподаватель, оценивающий пересказ учеником материала блока библейского курса.',
    '',
    'ГЛАВНЫЙ ПРИНЦИП: засчитывай (passed=true) если ученик уловил ОСНОВНУЮ СУТЬ блока,',
    'даже если он не воспроизвёл все детали или использовал другие слова.',
    'Допускай свободные формулировки, разговорный стиль, пропуск второстепенных деталей.',
    '',
    'passed=false выставляй ТОЛЬКО если:',
    '  1. Ученик говорит о совсем другой теме.',
    '  2. Ученик искажает или противоречит ключевым идеям блока.',
    '  3. Пересказ слишком поверхностен — одна-две фразы без раскрытия смысла.',
    '',
    'score 0..100: 100 = блестящий пересказ всей сути, 0 = не по теме вообще.',
    '',
    'В comment (1-2 предложения) — поощри ученика и при желании',
    'укажи, что можно было бы добавить. Без резких формулировок.',
    '',
    'Конспект блока (эталон):',
    '---',
    blockSummaryMd || '(конспект не предоставлен)',
    '---',
    '',
    'Верни ТОЛЬКО валидный JSON без лишнего текста:',
    '{ "passed": true/false, "score": 0..100, "comment": "краткий комментарий на русском" }',
  ].join('\n')

  const userMessage = `Пересказ ученика:\n${transcript || '(пусто — ничего не сказано)'}`

  try {
    const result = await callAnthropic<AiRecitationResponse>({
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
    const score = typeof parsed?.score === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.score)))
      : 0
    const comment = parsed?.comment ?? result.text.slice(0, 400)

    return { passed, ai_score: score, ai_comment: comment, ai_call_id: result.aiCallId }
  } catch (err) {
    console.error('[checkRecitation] AI call failed:', err)
    return {
      passed: false,
      ai_score: 0,
      ai_comment: 'Не удалось проверить автоматически. Попробуйте ещё раз.',
      ai_call_id: null,
    }
  }
}
