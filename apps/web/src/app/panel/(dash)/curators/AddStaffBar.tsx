'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Kind = 'curator' | 'city_leader'

/**
 * Добавление персонала по нику в whitelist прямо со страницы «Кураторы».
 * Два РАЗДЕЛЬНЫХ входа, сразу видимых:
 *  - «Добавить куратора»      — город необязателен (для admin/super_admin);
 *  - «Добавить лидера города» — город обязателен (только admin/super_admin).
 * Лидер города (canManage=false) видит лишь добавление куратора — роут сам
 * относит куратора в город лидера. После /start в боте человек войдёт с ролью.
 */
export function AddStaffBar({
  canManage,
  cities,
}: {
  canManage: boolean
  cities: { id: number; name: string }[]
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <AddForm kind="curator" cities={cities} showCity={canManage} cityRequired={false} />
      {canManage ? (
        <AddForm kind="city_leader" cities={cities} showCity cityRequired />
      ) : null}
    </div>
  )
}

function AddForm({
  kind,
  cities,
  showCity,
  cityRequired,
}: {
  kind: Kind
  cities: { id: number; name: string }[]
  showCity: boolean
  cityRequired: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nick, setNick] = useState('')
  const [cityId, setCityId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const roleWord = kind === 'city_leader' ? 'лидера города' : 'куратора'
  const btnLabel = kind === 'city_leader' ? '👑 Добавить лидера города' : '🧭 Добавить куратора'

  const submit = async () => {
    const v = nick.trim().replace(/^@+/, '')
    if (!/^[a-z0-9_]{4,32}$/i.test(v)) {
      setNotice('Ник: 4–32 символа, латиница, цифры, _')
      return
    }
    if (cityRequired && !cityId) {
      setNotice('Для лидера города выберите город')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/panel/actions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: v,
          role: kind,
          cityId: showCity && cityId ? Number(cityId) : undefined,
        }),
      })
      const b = await res.json().catch(() => ({}))
      if (res.ok && b.ok) {
        setNotice(`✓ @${v} добавлен как ${roleWord}`)
        setNick('')
        setCityId('')
        setOpen(false)
        router.refresh()
      } else {
        setNotice(b.error || 'Не удалось добавить')
      }
    } catch {
      setNotice('Сеть недоступна')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minWidth: 220 }}>
      <button type="button" className="panel-btn panel-btn--primary" onClick={() => setOpen((o) => !o)}>
        + {btnLabel}
      </button>
      {open ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', maxWidth: 560, alignItems: 'center' }}>
          <input
            className="panel-input"
            placeholder="@ник в Telegram"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            style={{ flex: 1, minWidth: 180 }}
          />
          {showCity ? (
            <select
              className="panel-input"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">{cityRequired ? 'Город (обязательно)' : 'Город (необязательно)'}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="panel-btn panel-btn--primary" onClick={submit} disabled={busy}>
            {busy ? '…' : 'Добавить'}
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="panel-muted" style={{ marginTop: 6 }}>
          {notice}
        </div>
      ) : null}
    </div>
  )
}
