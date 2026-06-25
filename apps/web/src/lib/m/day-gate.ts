/**
 * Дневной гейт прохождения блока — КАНОН (Михаил, 2026-06-25).
 *
 * Модель = СЧЁТЧИК закрытых дней, НЕ календарь с фиксированными датами:
 *  - «День учёбы» закрыт = за эту локальную дату сданы все 4 практики
 *    (фото креста + молитва + местописания-видео + пересказ-аудио).
 *  - Следующий день (и первый день нового блока) открывается ТОЛЬКО с 00:00
 *    следующих суток по поясу ученика → действовать сегодня можно, только если
 *    localToday > последней полностью закрытой даты по всему курсу.
 *  - Если ученик не заходит — текущий день «висит» и ждёт (ничего не сгорает,
 *    дата не уезжает в будущее).
 *  - Пока не закрыты 7 дней — блок не завершён; закрыл 7-й → следующий блок
 *    открывается сразу (гейт is_block_unlocked completion-based).
 *
 * Даты — строки YYYY-MM-DD (лексикографическое сравнение = хронологическое),
 * без Date-объектов, чтобы не ловить сдвиги часовых поясов.
 */

import { studentLocalToday } from '@/lib/time/local-day'

export const DAY_TARGET = 7

export interface DayGate {
  /** Локальная дата ученика «сегодня» (YYYY-MM-DD, пояс города, дефолт Бали). */
  localToday: string
  /** Закрытых дней в ЭТОМ блоке (уникальные даты с 4 практиками). */
  closedDays: number
  /** Цель — 7. */
  target: number
  /** Блок завершён (>=7 закрытых дней). */
  blockComplete: boolean
  /** Последняя полностью закрытая дата по ВСЕМ блокам курса (или null). */
  maxClosedDate: string | null
  /**
   * Можно ли сегодня работать над новым/текущим днём.
   * TRUE если блок не завершён И (нет закрытых дней ИЛИ localToday строго позже
   * последней закрытой даты). Внутри незакрытого дня (частичный прогресс сегодня)
   * остаётся TRUE — день ещё не закрыт, его можно дозакрыть.
   */
  canActToday: boolean
  /**
   * Следующий день заблокирован до 00:00 (сегодня уже закрыт день, либо это
   * первый день нового блока в те же сутки, что закрыт 7-й день предыдущего).
   */
  nextDayLocked: boolean
}

/**
 * Загружает дневной гейт для (user, block).
 * supabase — service-role клиент (rpc требуют service_role).
 */
export async function loadDayGate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  blockId: number,
): Promise<DayGate> {
  const [localToday, closedRowsRes, maxDateRes] = await Promise.all([
    studentLocalToday(supabase, userId),
    supabase.rpc('user_closed_days', { p_user_id: userId }),
    supabase.rpc('user_max_closed_date', { p_user_id: userId }),
  ])

  const closedRows = (closedRowsRes?.data ?? []) as Array<{ block_id: number; days: number }>
  const row = closedRows.find((r) => Number(r.block_id) === blockId)
  const closedDays = row ? Number(row.days) : 0
  const blockComplete = closedDays >= DAY_TARGET

  // rpc возвращает date как строку YYYY-MM-DD (или null)
  const maxClosedDate = (maxDateRes?.data as string | null) ?? null

  const canActToday =
    !blockComplete && (maxClosedDate === null || localToday > maxClosedDate)
  const nextDayLocked =
    !blockComplete && maxClosedDate !== null && localToday <= maxClosedDate

  return {
    localToday,
    closedDays,
    target: DAY_TARGET,
    blockComplete,
    maxClosedDate,
    canActToday,
    nextDayLocked,
  }
}

/**
 * Серверный гвард сдачи дневной практики. Запрещает «забегание»:
 * нельзя начать новый день/первый день нового блока раньше 00:00 следующих суток.
 * НЕ мешает дозакрыть сегодняшний день и не мешает переотправить уже сделанную
 * сегодня практику.
 *
 * @param gate           результат loadDayGate
 * @param taskDoneToday  сделана ли ЭТА практика уже сегодня (тогда разрешаем — это переотправка)
 * @returns null если можно; иначе текст ошибки для 403.
 */
export function dayGateRejection(gate: DayGate, taskDoneToday: boolean): string | null {
  // Блокируем ТОЛЬКО строго прошлые дни (localToday < maxClosedDate). Сегодняшний
  // день (localToday === maxClosedDate) НИКОГДА не блокируем — даже если он закрылся
  // за счёт других практик. Так легитимная сдача за сегодня не падает с DAY_LOCKED.
  // «Не забегать на новый день/блок» обеспечивает дисплей (кнопка скрыта), а не этот гвард.
  if (gate.maxClosedDate !== null && gate.localToday < gate.maxClosedDate && !taskDoneToday) {
    return 'Следующий день откроется в 00:00 по твоему времени.'
  }
  return null
}
