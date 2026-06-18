'use client'

import { useState } from 'react'
import type { FeedPost } from './types'

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 1) return 'только что'
    if (diffMin < 60) return `${diffMin} мин. назад`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH} ч. назад`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD} дн. назад`
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

interface Props {
  post: FeedPost
  onDelete: (id: string) => void
}

export function PostCard({ post, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const authorLine = post.author_city
    ? `${post.author_name} · ${post.author_city}`
    : post.author_name

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    try {
      const initData =
        (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
          ?.Telegram?.WebApp?.initData ?? ''
      const res = await fetch('/api/m/community/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, post_id: post.id }),
      })
      if (res.ok) {
        onDelete(post.id)
      }
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="cm-card">
      <div className="cm-card__head">
        <div className="cm-card__meta">
          <span className="cm-card__author">{authorLine}</span>
          <span className="cm-card__time">{formatTime(post.created_at)}</span>
        </div>
        {post.can_delete && (
          <button
            type="button"
            className={`cm-card__del${confirming ? ' cm-card__del--confirm' : ''}`}
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Удалить пост"
          >
            {confirming ? 'Удалить?' : '×'}
          </button>
        )}
      </div>

      {post.kind === 'text' && post.content_text && (
        <p className="cm-card__text">{post.content_text}</p>
      )}

      {post.kind === 'audio' && post.media_url && (
        <audio
          controls
          preload="none"
          src={post.media_url}
          className="cm-card__audio"
        />
      )}

      {post.kind === 'video_note' && post.media_url && (
        <div className="cm-card__circle-wrap">
          <video
            controls
            preload="none"
            src={post.media_url}
            className="cm-card__circle"
            playsInline
          />
        </div>
      )}

      {post.kind === 'photo' && post.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.media_url}
          alt={`Фото от ${post.author_name}`}
          className="cm-card__photo"
          loading="lazy"
        />
      )}

      {post.content_text && post.kind !== 'text' && (
        <p className="cm-card__caption">{post.content_text}</p>
      )}
    </div>
  )
}
