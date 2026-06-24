'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCached, setCached } from '@/lib/m/swr-cache'
import { PostCard } from './PostCard'
import { PostComposer } from './PostComposer'
import type { FeedPost, FeedResponse } from './types'

const FEED_CACHE_KEY = 'm:feed'
interface FeedCache {
  posts: FeedPost[]
  hasMore: boolean
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      ?.Telegram?.WebApp?.initData ?? ''
  )
}

type LoadState = 'idle' | 'loading' | 'error'

export function CommunityClient() {
  // SWR-кэш первой страницы: повторное открытие ленты — мгновенно из кэша,
  // фоном обновляется. Пагинация (показать ещё) и optimistic-пост не кэшируются.
  const [initialCache] = useState(() =>
    typeof window !== 'undefined' ? getCached<FeedCache>(FEED_CACHE_KEY, 180_000) : null,
  )
  const [posts, setPosts] = useState<FeedPost[]>(initialCache?.posts ?? [])
  const [hasMore, setHasMore] = useState(initialCache?.hasMore ?? false)
  const [loadState, setLoadState] = useState<LoadState>(initialCache ? 'idle' : 'loading')
  const [loadingMore, setLoadingMore] = useState(false)
  // true, если экран уже показан (из кэша или после загрузки) — тогда фоновое
  // обновление не мигает скелетоном и не показывает ошибку поверх контента.
  const seededRef = useRef(Boolean(initialCache))

  const load = useCallback(async (before?: string) => {
    if (before) {
      setLoadingMore(true)
    } else if (!seededRef.current) {
      setLoadState('loading')
    }
    try {
      const res = await fetch('/api/m/community/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), ...(before ? { before } : {}) }),
      })
      if (!res.ok) throw new Error('server')
      const data = (await res.json()) as FeedResponse
      if (before) {
        setPosts((prev) => [...prev, ...(data.posts ?? [])])
      } else {
        const fresh = data.posts ?? []
        setPosts(fresh)
        setCached(FEED_CACHE_KEY, { posts: fresh, hasMore: data.has_more ?? false })
        seededRef.current = true
      }
      setHasMore(data.has_more ?? false)
      setLoadState('idle')
    } catch {
      if (!seededRef.current) setLoadState('error')
    } finally {
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handlePosted = (post: FeedPost) => {
    setPosts((prev) => [post, ...prev])
  }

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  const loadMore = () => {
    const last = posts[posts.length - 1]
    if (last) load(last.created_at)
  }

  return (
    <div className="cm-root">
      <PostComposer onPosted={handlePosted} />

      {loadState === 'loading' && (
        <div className="cm-skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="cm-skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {loadState === 'error' && (
        <div className="cm-empty">
          <p className="cm-empty__text">Не удалось загрузить ленту</p>
          <button type="button" className="cm-ghost-btn" onClick={() => load()}>
            Повторить
          </button>
        </div>
      )}

      {loadState === 'idle' && posts.length === 0 && (
        <div className="cm-empty">
          <p className="cm-empty__text">Пока никто не поделился</p>
          <p className="cm-empty__hint">Стань первым — напиши что-нибудь выше</p>
        </div>
      )}

      {posts.length > 0 && (
        <div className="cm-feed">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}

          {hasMore && (
            <button
              type="button"
              className="cm-load-more"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Загружаем…' : 'Показать ещё'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
