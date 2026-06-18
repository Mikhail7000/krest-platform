/**
 * Грамматическая эвристика подбора дистракторов для режима «Пропуски» (cloze).
 *
 * Принцип: дистракторы должны выглядеть правдоподобно — совпадать по
 * окончанию (падеж/род/число) и близкой длине с правильным словом.
 *
 * Пример: «человекам» → «братьям», «народам» (одно окончание -ам/-ям)
 *         «положено»  → «суждено», «велено»  (одно окончание -ено)
 */

/** Строчная ли первая буква слова (нарицательное vs имя собственное). */
function isCommonWord(word: string): boolean {
  if (!word.length) return true
  // Слова с ЗАГЛАВНОЙ в любой позиции кроме нулевой — имена собственные
  // внутри стиха (Бог, Господь, Моисей, Иисус, Христос…).
  // Первая буква может быть заглавной если слово начинает предложение —
  // поэтому проверяем символы со второй позиции.
  const inner = word.slice(1)
  return !/[\p{Lu}]/u.test(inner)
}

/** Последние N букв слова (без пунктуации). */
function suffix(word: string, n: number): string {
  const lower = word.toLowerCase()
  return lower.slice(Math.max(0, lower.length - n))
}

interface DistractorOptions {
  correctWords: string[]
  wordPool: string[]
  /** Сколько дистракторов нужно. */
  needed: number
  /** Если true — исключаем имена собственные из кандидатов. */
  excludeProper?: boolean
}

/**
 * Выбирает `needed` дистракторов для массива правильных слов.
 * Ориентируется на ПЕРВОЕ слово из correctWords (основной «эталон»),
 * потому что за один раз прячется ≤3 слова и дистракторы идут общим пулом.
 *
 * Алгоритм с fallback-уровнями:
 *  1. Окончание ±2 буквы, длина ±2 символа, без имён собственных (если нужно)
 *  2. Только окончание ±2 буквы, любая длина
 *  3. Только близкая длина ±3 символа
 *  4. Любой остаток пула (случайная выборка — как раньше)
 */
export function pickClozeDistractors({
  correctWords,
  wordPool,
  needed,
  excludeProper = true,
}: DistractorOptions): string[] {
  // Правильные слова в lowercase для исключения
  const correctLower = new Set(correctWords.map((w) => w.toLowerCase()))

  // Кандидаты: не совпадают с правильными (case-insensitive)
  const candidates = wordPool.filter((w) => !correctLower.has(w.toLowerCase()))

  // Нужно ли фильтровать имена собственные?
  // Проверяем по ПЕРВОМУ правильному слову: если оно строчное — фильтруем.
  const mainWord = correctWords[0] ?? ''
  const mainIsCommon = excludeProper && isCommonWord(mainWord)

  // Пул с учётом фильтра имён
  const filtered = mainIsCommon
    ? candidates.filter((w) => isCommonWord(w))
    : candidates

  const mainLen = mainWord.length
  const suf3 = suffix(mainWord, 3)
  const suf2 = suffix(mainWord, 2)

  /**
   * Дедупликатор: собираем результат в Set (lowercase),
   * добавляем кандидатов из очереди уровней пока не наберём `needed`.
   */
  const resultSet = new Set<string>()
  const resultList: string[] = []

  function tryAdd(pool: string[]): void {
    for (const w of pool) {
      if (resultList.length >= needed) return
      const lw = w.toLowerCase()
      if (!resultSet.has(lw) && !correctLower.has(lw)) {
        resultSet.add(lw)
        resultList.push(w)
      }
    }
  }

  // Уровень 1: окончание 3 буквы + длина ±2 + фильтр имён
  const lvl1 = shuffled(
    filtered.filter((w) => suffix(w, 3) === suf3 && Math.abs(w.length - mainLen) <= 2),
  )
  tryAdd(lvl1)

  // Уровень 2: окончание 2 буквы + фильтр имён (любая длина)
  if (resultList.length < needed) {
    const lvl2 = shuffled(filtered.filter((w) => suffix(w, 2) === suf2))
    tryAdd(lvl2)
  }

  // Уровень 3: любая длина ±3, без имён (кандидаты всего пула)
  if (resultList.length < needed) {
    const pool3 = mainIsCommon ? filtered : candidates
    const lvl3 = shuffled(pool3.filter((w) => Math.abs(w.length - mainLen) <= 3))
    tryAdd(lvl3)
  }

  // Уровень 4 (fallback): весь candidates без фильтров
  if (resultList.length < needed) {
    tryAdd(shuffled(candidates))
  }

  return resultList
}

/** Fisher–Yates без мутации исходного массива. */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
