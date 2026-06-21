'use client'

import { useEffect, useState } from 'react'
import { useTheme, type Theme } from '@/components/theme/ThemeProvider'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

type Gender = 'male' | 'female' | null

interface ThemeOption {
  value: Theme
  label: string
  desc: string
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Светлая', desc: 'Чистый белый фон' },
  { value: 'dark', label: 'Тёмная', desc: 'Ночной режим' },
  { value: 'stars', label: 'Звёзды', desc: 'Стеклянные карточки' },
  { value: 'pink', label: 'Розовая', desc: 'Мягкий розовый фон' },
]

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: null, label: 'Не указан' },
  { value: 'female', label: 'Девушка' },
  { value: 'male', label: 'Парень' },
]

async function postUpdateTheme(payload: {
  initData: string
  theme_pref?: Theme | null
  gender?: Gender
}): Promise<void> {
  await fetch('/api/m/profile/update-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/**
 * Карточка «Оформление» в профиле ученика.
 * Позволяет явно выбрать тему (включая розовую) и указать пол.
 * Пол используется ТОЛЬКО для темы по умолчанию, не для логики курса.
 */
export function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const [gender, setGender] = useState<Gender>(null)
  const [loadedGender, setLoadedGender] = useState(false)
  const [savingGender, setSavingGender] = useState(false)

  // Загружаем текущий пол из профиля
  useEffect(() => {
    let cancelled = false
    fetch('/api/miniapp/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { gender?: string | null } | null) => {
        if (!cancelled && data) {
          const g = data.gender
          setGender(g === 'female' || g === 'male' ? g : null)
          setLoadedGender(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedGender(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleThemeSelect = async (t: Theme) => {
    setTheme(t)
    // Сохраняем явный выбор в DB чтобы тема следовала пользователю
    await postUpdateTheme({ initData: getInitData(), theme_pref: t })
  }

  const handleGenderSelect = async (g: Gender) => {
    if (savingGender) return
    setSavingGender(true)
    setGender(g)
    try {
      await postUpdateTheme({ initData: getInitData(), gender: g })
      // Если выбрала «Девушка» и тема всё ещё светлая (по умолчанию), предложим розовую
      if (g === 'female' && theme === 'light') {
        setTheme('pink')
        await postUpdateTheme({ initData: getInitData(), theme_pref: 'pink' })
      }
    } catch {
      /* тихо — UI уже обновлён */
    } finally {
      setSavingGender(false)
    }
  }

  return (
    <>
      <p className="pf-section">Оформление</p>
      <div className="pf-card ts-card">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`ts-option${theme === opt.value ? ' ts-option--active' : ''}`}
            onClick={() => handleThemeSelect(opt.value)}
            aria-pressed={theme === opt.value}
          >
            <span className="ts-option__dot" style={{ background: getThemeAccent(opt.value) }} />
            <span className="ts-option__info">
              <span className="ts-option__label">{opt.label}</span>
              <span className="ts-option__desc">{opt.desc}</span>
            </span>
            {theme === opt.value && <span className="ts-option__check">✓</span>}
          </button>
        ))}
      </div>

      <p className="pf-section">Пол (для темы)</p>
      <div className="pf-card ts-card">
        {loadedGender ? (
          GENDER_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`ts-option${gender === opt.value ? ' ts-option--active' : ''}`}
              onClick={() => handleGenderSelect(opt.value)}
              disabled={savingGender}
              aria-pressed={gender === opt.value}
            >
              <span className="ts-option__info">
                <span className="ts-option__label">{opt.label}</span>
              </span>
              {gender === opt.value && <span className="ts-option__check">✓</span>}
            </button>
          ))
        ) : (
          <div className="ts-loading">Загрузка…</div>
        )}
        <p className="ts-hint">
          Для девушек по умолчанию — розовая тема. Пол не влияет на курс.
        </p>
      </div>
    </>
  )
}

function getThemeAccent(t: Theme): string {
  switch (t) {
    case 'dark': return '#7C5CF0'
    case 'stars': return '#8B5CF6'
    case 'pink': return '#EC4899'
    default: return '#7C5CF0'
  }
}
