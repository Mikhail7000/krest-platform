import { callAnthropic } from '@/lib/ai/anthropic'
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/constants'
import { rubricFor } from './rubrics'

export interface CrossCheckResult {
  matched: boolean
  feedback: string
}

export interface RefImage {
  base64: string
  mediaType: string
}

// С эталоном — сверяем структуру; БЕЗ эталона — по текстовой рубрике.
const SYSTEM_WITH_REF = `Ты — добрый наставник курса «КРЕСТ». Каждый день ученик от руки переписывает «крест блока» — это схема/конспект блока — и присылает фото.
Тебе дают ДВА изображения: ПЕРВОЕ — ЭТАЛОН (правильный «крест блока»), ВТОРОЕ — фото ученика. Плюс текстовую рубрику.
Задача: понять, действительно ли на фото ученика — рукописный «крест блока», похожий по СТРУКТУРЕ и СМЫСЛУ на эталон.
Оценивай МЯГКО:
- matched=true, если ученик от руки воспроизвёл крест этого блока: те же основные блоки/стрелки/связки и ключевые слова — пусть своими словами, сокращённо, кривым почерком, не идеально, в другом порядке. Сходство по сути важнее точности.
- matched=false, если на фото НЕ рукописный крест блока. ПЕРВЫМ делом проверь: на фото вообще есть РУКОПИСНАЯ запись/схема на бумаге? Если это сфотографированный ПРЕДМЕТ (косметика, палетка, товар, упаковка, еда, техника), экран/скриншот/телефон, селфи/человек, помещение, пейзаж, пустой лист или любое случайное фото — это matched=false ВСЕГДА, без исключений, даже если на упаковке есть надписи.
НЕ придирайся к почерку, аккуратности, точности ссылок и порядку — но рукописный крест на бумаге обязателен.
Верни СТРОГО JSON: {"matched": boolean, "feedback": string}
feedback — тёплый, краткий (2–4 предложения) на русском, без осуждения: что хорошо + что можно добавить; либо мягкая просьба переснять именно крест блока.`

const SYSTEM_NO_REF = `Ты — добрый наставник курса «КРЕСТ». Ученик от руки нарисовал «крест блока» — структуру/конспект блока — и прислал фото. Тебе дают фото и рубрику (что в кресте блока должно быть отражено).
Оцени МЯГКО, по смыслу:
- Если ученик отразил основные пункты блока (пусть своими словами, сокращённо, с неточным почерком) — это зачёт (matched=true).
- НЕ придирайся к почерку, аккуратности, точности ссылок, порядку.
- ПЕРВЫМ делом проверь: на фото есть РУКОПИСНАЯ запись/схема на бумаге? Если это сфотографированный ПРЕДМЕТ (косметика, палетка, товар, упаковка, еда, техника), экран/скриншот/телефон, селфи/человек, помещение, пейзаж, пустой лист или случайное фото — matched=false ВСЕГДА (даже если на предмете есть надписи). Мягко подскажи прислать именно рукописный крест блока.
Верни СТРОГО JSON: {"matched": boolean, "feedback": string}
feedback — тёплый и краткий (2–4 предложения) на русском, без осуждения.`

export async function checkCrossPhoto(
  imageBase64: string,
  imageMediaType: string,
  orderNum: number,
  title: string,
  userId: string | null,
  reference?: RefImage | null,
): Promise<CrossCheckResult> {
  const rubric = rubricFor(orderNum, title)

  let res
  if (reference) {
    const userMessage = `Блок «${title}».\n\nПЕРВОЕ фото — ЭТАЛОН правильного креста блока.\nВТОРОЕ фото — крест ученика, нарисованный от руки.\n\nРубрика (что должно быть в кресте этого блока):\n${rubric}\n\nСверь крест ученика с эталоном ПО СМЫСЛУ И СТРУКТУРЕ и дай мягкий вердикт.`
    res = await callAnthropic<{ matched?: boolean; feedback?: string }>({
      model: CLAUDE_SONNET_MODEL,
      systemPrompt: SYSTEM_WITH_REF,
      userMessage,
      purpose: 'check_cross_photo',
      userId,
      expectJson: true,
      maxTokens: 600,
      images: [
        { base64: reference.base64, mediaType: reference.mediaType },
        { base64: imageBase64, mediaType: imageMediaType },
      ],
    })
  } else {
    const userMessage = `Блок «${title}».\n\nРубрика — что должно быть в кресте этого блока:\n${rubric}\n\nНа фото — крест ученика. Сверь по смыслу и дай мягкий вердикт.`
    res = await callAnthropic<{ matched?: boolean; feedback?: string }>({
      model: CLAUDE_SONNET_MODEL,
      systemPrompt: SYSTEM_NO_REF,
      userMessage,
      purpose: 'check_cross_photo',
      userId,
      expectJson: true,
      maxTokens: 600,
      imageBase64,
      imageMediaType,
    })
  }

  const parsed = res.parsed
  return {
    matched: parsed?.matched ?? true, // при сбое парсинга — не блокируем (fail-open)
    feedback: parsed?.feedback?.trim() || 'Фото получено. Спасибо!',
  }
}
