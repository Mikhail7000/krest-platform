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
    const aiPassed = parsed?.passed === true
    const score = typeof parsed?.similarity_score === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.similarity_score)))
      : 0
    const comment = parsed?.comment ?? result.text.slice(0, 400)

    // Safety net: AI часто бракует за окончание/запятую. Если смысл и слова
    // совпадают на 80+%, засчитываем — порог в коде, а не на совести модели.
    const SCORE_AUTOPASS = checkMode === 'verbatim' ? 80 : 70
    const passed = aiPassed || score >= SCORE_AUTOPASS

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
      `Ты — добрый учитель Писания, проверяющий устную сдачу стиха (${reference}).`,
      'Ученик произносит наизусть — это аудио, расшифрованное системой распознавания речи.',
      '',
      'ЗАДАЧА: понять, действительно ли ученик ВЫУЧИЛ стих, не цепляясь к мелочам.',
      '',
      'ИГНОРИРУЙ ПОЛНОСТЬЮ (не считай ошибкой):',
      '  • знаки препинания, регистр, пробелы;',
      '  • разные окончания одного слова (падеж, число, время) — "главу"/"глава", "сказал"/"сказала";',
      '  • опущенные или добавленные служебные слова — союзы "и/а/но", частицы "же/ли/то", артикли;',
      '  • опечатки распознавания речи (1-2 буквы внутри слова);',
      '  • незначительные перестановки внутри одной фразы.',
      '',
      'ПРОПУСКАЙ (passed=true) если:',
      '  • все КЛЮЧЕВЫЕ существительные и глаголы стиха произнесены;',
      '  • общий порядок мыслей сохранён;',
      '  • похоже что ученик действительно знает стих, а не импровизирует.',
      '',
      'НЕ ПРОПУСКАЙ (passed=false) только если:',
      '  • пропущено ≥3 значимых слова (не служебных);',
      '  • смысл фразы заметно искажён;',
      '  • транскрипт пустой или совсем о другом.',
      '',
      'similarity_score 0..100: 100=идеально, 85=мелкие огрехи окончаний/союзов, 70=пара значимых пропусков, 50=половина смысла, 0=совсем не то.',
      'comment: короткий доброжелательный комментарий на русском, не более 1-2 фраз. Если passed=true — похвали, отметь мелочи только если они есть.',
      '',
      'Верни ТОЛЬКО валидный JSON без лишнего текста:',
      '{ "passed": true/false, "similarity_score": 0..100, "comment": "..." }',
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
