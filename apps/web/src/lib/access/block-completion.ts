/**
 * Клиентские чистые функции для ДНЕВНОЙ модели разблокировки блоков.
 *
 * Блок «выполнен» = closedDays >= 7 + quiz + friday (эпоха пятницы).
 *
 * Блок с order_num=N доступен когда:
 *   - order_num <= 1, ИЛИ
 *   - canSkip = TRUE, ИЛИ
 *   - ПРЕДЫДУЩИЙ блок (order_num N-1) выполнен.
 *
 * Соответствует SQL-функции is_block_unlocked на сервере.
 */

const CLOSED_DAYS_REQUIRED = 7

export interface BlockCompletionData {
  /** Количество закрытых дней (из rpc user_closed_days) */
  closedDays: number
  /** Квиз пройден */
  quiz: boolean
  /** Эпоха пятницы выполнена */
  fridayDone: boolean
}

/**
 * Блок «выполнен» — все три условия выполнены.
 */
export function isBlockComplete(data: BlockCompletionData): boolean {
  // Эпоха пятницы больше НЕ обязательна (объединена с эмоциями, по желанию).
  return data.closedDays >= CLOSED_DAYS_REQUIRED && data.quiz
}

/**
 * Что НЕ выполнено в блоке (для подсказки пользователю).
 */
export function blockIncompleteReasons(data: BlockCompletionData): string[] {
  const reasons: string[] = []
  if (data.closedDays < CLOSED_DAYS_REQUIRED) {
    reasons.push(`закрытых дней ${data.closedDays}/${CLOSED_DAYS_REQUIRED}`)
  }
  if (!data.quiz) reasons.push('квиз не сдан')
  return reasons
}

export interface BlockWithOrderNum {
  id: number
  order_num: number | null
}

/**
 * TRUE если блок с данным blockId разблокирован.
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
 * Для заблокированного блока возвращает что нужно сдать в предыдущем.
 * Пример: «Сначала заверши Блок 2: закрыто дней 4/7, квиз ✗, пятница ✓»
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

  const daysPart = `закрыто дней ${data.closedDays}/${CLOSED_DAYS_REQUIRED}`
  const quizMark = data.quiz ? '✓' : '✗'

  return `Сначала заверши Блок ${orderNum - 1}: ${daysPart}, квиз ${quizMark}`
}
