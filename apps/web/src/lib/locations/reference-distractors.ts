/**
 * Near-miss дистракторы для режима «Викторина» (Откуда этот стих?).
 *
 * Цель: вместо «Луки 17:21» vs «Откровение 6:3» показывать
 * «Луки 17:21» vs «Луки 17:11», «Луки 18:9», «Иоанна 17:21».
 *
 * Алгоритм:
 *  1. Парсим reference → {book, chapter, verse} (учитывает «1 Иоанна», диапазоны).
 *  2. Из реального пула выбираем близкие ссылки (та же книга, родственная, та же книга другая глава, прочее).
 *  3. Если реального пула мало — синтезируем near-miss мутацией цифр правильной ссылки.
 *  4. Итог: ровно 3 уникальных дистрактора.
 */

export interface ParsedRef {
  book: string      // «Луки», «1 Иоанна», «Иоанна»
  chapter: number   // 17
  verse: number     // первый стих диапазона (28:18-20 → 18)
  raw: string       // исходная строка
}

/**
 * Парсит строку вида «Луки 17:21», «1 Иоанна 5:10-13», «Матфея 28:18-20».
 * Возвращает null если не удалось распарсить.
 */
export function parseReference(ref: string): ParsedRef | null {
  // Нумерованные книги начинаются с цифры: «1 Иоанна», «2 Коринфянам»
  const m = ref.match(/^(\d\s+\S+|\S+)\s+(\d+):(\d+)(?:-\d+)?$/)
  if (!m) return null
  const book = m[1].trim()
  const chapter = parseInt(m[2], 10)
  const verse = parseInt(m[3], 10)
  if (isNaN(chapter) || isNaN(verse)) return null
  return { book, chapter, verse, raw: ref }
}

/**
 * Статический словарь «родственных» книг (группы по богословской близости).
 * Если книга A и книга B в одной группе — они считаются «родственными».
 */
const RELATED_BOOKS: ReadonlyArray<ReadonlyArray<string>> = [
  // Евангелия
  ['Матфея', 'Марка', 'Луки', 'Иоанна'],
  // Послания Иоанна
  ['Иоанна', '1 Иоанна', '2 Иоанна', '3 Иоанна'],
  // Павловы послания
  [
    'Римлянам', '1 Коринфянам', '2 Коринфянам', 'Галатам',
    'Ефесянам', 'Филиппийцам', 'Колоссянам',
    '1 Фессалоникийцам', '2 Фессалоникийцам',
    '1 Тимофею', '2 Тимофею', 'Титу', 'Филимону',
  ],
  // Соборные послания
  ['Евреям', 'Иакова', '1 Петра', '2 Петра', '1 Иоанна', '2 Иоанна', '3 Иоанна', 'Иуды'],
  // Пятикнижие
  ['Бытие', 'Исход', 'Левит', 'Числа', 'Второзаконие'],
  // Псалмы + Притчи + Екклесиаст + Песни Песней
  ['Псалтирь', 'Притчи', 'Екклесиаст', 'Песни Песней'],
  // Книги Царств
  ['1 Царств', '2 Царств', '3 Царств', '4 Царств', '1 Паралипоменон', '2 Паралипоменон'],
  // Большие пророки
  ['Исаия', 'Иеремия', 'Иезекиль', 'Даниил'],
]

function relatedBooks(book: string): Set<string> {
  for (const group of RELATED_BOOKS) {
    if (group.includes(book)) return new Set(group)
  }
  return new Set()
}

/** Оценка «близости» двух parsed references (меньше = ближе). */
function proximity(correct: ParsedRef, candidate: ParsedRef): number {
  if (candidate.book === correct.book) {
    const chapterDiff = Math.abs(candidate.chapter - correct.chapter)
    const verseDiff = Math.abs(candidate.verse - correct.verse)
    if (chapterDiff === 0) return verseDiff           // та же глава — лучший вариант
    return 100 + chapterDiff * 10 + verseDiff         // та же книга, другая глава
  }
  if (relatedBooks(correct.book).has(candidate.book)) {
    return 500                                         // родственная книга
  }
  return 9999                                          // остальное
}

/**
 * Синтезирует near-miss мутацией цифр (глава/стих ±1..3).
 * Возвращает raw-строку. НЕ проверяет существование стиха в каноне —
 * только гарантирует chapter >= 1 и verse >= 1.
 */
function synthesize(parsed: ParsedRef, occupied: Set<string>): string | null {
  const deltas = [1, -1, 2, -2, 3, -3]
  // Сначала мутируем стих, потом главу
  for (const dv of deltas) {
    const v = parsed.verse + dv
    if (v < 1) continue
    const raw = `${parsed.book} ${parsed.chapter}:${v}`
    if (!occupied.has(raw.toLowerCase())) return raw
  }
  for (const dc of deltas) {
    const c = parsed.chapter + dc
    if (c < 1) continue
    const raw = `${parsed.book} ${c}:${parsed.verse}`
    if (!occupied.has(raw.toLowerCase())) return raw
  }
  return null
}

/** Fisher–Yates без мутации. */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Выбирает ровно `needed` дистракторов (по умолчанию 3) для `correct`
 * из `allRefs` (реальный пул ссылок набора).
 *
 * Гарантии:
 *  - ни один дистрактор не равен `correct` (case-insensitive)
 *  - дистракторы уникальны между собой
 *  - ровно `needed` штук (дополняется синтезом если пула мало)
 */
export function pickReferenceDistractors(
  correct: string,
  allRefs: string[],
  needed = 3,
): string[] {
  const correctLower = correct.toLowerCase()
  const pool = allRefs.filter((r) => r.toLowerCase() !== correctLower)

  const parsedCorrect = parseReference(correct)

  // Если не смогли распарсить — fallback на случайный выбор (как раньше)
  if (!parsedCorrect) {
    return shuffled(pool).slice(0, needed)
  }

  // Парсим весь пул и сортируем по близости
  const withProximity = pool
    .map((r) => ({ raw: r, parsed: parseReference(r) }))
    .map(({ raw, parsed }) => ({
      raw,
      score: parsed ? proximity(parsedCorrect, parsed) : 10000,
    }))
    .sort((a, b) => a.score - b.score)

  const occupied = new Set<string>([correctLower])
  const result: string[] = []

  for (const { raw } of withProximity) {
    if (result.length >= needed) break
    const lw = raw.toLowerCase()
    if (!occupied.has(lw)) {
      occupied.add(lw)
      result.push(raw)
    }
  }

  // Синтезируем near-miss если реального пула не хватило
  if (result.length < needed) {
    for (let attempt = 0; attempt < 20 && result.length < needed; attempt++) {
      const syn = synthesize(parsedCorrect, occupied)
      if (syn) {
        occupied.add(syn.toLowerCase())
        result.push(syn)
      }
    }
  }

  // Абсолютный fallback — случайный остаток пула (не должен понадобиться)
  if (result.length < needed) {
    const extra = shuffled(pool.filter((r) => !occupied.has(r.toLowerCase())))
    for (const r of extra) {
      if (result.length >= needed) break
      result.push(r)
    }
  }

  return result
}
