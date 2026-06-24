'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Универсальный клиентский SWR-кэш для read-only данных MiniApp (дашборд,
 * лидерборд, лента). Мгновенный рендер из памяти (stale-while-revalidate) +
 * дедуп одновременных запросов. Кэш в памяти живёт в рамках сессии SPA —
 * возврат на экран открывается мгновенно, без спиннера, и фоном обновляется.
 *
 * Для статусов, влияющих на корректность дня, используйте block-status-cache
 * (короткий TTL + обязательный рефетч). Здесь — только декоративные списки.
 */

const mem = new Map<string, { data: unknown; ts: number }>()
const inflight = new Map<string, Promise<unknown>>()

export function getCached<T>(key: string, maxAgeMs: number): T | null {
  const e = mem.get(key)
  return e && Date.now() - e.ts < maxAgeMs ? (e.data as T) : null
}

export function setCached(key: string, data: unknown): void {
  mem.set(key, { data, ts: Date.now() })
}

export function invalidateCache(key: string): void {
  mem.delete(key)
}

/**
 * Возвращает { data, loading }. data — из кэша мгновенно (если есть, до maxAgeMs),
 * затем фон обновляет. loading=true только когда кэша нет и идёт первый запрос.
 */
export function useSwrCache<T>(
  key: string | null,
  fetcher: () => Promise<T | null>,
  maxAgeMs = 600_000,
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(() =>
    key ? getCached<T>(key, maxAgeMs) : null,
  )
  const [loading, setLoading] = useState<boolean>(() => !(key && getCached<T>(key, maxAgeMs)))

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!key) return
    const cached = getCached<T>(key, maxAgeMs)
    if (cached != null) {
      setData(cached)
      setLoading(false)
    }

    let cancelled = false
    let p = inflight.get(key) as Promise<T | null> | undefined
    if (!p) {
      p = fetcherRef
        .current()
        .then((d) => {
          if (d != null) setCached(key, d)
          inflight.delete(key)
          return d
        })
        .catch(() => {
          inflight.delete(key)
          return null
        })
      inflight.set(key, p)
    }
    p.then((d) => {
      if (cancelled) return
      if (d != null) setData(d)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [key, maxAgeMs])

  return { data, loading }
}
