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

// 1-2 попытка — мягко (свежее заучивание),
// 3-4 — средне, 5+ — строго (уже неделя зубрёжки).
export type StrictnessLevel = 'lenient' | 'medium' | 'strict'

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

export function pickStrictness(attemptNumber: number): StrictnessLevel {
  if (attemptNumber <= 2) return 'lenient'
  if (attemptNumber <= 4) return 'medium'
  return 'strict'
}

/**
 * Нормализация для строкового сравнения:
 *  • нижний регистр;
 *  • ё → е;
 *  • убираем всё кроме русских/латинских букв и пробелов (знаки препинания, цифры);
 *  • схлопываем пробелы.
 * ASR расставляет пунктуацию случайно, регистр неважен — поэтому чистим агрессивно.
 */
export function normalizeForCompare(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * «Корень» слова для сравнения близких словоформ.
 * Отрезаем типичные русские окончания (царство/царствие, славу/слава → корень совпадает).
 * Грубая, но достаточная эвристика — нам нужно лишь засчитывать падежные/орфографические отличия.
 */
function stem(word: string): string {
  if (word.length <= 4) return word
  // частые окончания/суффиксы (по убыванию длины)
  const endings = [
    'иями', 'ями', 'ами', 'ием', 'ия', 'ие', 'ий', 'ью', 'ом', 'ем', 'ах', 'ях',
    'ов', 'ев', 'ой', 'ей', 'ую', 'юю', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
    'а', 'я', 'о', 'е', 'у', 'ю', 'ы', 'и', 'й', 'ь',
  ]
  for (const e of endings) {
    if (word.length - e.length >= 3 && word.endsWith(e)) {
      return word.slice(0, word.length - e.length)
    }
  }
  return word
}

/** Расстояние Левенштейна (для оценки похожести двух слов). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array(n + 1)
  let curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

/** Два слова «совпадают» если равны корни ИЛИ они близки по Левенштейну. */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  const sa = stem(a)
  const sb = stem(b)
  if (sa === sb) return true // царство/царствие, славу/слава
  // короткие словоформы: одно слово — другое + хвост-окончание («дух»/«духа», «дне»/«день»)
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 3 && longer.length - shorter.length <= 2 && longer.startsWith(shorter)) {
    return true
  }
  // близкая опечатка/словоформа: расстояние ≤ 2 при длине ≥ 5
  if (longer.length >= 5 && levenshtein(a, b) <= 2) return true
  if (longer.length >= 8 && levenshtein(a, b) <= 3) return true
  return false
}

/**
 * Локальная fuzzy-оценка дословной сдачи (0..100).
 * Идём по словам эталона и считаем, сколько из них «покрыто» транскриптом
 * (с учётом близких словоформ). Порядок не строгий — для safety net этого достаточно,
 * жёсткость порядка оставляем модели.
 */
export function fuzzyVerbatimScore(transcript: string, exactText: string): number {
  const refWords = normalizeForCompare(exactText).split(' ').filter(Boolean)
  const saidWords = normalizeForCompare(transcript).split(' ').filter(Boolean)
  if (refWords.length === 0) return 0
  if (saidWords.length === 0) return 0

  const used = new Array(saidWords.length).fill(false)
  let matched = 0
  for (const rw of refWords) {
    for (let i = 0; i < saidWords.length; i++) {
      if (used[i]) continue
      if (wordsMatch(rw, saidWords[i])) {
        used[i] = true
        matched++
        break
      }
    }
  }
  return Math.round((matched / refWords.length) * 100)
}

