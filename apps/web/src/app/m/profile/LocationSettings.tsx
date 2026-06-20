'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase-browser'
import { useHaptic } from '@/hooks/useHaptic'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

// ISO alpha-2 код → эмодзи-флаг (regional indicator symbols)
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🌍'
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

interface Country {
  id: number
  name_ru: string
  code: string
}
interface City {
  id: number
  name_ru: string
}

type Editor = 'closed' | 'country' | 'city'

export function LocationSettings() {
  const haptic = useHaptic()

  // Текущие сохранённые значения
  const [currentCountry, setCurrentCountry] = useState<Country | null>(null)
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Состояние редактора
  const [editor, setEditor] = useState<Editor>('closed')
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [pickedCountry, setPickedCountry] = useState<Country | null>(null)

  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  )

  // Загружаем текущую локацию профиля + её названия
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
        const data = (await res.json()) as { country_id?: number | null; city_id?: number | null }

        if (data.country_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: c } = await (supabase as any)
            .from('countries')
            .select('id, name_ru, code')
            .eq('id', data.country_id)
            .maybeSingle()
          if (!cancelled && c) setCurrentCountry(c as Country)
        }
        if (data.city_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ct } = await (supabase as any)
            .from('cities')
            .select('id, name_ru')
            .eq('id', data.city_id)
            .maybeSingle()
          if (!cancelled && ct) setCurrentCity(ct as City)
        }
      } catch {
        /* тихо — просто не покажем текущие значения */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const openCountryStep = async () => {
    haptic.impact('light')
    setStatusMsg(null)
    setPickedCountry(null)
    setCities([])
    setEditor('country')
    setListLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('countries')
        .select('id, name_ru, code')
        .eq('status', 'active')
        .order('name_ru')
      setCountries((data as Country[]) || [])
    } catch {
      setCountries([])
    } finally {
      setListLoading(false)
    }
  }

  const pickCountry = async (country: Country) => {
    haptic.selection()
    setPickedCountry(country)
    setEditor('city')
    setListLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('cities')
        .select('id, name_ru')
        .eq('country_id', country.id)
        .eq('status', 'active')
        .order('name_ru')
      setCities((data as City[]) || [])
    } catch {
      setCities([])
    } finally {
      setListLoading(false)
    }
  }

  const pickCity = async (city: City) => {
    if (!pickedCountry || saving) return
    haptic.selection()
    setSaving(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/m/profile/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: getInitData(),
          country_id: pickedCountry.id,
          city_id: city.id,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error?.message ?? 'Не удалось сохранить локацию')
      }
      // Успех — обновляем текущие значения и закрываем редактор
      setCurrentCountry(pickedCountry)
      setCurrentCity(city)
      setEditor('closed')
      setStatusMsg({ kind: 'success', text: 'Локация обновлена' })
      haptic.notification('success')
    } catch (err) {
      setStatusMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Не удалось сохранить локацию',
      })
      haptic.notification('error')
    } finally {
      setSaving(false)
    }
  }

  const closeEditor = () => {
    haptic.impact('light')
    setEditor('closed')
  }

  const currentLabel = loaded
    ? currentCity && currentCountry
      ? `${currentCity.name_ru}, ${currentCountry.name_ru}`
      : currentCountry
        ? currentCountry.name_ru
        : 'Не указано'
    : '…'

  return (
    <>
      <p className="pf-section">Страна и город</p>
      <div className="pf-card">
        <div className="loc-row">
          <div className="loc-row__info">
            <span className="loc-row__current">{currentLabel}</span>
            <span className="loc-row__hint">Где вы проходите курс</span>
          </div>
          <button type="button" className="loc-row__edit" onClick={openCountryStep}>
            Изменить
          </button>
        </div>
        {statusMsg && (
          <p className={`loc-status loc-status--${statusMsg.kind}`}>{statusMsg.text}</p>
        )}
      </div>

      {/* Экран выбора страны → города поверх профиля */}
      <AnimatePresence>
        {editor !== 'closed' && (
          <motion.div
            className="loc-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="loc-sheet__panel"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="loc-sheet__head">
                <h2 className="loc-sheet__title">
                  {editor === 'country' ? 'Выберите страну' : 'Выберите город'}
                </h2>
                <button
                  type="button"
                  className="loc-sheet__close"
                  onClick={closeEditor}
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>

              {editor === 'city' && pickedCountry && (
                <button
                  type="button"
                  className="loc-sheet__back"
                  onClick={() => setEditor('country')}
                >
                  ‹ {pickedCountry.name_ru}
                </button>
              )}

              <div className="loc-sheet__list">
                {listLoading ? (
                  <div className="loc-sheet__loading">
                    <div className="loc-spinner" />
                  </div>
                ) : editor === 'country' ? (
                  countries.length === 0 ? (
                    <p className="loc-sheet__empty">Нет доступных стран</p>
                  ) : (
                    countries.map((country) => (
                      <button
                        key={country.id}
                        type="button"
                        className="loc-option"
                        onClick={() => pickCountry(country)}
                      >
                        <span className="loc-option__flag">{flagEmoji(country.code)}</span>
                        <span className="loc-option__name">{country.name_ru}</span>
                      </button>
                    ))
                  )
                ) : cities.length === 0 ? (
                  <p className="loc-sheet__empty">В этой стране пока нет активных городов</p>
                ) : (
                  cities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      className="loc-option"
                      onClick={() => pickCity(city)}
                      disabled={saving}
                    >
                      <span className="loc-option__name">{city.name_ru}</span>
                      {saving && <span className="loc-option__saving">сохраняем…</span>}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
