'use client'

import { useFavorites } from './useFavorites'

// Звёздочка «в избранное» для конкретного стиха.
export function FavStar({ verseId }: { verseId: string }) {
  const { isFav, toggle } = useFavorites()
  const fav = isFav(verseId)
  return (
    <button
      type="button"
      className={`fav-star${fav ? ' fav-star--on' : ''}`}
      onClick={() => toggle(verseId)}
      aria-label={fav ? 'Убрать из избранного' : 'Добавить в избранное'}
    >
      {fav ? '★' : '☆'}
    </button>
  )
}