export async function checkLocation(
  transcript: string,
  exactText: string,
  checkMode: CheckMode,
  reference: string,
  userId: string,
  attemptNumber = 1,
  dbThreshold?: number | null,
): Promise<LocationCheckResult> {
  const strictness = pickStrictness(attemptNumber)
  const systemPrompt = buildSystemPrompt(checkMode, reference, strictness)
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
    const aiScore = typeof parsed?.similarity_score === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.similarity_score)))
      : 0
    const comment = parsed?.comment ?? result.text.slice(0, 400)

    // Локальная fuzzy-оценка (нормализация регистра/ё, сравнение по корням + Левенштейн).
    // Засчитывает близкие словоформы: «царство»/«царствие», «славу»/«слава», «духа»/«дух».
    // Для meaning-режима дословное покрытие не показатель, поэтому считаем только для verbatim.
    const fuzzy = checkMode === 'verbatim' ? fuzzyVerbatimScore(transcript, exactText) : 0

    // Итоговый score — максимум из оценки модели и локальной fuzzy-оценки.
    const score = Math.max(aiScore, fuzzy)

    // Safety net: засчитываем по score, не на совести модели.
    // Пороги СНИЖЕНЫ на ~10-12 пунктов против прежних (85/90/95 → 75/80/85),
    // чтобы мелкие падежные/орфографические отличия и опечатки ASR проходили.
    // Порог по-прежнему растёт с числом попыток: дальше — строже.
    let SCORE_AUTOPASS: number
    if (checkMode === 'meaning') {
      SCORE_AUTOPASS = 62
    } else if (strictness === 'lenient') {
      SCORE_AUTOPASS = 75
    } else if (strictness === 'medium') {
      SCORE_AUTOPASS = 80
    } else {
      SCORE_AUTOPASS = 85
    }

    // Порог из БД (block_locations_to_recite.similarity_threshold, 0..1) может ТОЛЬКО
    // понизить эффективную планку, но не поднять её выше нашего смягчённого дефолта.
    // Дополнительно снимаем 8 пунктов с DB-порога, чтобы близкие ответы засчитывались.
    let effectiveAutopass = SCORE_AUTOPASS
    if (typeof dbThreshold === 'number' && dbThreshold > 0) {
      const dbScore100 = Math.round((dbThreshold <= 1 ? dbThreshold * 100 : dbThreshold)) - 8
      effectiveAutopass = Math.min(effectiveAutopass, Math.max(60, dbScore100))
    }

    const passed = aiPassed || score >= effectiveAutopass

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

