/**
 * Хелперы для недельной модели разблокировки блоков.
 *
 * Правило: блок с order_num=N доступен когда
 *   NOW() >= course_started_at + (N-1)*7 дней
 * order_num <= 1 (Подготовка + Малый крест) — открыты сразу со старта.
 *
 * Должны совпадать по логике с SQL-функцией is_block_unlocked.
 */

const MS_PER_DAY = 86_400_000

/**
 * Дата открытия блока.
 * Возвращает null если courseStartedAt не задан.
 */
export function blockUnlockDate(
  courseStartedAt: string | null | undefined,
  orderNum: number,
): Date | null {
  if (!courseStartedAt) return null
  const start = new Date(courseStartedAt).getTime()
  if (isNaN(start)) return null
  const offsetDays = Math.max(0, orderNum - 1) * 7
  return new Date(start + offsetDays * MS_PER_DAY)
}

/**
 * TRUE если блок уже разблокирован к моменту now.
 */
export function isBlockUnlocked(
  courseStartedAt: string | null | undefined,
  orderNum: number,
  canSkip: boolean,
  now: Date = new Date(),
): boolean {
  if (canSkip) return true
  if (orderNum <= 1) return true
  const unlockDate = blockUnlockDate(courseStartedAt, orderNum)
  if (!unlockDate) return false
  return now.getTime() >= unlockDate.getTime()
}

/**
 * Целое число полных дней до открытия блока (0 если уже открыт / canSkip).
 */
export function daysUntilUnlock(
  courseStartedAt: string | null | undefined,
  orderNum: number,
  now: Date = new Date(),
): number {
  const unlockDate = blockUnlockDate(courseStartedAt, orderNum)
  if (!unlockDate) return 0
  const diff = unlockDate.getTime() - now.getTime()
  if (diff <= 0) return 0
  return Math.ceil(diff / MS_PER_DAY)
}

/**
 * Форматирует дату открытия как «ДД.ММ» (ru-RU).
 * Возвращает null если дата недоступна.
 */
export function formatUnlockDate(date: Date | null): string | null {
  if (!date) return null
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
