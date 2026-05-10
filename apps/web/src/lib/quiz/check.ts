/**
 * Утилиты проверки ответов на вопросы квиза.
 * Используется в /api/m/quiz/submit.
 */

import { callAnthropic } from '@/lib/ai/anthropic'
import { CLAUDE_HAIKU_MODEL } from '@/lib/ai/constants'

export interface QuestionRow {
  id: string
  question_text: string
  question_type: string
  options: unknown
  correct_indices: number[] | null
  expected_answer: string | null
  rubric: string | null
  order_index: number
}

export interface AnswerInput {
  question_id: string
  selected_indices?: number[]
  free_text?: string
}

export interface CheckResult {
  question_id: string
  correct: boolean
  your_answer: string | null
  correct_answer: string | null
  ai_comment?: string
  ai_call_id?: string | null
}

interface AiCheckResponse {
  passed: boolean
  comment: string
}

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((v) => setA.has(v))
}

function formatIndices(indices: number[] | null, options: unknown): string {
  if (!indices || !Array.isArray(options)) return String(indices)
  return indices
    .map((i) => {
      const opt = (options as string[])[i]
      return opt ?? String(i)
    })
    .join(', ')
}

export async function checkSingleOrMulti(
  question: QuestionRow,
  answer: AnswerInput,
): Promise<CheckResult> {
  const selected = answer.selected_indices ?? []
  const correct = question.correct_indices ?? []
  const isCorrect = setsEqual(selected, correct)

  return {
    question_id: question.id,
    correct: isCorrect,
    your_answer: formatIndices(selected, question.options),
    correct_answer: formatIndices(correct, question.options),
  }
}

export async function checkFreeText(
  question: QuestionRow,
  answer: AnswerInput,
  userId: string,
): Promise<CheckResult> {
  const studentAnswer = answer.free_text?.trim() ?? ''

  const systemPrompt = [
    'Ты — преподаватель курса, проверяющий свободный ответ ученика на вопрос для понимания материала.',
    '',
    'ГЛАВНЫЙ ПРИНЦИП: засчитывай ответ как passed=true, если ученик уловил ОСНОВНУЮ СУТЬ ожидаемого ответа.',
    'Не требуй упоминания всех деталей или дословного совпадения — оценивай понимание, а не зубрёжку.',
    'Допускай свободные формулировки, разговорный стиль, опечатки, неполные детали — главное, чтобы ключевая идея была верной.',
    '',
    'passed=false выставляй ТОЛЬКО если выполнено хотя бы одно:',
    '  1) Ответ не имеет отношения к вопросу.',
    '  2) Ответ искажает или противоречит сути правильного ответа (говорит противоположное).',
    '  3) Ответ совсем поверхностный — пара слов без раскрытия мысли («не знаю», «потом», «да», и т.п.).',
    '',
    'Если ответ передаёт главную идею, но не охватывает все детали — passed=true.',
    'В comment кратко (1-2 предложения) поощри ученика и при желании укажи, что можно было бы добавить — без жёстких формулировок «неверно», «недостаточно».',
    '',
    `Ожидаемый ответ: ${question.expected_answer ?? '(не задан)'}`,
    question.rubric ? `Дополнительные критерии (как ориентир, не жёсткий чеклист): ${question.rubric}` : '',
    '',
    'Верни ТОЛЬКО валидный JSON без дополнительного текста:',
    '{ "passed": true/false, "comment": "краткий комментарий на русском" }',
  ]
    .filter(Boolean)
    .join('\n')

  const userMessage = `Вопрос: ${question.question_text}\n\nОтвет ученика: ${studentAnswer}`

  try {
    const result = await callAnthropic<AiCheckResponse>({
      model: CLAUDE_HAIKU_MODEL,
      systemPrompt,
      userMessage,
      purpose: 'check_quiz_answer',
      userId,
      expectJson: true,
      maxTokens: 256,
    })

    const parsed = result.parsed
    const isCorrect = parsed?.passed === true

    return {
      question_id: question.id,
      correct: isCorrect,
      your_answer: studentAnswer,
      correct_answer: question.expected_answer,
      ai_comment: parsed?.comment ?? result.text.slice(0, 300),
      ai_call_id: result.aiCallId,
    }
  } catch (err) {
    console.error('[checkFreeText] AI call failed:', err)
    // Fallback: всегда не засчитываем при ошибке, чтобы не занижать барьер
    return {
      question_id: question.id,
      correct: false,
      your_answer: studentAnswer,
      correct_answer: question.expected_answer,
      ai_comment: 'Не удалось проверить автоматически. Попробуйте ещё раз.',
      ai_call_id: null,
    }
  }
}
