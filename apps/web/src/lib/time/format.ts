/**
 * Форматирование дат для отображения (только UI, не для логики).
 * Все ключи и сравнения дат оставлять в формате YYYY-MM-DD.
 */

/**
 * Форматирует ISO-дату YYYY-MM-DD в русский формат ДД.ММ.ГГГГ.
 * Работает без создания Date-объекта (нет проблем с часовыми поясами).
 */
export function formatRuDate(iso: string): string {
  // Ожидаем YYYY-MM-DD
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}.${m}.${y}`
}
