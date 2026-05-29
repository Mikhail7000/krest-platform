'use client'

import { useEffect, useReducer } from 'react'

// Избранные местописания тренажёра. Хранятся в localStorage (на устройстве),
// общий module-store — чтобы звёздочки и фильтр синхронизировались между всеми
// компонентами без проп-дриллинга.
const KEY = 'krest-trainer-favorites'

function load(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

let favs = load()
const listeners = new Set<() => void>()

function persistAndEmit() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...favs]))
  } catch {
    /* localStorage недоступен — не критично */
  }
  listeners.forEach((l) => l())
}

export function useFavorites() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    force() // подхватить значение, прочитанное из localStorage после маунта
    return () => {
      listeners.delete(force)
    }
  }, [])

  return {
    isFav: (id: string) => favs.has(id),
    toggle: (id: string) => {
      favs = new Set(favs)
      if (favs.has(id)) favs.delete(id)
      else favs.add(id)
      persistAndEmit()
    },
    ids: [...favs],
    count: favs.size,
  }
}