function buildSystemPrompt(checkMode: CheckMode, reference: string, strictness: StrictnessLevel): string {
  if (checkMode === 'verbatim') {
    const strictnessBlock = buildStrictnessBlock(strictness)
    return [
      `Ты — учитель Писания, проверяющий устную сдачу стиха (${reference}) НАИЗУСТЬ.`,
      'Ученик произносит вслух — это аудио, расшифрованное системой распознавания речи (ASR).',
      '',
      'ЗАДАЧА: проверить, ВЫУЧИЛ ли ученик стих наизусть. Это НЕ пересказ —',
      'ученик должен произнести ВСЕ слова эталона в правильном порядке.',
      '',
      'ВСЕГДА ИГНОРИРУЙ (это устная сдача, не диктант — на любом уровне строгости):',
      '  • знаки препинания: точки, запятые, восклицательные/вопросительные знаки, тире, двоеточия;',
      '  • регистр букв (заглавные/строчные);',
      '  • пробелы и переносы строк;',
      '  • расстановку ударений.',
      'Распознавание речи (ASR) расставляет знаки препинания случайно — поэтому НИКОГДА не упоминай их в комментарии и не учитывай в оценке.',
      '',
      strictnessBlock,
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
  const meaningStrictnessBlock = buildMeaningStrictnessBlock(strictness)
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
    meaningStrictnessBlock,
    '',
    'Верни ТОЛЬКО валидный JSON без лишнего текста:',
    '{ "passed": true/false, "similarity_score": 0..100, "comment": "краткий комментарий на русском" }',
  ].join('\n')
}

function buildStrictnessBlock(strictness: StrictnessLevel): string {
  if (strictness === 'lenient') {
    return [
      'УРОВЕНЬ СТРОГОСТИ: МЯГКИЙ (первые попытки, ученик только учит).',
      '',
      'ДОПОЛНИТЕЛЬНО ИГНОРИРУЙ (не считай ошибкой):',
      '  • опечатки ASR на 1-2 буквы внутри слова: «кусил»→«вкусил», «совершилос»→«совершилось»;',
      '  • ДОБАВЛЕНИЯ ученика, которых нет в эталоне: «он», «она», «и», «же», «вот» — естественные устные связки;',
      '  • близкая словоформа КЛЮЧЕВОГО слова с тем же корнем: «свершилось»/«совершилось», «преклонивши»/«преклонив».',
      '',
      'ПРОПУСКАЙ (passed=true) когда ВСЕ ключевые слова эталона произнесены, порядок сохранён, расхождения только из списка «ИГНОРИРУЙ».',
    ].join('\n')
  }
  if (strictness === 'medium') {
    return [
      'УРОВЕНЬ СТРОГОСТИ: СРЕДНИЙ (ученик уже несколько раз сдавал).',
      '',
      'ДОПОЛНИТЕЛЬНО ИГНОРИРУЙ (не считай ошибкой):',
      '  • опечатки ASR на 1 букву внутри слова (явный артефакт распознавания речи).',
      '',
      'НЕ ИГНОРИРУЙ (на этом уровне ученик должен знать точнее):',
      '  • добавления слов, которых нет в эталоне («он», «и», «же») — это ошибка;',
      '  • любая словоформа должна совпадать с эталоном (никаких «свершилось»/«совершилось»).',
      '',
      'ПРОПУСКАЙ (passed=true) только когда стих произнесён почти идеально (1 ASR-опечатка максимум).',
    ].join('\n')
  }
  // strict
  return [
    'УРОВЕНЬ СТРОГОСТИ: ВЫСОКИЙ (ученик зубрит уже неделю, должен знать наизусть).',
    '',
    'ДОПОЛНИТЕЛЬНО ИГНОРИРУЙ только очевидные опечатки ASR (1 буква внутри слова, не больше).',
    '',
    'НЕ ИГНОРИРУЙ:',
    '  • любые добавления, пропуски или замены слов;',
    '  • любые отклонения в словоформах;',
    '  • любые перестановки слов.',
    '',
    'ПРОПУСКАЙ (passed=true) ТОЛЬКО когда все слова произнесены точно по эталону. Знаки препинания НЕ учитываются (это устная сдача).',
  ].join('\n')
}

function buildMeaningStrictnessBlock(strictness: StrictnessLevel): string {
  if (strictness === 'lenient') {
    return [
      'УРОВЕНЬ СТРОГОСТИ: МЯГКИЙ (первые дни учения).',
      '',
      'ТОНУС ОТВЕТА:',
      '  • НАЧНИ комментарий с похвалы: «Отлично!», «Хорошо уловил суть!», «Вы передали главное!».',
      '  • Только ПОТОМ (если нужно) мягко упомяни, что можно было добавить.',
      '',
      'ОЦЕНКА:',
      '  • Засчитывай если ученик передал основной смысл, даже если упустил детали.',
      '  • Допускай упущение второстепенных моментов и примеров.',
      '  • Не требуй полноты и точности формулировок.',
      '',
      'similarity_score: 70+ засчитываем, даже если AI сказал false.',
    ].join('\n')
  }
  if (strictness === 'medium') {
    return [
      'УРОВЕНЬ СТРОГОСТИ: СРЕДНИЙ (ученик уже несколько дней сдаёт).',
      '',
      'ТОНУС ОТВЕТА:',
      '  • Начни с признания того, что ученик сделал хорошо.',
      '  • Упомяни, что можно улучшить, но доброжелательно.',
      '',
      'ОЦЕНКА:',
      '  • Засчитывай если основной смысл передан.',
      '  • Ученик может упустить второстепенные детали.',
      '  • Требуй понимания центральной идеи фрагмента.',
      '',
      'similarity_score: 70+ засчитываем.',
    ].join('\n')
  }
  // strict
  return [
    'УРОВЕНЬ СТРОГОСТИ: ВЫСОКИЙ (ученик уже неделю сдаёт).',
    '',
    'ТОНУС ОТВЕТА:',
    '  • Объективно оцени передачу смысла.',
    '  • Похвали за понимание, но укажи на упущенные элементы.',
    '',
    'ОЦЕНКА:',
    '  • Засчитывай только если ученик передал центральный смысл И ключевые элементы идеи.',
    '  • Требуй лучшего понимания деталей фрагмента.',
    '',
    'similarity_score: 75+ засчитываем.',
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
