'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../_components/Avatar'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      ?.Telegram?.WebApp?.initData ?? ''
  )
}

interface Props {
  name: string
  initialUrl?: string | null
}

export function AvatarUpload({ name, initialUrl }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Подгружаем уже сохранённую аватарку при заходе на профиль
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/miniapp/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: getInitData() }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { avatar_url?: string | null }
        if (!cancelled && data.avatar_url) setUrl(data.avatar_url)
      } catch {
        /* тихо — просто не покажем аватар */
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Файл слишком большой (макс. 5 МБ)')
      return
    }

    setErrorMsg(null)
    setUploading(true)

    try {
      const form = new FormData()
      form.append('initData', getInitData())
      form.append('file', file)

      const res = await fetch('/api/m/avatar', {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Ошибка загрузки')
      }

      const data = (await res.json()) as { ok: boolean; avatar_url: string }
      if (data.ok && data.avatar_url) {
        // путь стабильный (userId.ext) → добавляем метку, чтобы сбросить кеш
        setUrl(`${data.avatar_url}?t=${Date.now()}`)
      } else {
        throw new Error('Не удалось получить URL аватарки')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
      // Сбрасываем input, чтобы можно было загрузить тот же файл повторно
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="av-upload">
      <div className="av-upload__preview">
        <Avatar src={url} name={name} size={84} className="av-upload__circle" />
        {uploading && <div className="av-upload__spinner" aria-label="Загрузка" />}
      </div>

      <div className="av-upload__right">
        <button
          type="button"
          className="av-upload__btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-busy={uploading}
        >
          {uploading ? 'Загружаем…' : 'Загрузить фото'}
        </button>
        <p className="av-upload__hint">JPEG или PNG, до 5 МБ</p>
        {errorMsg && <p className="av-upload__error">{errorMsg}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="av-upload__hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
