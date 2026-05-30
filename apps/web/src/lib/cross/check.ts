import { callAnthropic } from '@/lib/ai/anthropic'
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/constants'
import { rubricFor } from './rubrics'

export interface CrossCheckResult {
  matched: boolean
  feedback: string
}

const SYSTEM_PROMPT = `Ты — добрый наставник курса «КРЕСТ». Ученик от руки (в тетради или на планшете) нарисовал «крест блока» — структуру/конспект блока — и прислал фото.
Тебе дают фото и рубрику (что в кресте блока должно быть отражено).
Оцени МЯГКО, по смыслу:
- Если ученик отразил основные пункты блока (пусть своими словами, сокращённо, с неточным почерком) — это зачёт (matched=true).
- НЕ придирайся к почерку, аккуратности, точности библейских ссылок, порядку.
- Если на фото явно не то (пусто, посторонний рисунок, совсем другой блок) — matched=false, мягко подскажи.
Верни строго JSON: {"matched": boolean, "feedback": string}
feedback — тёплый и краткий (2–4 предложения) на русском: что хорошо + что можно добавить/уточнить. Без осуждения.`

export async function checkCrossPhoto(
  imageBase64: string,
  imageMediaType: string,
  orderNum: number,
  title: string,
  userId: string | null,
): Promise<CrossCheckResult> {
  const rubric = rubricFor(orderNum, title)
  const userMessage = `Блок «${title}».\n\nРубрика — что должно быть в кресте этого блока:\n${rubric}\n\nНа фото — крест ученика. Сверь по смыслу и дай мягкий вердикт.`

  const res = await callAnthropic<{ matched?: boolean; feedback?: string }>({
    model: CLAUDE_SONNET_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    purpose: 'check_cross_photo',
    userId,
    expectJson: true,
    maxTokens: 600,
    imageBase64,
    imageMediaType,
  })

  const parsed = res.parsed
  return {
    matched: parsed?.matched ?? true, // при сбое парсинга — не блокируем
    feedback: parsed?.feedback?.trim() || 'Фото получено. Спасибо!',
  }
}
