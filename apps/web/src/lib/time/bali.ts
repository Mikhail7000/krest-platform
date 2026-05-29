// Бали — Asia/Makassar, UTC+8, без перехода на летнее время.
const BALI_OFFSET_MS = 8 * 60 * 60 * 1000

/** Текущая дата по Бали в формате YYYY-MM-DD. */
export function baliToday(now: Date = new Date()): string {
  return new Date(now.getTime() + BALI_OFFSET_MS).toISOString().slice(0, 10)
}

/** Сдвиг даты YYYY-MM-DD на delta дней. */
export function addDaysStr(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Дата по Бали (YYYY-MM-DD) из произвольного timestamp (ISO/UTC). */
export function baliDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + BALI_OFFSET_MS).toISOString().slice(0, 10)
}
