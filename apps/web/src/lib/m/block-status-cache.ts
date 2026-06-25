'use client'

import { useEffect, useState } from 'react'

/**
 * Лёгкий клиентский SWR-кэш статуса блока.
 *
 * Зачем: на странице урока статус читают сразу 2-3 компонента (BlockProgress,
 * Stage4Status), а на дашборде — HeaderProgress. Раньше каждый делал свой
 * POST /api/m/block-status → дубли запросов и отдельные спиннеры.
 *
 * Что делает: (1) мгновенный рендер из памяти (cache-first), (2) дедуп
 * одновременных запросов в один промис, (3) фоновое обновление на каждом
 * mount (SWR). HeaderProgress на дашборде прогревает кэш → переход в урок
 * открывает статус мгновенно.
 *
 * Корректность дня: статус закрытия — СЕРВЕРНЫЙ (RPC). Кэш только для мгновенного
 * показа; фоновый fetch выполняется ВСЕГДА при mount и приносит свежие данные,
 * поэтому после сдачи задачи дисплей самообновляется (короткий TTL + рефетч).
 */

export interface BlockStatusData {
  ok: boolean
  closedDays: number
  target: number
  today: { cross: boolean; prayer: boolean; pereskaz: boolean; mestopisaniya: boolean }
  quiz: boolean
  friday: boolean
  /** Можно ли работать над днём сегодня (локальная дата позже последней закрытой). */
  canActToday: boolean
  /** Следующий день откроется в 00:00 (сегодня уже закрыт / первый день нового блока). */
  nextDayLocked: boolean
}

const TTL_MS = 12_000
const mem = new Map<number, { data: BlockStatusData; ts: number }>()
const inflight = new Map<number, Promise<BlockStatusData | null>>()

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

export function getCachedBlockStatus(blockId: number): BlockStatusData | null {
  const e = mem.get(blockId)
  if (e && Date.now() - e.ts < TTL_MS) return e.data
  return null
}

/** Сбросить кэш (например, сразу после сдачи задачи). Без аргумента — весь. */
export function invalidateBlockStatus(blockId?: number): void {
  if (blockId == null) mem.clear()
  else mem.delete(blockId)
}

/** Сетевой запрос с дедупом одновременных вызовов. Всегда обновляет кэш. */
export function fetchBlockStatus(blockId: number): Promise<BlockStatusData | null> {
  const existing = inflight.get(blockId)
  if (existing) return existing

  const p = fetch(`/api/m/block-status/${blockId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: getInitData() }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: BlockStatusData | null) => {
      if (d?.ok) mem.set(blockId, { data: d, ts: Date.now() })
      inflight.delete(blockId)
      return d?.ok ? d : null
    })
    .catch(() => {
      inflight.delete(blockId)
      return null
    })

  inflight.set(blockId, p)
  return p
}

/**
 * Хук: мгновенно отдаёт кэш (если свежий), затем фоном обновляет.
 * Несколько компонентов с одним blockId делят один сетевой запрос.
 */
export function useBlockStatus(blockId: number | null): BlockStatusData | null {
  const [data, setData] = useState<BlockStatusData | null>(() =>
    blockId != null ? getCachedBlockStatus(blockId) : null,
  )

  useEffect(() => {
    if (blockId == null) return
    const cached = getCachedBlockStatus(blockId)
    if (cached) setData(cached)
    let cancelled = false
    fetchBlockStatus(blockId).then((d) => {
      if (!cancelled && d) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [blockId])

  return data
}
