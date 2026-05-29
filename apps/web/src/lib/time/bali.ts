// Бали — Asia/Makassar, UTC+8, без перехода на летнее время.
const BALI_OFFSET_MS = 8 * 60 * 60 * 1000

/** Текущая дата по Бали в формате YYYY-MM-DD. */
export function baliToday(now: Date = new Date()): string {
  return new Date(now.getTime() + BALI_OFFSET_MS).toISOString().slice(0, 10)
}
