'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../_components/Avatar'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Профиль → «Моя карточка в рейтинге»: загрузка своей картинки-фона + предпросмотр.
 * Картинка показывается фоном карточки в Рейтинге (с затемнением для читаемости).
 */
export function LeaderboardCardSettings({ name }: { name: string }) {
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const initData = getInitData()
    fetch(`/api/m/leaderboard-bg?initData=${encodeURIComponent(initData)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setBgUrl(d.bg_url ?? null)
      })
      .catch(() => undefined)
  }, [])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setError('Формат: JPEG, PNG или WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл больше 5MB — выбери поменьше')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('file', file)
      const res = await fetch('/api/m/leaderboard-bg', { method: 'POST', body: fd })
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        bg_url?: string | null
        error?: { message?: string }
      }
      if (res.ok && d.ok) setBgUrl(d.bg_url ?? null)
      else setError(d?.error?.message ?? 'Не удалось загрузить')
    } catch {
      setError('Ошибка загрузки. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('remove', 'true')
      const res = await fetch('/api/m/leaderboard-bg', { method: 'POST', body: fd })
      if (res.ok) setBgUrl(null)
    } catch {
      setError('Не удалось убрать. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pf-card">
      <div
        className="pf-lbprev"
        style={
          bgUrl
            ? {
                backgroundImage: `linear-gradient(rgba(12,14,22,0.45), rgba(12,14,22,0.66)), url(${bgUrl})`,
              }
            : undefined
        }
      >
        <Avatar src={null} name={name} size={40} />
        <div className="pf-lbprev__info">
          <div className={`pf-lbprev__name${bgUrl ? ' pf-lbprev__name--on-bg' : ''}`}>{name}</div>
          <div className={`pf-lbprev__sub${bgUrl ? ' pf-lbprev__sub--on-bg' : ''}`}>
            Так выглядит твоя карточка в Рейтинге
          </div>
        </div>
      </div>

      <div className="pf-lbprev__actions">
        <button type="button" className="pf-lbbtn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Загрузка…' : bgUrl ? 'Заменить картинку' : 'Загрузить картинку'}
        </button>
        {bgUrl && (
          <button type="button" className="pf-lbbtn pf-lbbtn--ghost" onClick={onRemove} disabled={busy}>
            Убрать
          </button>
        )}
      </div>

      {error && <p className="pf-lbprev__error">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFile}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
