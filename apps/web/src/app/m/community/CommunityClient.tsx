'use client'

import { useCallback, useEffect, useState } from 'react'
import { PostCard } from './PostCard'
import { PostComposer } from './PostComposer'
import type { FeedPost, FeedResponse } from './types'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      ?.Telegram?.WebApp?.initData ?? ''
  )
}

type LoadState = 'idle' | 'loading' | 'error'

export function CommunityClient() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (before?: string) => {
    if (before) {
      setLoadingMore(true)
    } else {
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
        setPosts(data.posts ?? [])
      }
      setHasMore(data.has_more ?? false)
      setLoadState('idle')
    } catch {
      setLoadState('error')
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
