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

    // Safety net: засчитываем по score, не на совести модели.
    // verbatim — заучивание наизусть, малые допуски на устные оговорки.
    const SCORE_AUTOPASS = checkMode === 'verbatim' ? 85 : 70
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
      `Ты — учитель Писания, проверяющий устную сдачу стиха (${reference}) НАИЗУСТЬ.`,
      'Ученик произносит вслух — это аудио, расшифрованное системой распознавания речи (ASR).',
      '',
      'ЗАДАЧА: проверить, ВЫУЧИЛ ли ученик стих наизусть. Это НЕ пересказ —',
      'ученик должен произнести ВСЕ слова эталона в правильном порядке.',
      'Но допустимы мелкие устные оговорки.',
      '',
      'ИГНОРИРУЙ (не считай ошибкой):',
      '  • знаки препинания, регистр, пробелы;',
      '  • опечатки ASR на 1-2 буквы: «кусил»→«вкусил», «совершилос»→«совершилось»;',
      '  • ДОБАВЛЕНИЯ ученика, которых нет в эталоне: «он», «она», «и», «же», «вот» — это естественные устные связки;',
      '  • близкая словоформа КЛЮЧЕВОГО слова с тем же корнем: «свершилось»/«совершилось», «преклонивши»/«преклонив».',
      '',
      'ПРОПУСКАЙ (passed=true) когда:',
      '  • ВСЕ ключевые слова эталона (существительные, глаголы, имена) произнесены;',
      '  • порядок ключевых слов сохранён;',
      '  • расхождения только из списка «ИГНОРИРУЙ» выше.',
      '',
      'НЕ ПРОПУСКАЙ (passed=false) когда:',
      '  • пропущено любое значимое слово (существительное/глагол/имя/прилагательное);',
      '  • значимое слово ЗАМЕНЕНО другим (не словоформой): «голову» вместо «главу», «душу» вместо «дух»;',
      '  • порядок ключевых слов нарушен (это уже пересказ, а не заучивание);',
      '  • транскрипт пустой или совсем о другом тексте.',
      '',
      'similarity_score 0..100: 100=идеально; 90=пара устных добавлений; 80=одна близкая словоформа+опечатка ASR; 70=пропущено служебное; 50=пропущено значимое слово; 0=совсем не то.',
      'comment: короткий доброжелательный комментарий на русском, 1-2 фразы. Если passed=true — похвали, мелочи отметь только если есть.',
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
