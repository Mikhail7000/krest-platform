/**
 * Клиентские чистые функции для НАКОПИТЕЛЬНОЙ модели разблокировки блоков.
 *
 * Блок с order_num=N доступен когда:
 *   - order_num <= 1 (Подготовка + Малый крест), ИЛИ
 *   - canSkip = TRUE, ИЛИ
 *   - ПРЕДЫДУЩИЙ блок (order_num N-1) выполнен: isBlockComplete() === true.
 *
 * «Выполнен» = quiz_passed_at IS NOT NULL
 *            + recitation_audio_passed_at IS NOT NULL
 *            + recitation_videos_passed_at IS NOT NULL
 *            + crossDays >= 7 уникальных дней с фото.
 *
 * Соответствует SQL-функции is_block_unlocked на сервере (уже обновлена).
 * Никаких вычислений от course_started_at / calendar здесь нет.
 */

export interface BlockCompletionData {
  quiz_passed_at: string | null | undefined
  recitation_audio_passed_at: string | null | undefined
  recitation_videos_passed_at: string | null | undefined
  /** Количество уникальных дней с фото креста для этого блока */
  crossDays: number
}

const CROSS_DAYS_REQUIRED = 7

/**
 * Блок «выполнен» — все четыре условия выполнены.
 */
export function isBlockComplete(data: BlockCompletionData): boolean {
  return (
    data.quiz_passed_at != null &&
    data.recitation_audio_passed_at != null &&
    data.recitation_videos_passed_at != null &&
    data.crossDays >= CROSS_DAYS_REQUIRED
  )
}

/**
 * Что НЕ выполнено в блоке (для подсказки пользователю).
 * Возвращает массив строк с описанием незавершённых шагов.
 */
export function blockIncompleteReasons(data: BlockCompletionData): string[] {
  const reasons: string[] = []
  if (!data.quiz_passed_at) reasons.push('квиз не сдан')
  if (!data.recitation_audio_passed_at) reasons.push('аудио местописаний не сдано')
  if (!data.recitation_videos_passed_at) reasons.push('кружки местописаний не сданы')
  if (data.crossDays < CROSS_DAYS_REQUIRED) {
    reasons.push(`дни креста ${data.crossDays}/${CROSS_DAYS_REQUIRED}`)
  }
  return reasons
}

export interface BlockWithOrderNum {
  id: number
  order_num: number | null
}

/**
 * TRUE если блок с данным blockId разблокирован по накопительной модели.
 *
 * @param blocks      — упорядоченный массив блоков (order_num asc)
 * @param blockId     — id проверяемого блока
 * @param canSkip     — флаг тестировщика / admin
 * @param completionByBlockId — карта blockId → BlockCompletionData
 */
export function isBlockUnlockedByCompletion(
  blocks: BlockWithOrderNum[],
  blockId: number,
  canSkip: boolean,
  completionByBlockId: Record<number, BlockCompletionData>,
): boolean {
  if (canSkip) return true

  const block = blocks.find((b) => b.id === blockId)
  if (!block) return false

  const orderNum = block.order_num ?? 0

  // Блок 0 и Блок 1 открыты всегда
  if (orderNum <= 1) return true

  // Найдём предыдущий блок (order_num = N-1)
  const prevBlock = blocks.find((b) => (b.order_num ?? 0) === orderNum - 1)
  if (!prevBlock) return false

  const prevCompletion = completionByBlockId[prevBlock.id]
  if (!prevCompletion) return false

  return isBlockComplete(prevCompletion)
}

/**
 * Для заблокированного блока возвращает что нужно сдать в предыдущем блоке.
 * Пример: «Сдай Блок 2: квиз ✗, аудио ✗, кружки ✓, дни 4/7».
 */
export function lockedBlockHint(
  blocks: BlockWithOrderNum[],
  blockId: number,
  completionByBlockId: Record<number, BlockCompletionData>,
): string | null {
  const block = blocks.find((b) => b.id === blockId)
  if (!block) return null

  const orderNum = block.order_num ?? 0
  if (orderNum <= 1) return null

  const prevBlock = blocks.find((b) => (b.order_num ?? 0) === orderNum - 1)
  if (!prevBlock) return null

  const data = completionByBlockId[prevBlock.id]
  if (!data) return `Сначала выполни Блок ${orderNum - 1}`

  const quizMark = data.quiz_passed_at ? '✓' : '✗'
  const audioMark = data.recitation_audio_passed_at ? '✓' : '✗'
  const videoMark = data.recitation_videos_passed_at ? '✓' : '✗'
  const daysPart = `дни ${data.crossDays}/${CROSS_DAYS_REQUIRED}`

  return `Сначала заверши Блок ${orderNum - 1}: квиз ${quizMark}, аудио ${audioMark}, кружки ${videoMark}, ${daysPart}`
}
