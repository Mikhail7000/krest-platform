'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Role = 'curator' | 'city_leader'

/**
 * Добавление персонала по нику в whitelist прямо со страницы «Кураторы».
 *  - admin/super_admin (canManage): роль на выбор — куратор или лидер города;
 *    город (для лидера обязателен, для куратора — необязателен).
 *  - city_leader (canManage=false): только куратор (роут отнесёт его в город лидера).
 * После /start в боте человек войдёт уже с нужной ролью и городом.
 */
export function AddStaffBar({
  canManage,
  cities,
}: {
  canManage: boolean
  cities: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nick, setNick] = useState('')
  const [role, setRole] = useState<Role>('curator')
  const [cityId, setCityId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const isLeader = canManage && role === 'city_leader'

  const submit = async () => {
    const v = nick.trim().replace(/^@+/, '')
    if (!/^[a-z0-9_]{4,32}$/i.test(v)) {
      setNotice('Ник: 4–32 символа, латиница, цифры, _')
      return
    }
    if (isLeader && !cityId) {
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
          role: canManage ? role : 'curator',
          cityId: canManage && cityId ? Number(cityId) : undefined,
        }),
      })
      const b = await res.json().catch(() => ({}))
      if (res.ok && b.ok) {
        const word = canManage && role === 'city_leader' ? 'лидер города' : 'куратор'
        setNotice(`✓ @${v} добавлен как ${word}`)
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
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="panel-btn panel-btn--primary" onClick={() => setOpen((o) => !o)}>
          {canManage ? '+ Добавить куратора / лидера' : '+ Добавить куратора'}
        </button>
        {notice ? <span className="panel-muted">{notice}</span> : null}
      </div>
      {open ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', maxWidth: 640, alignItems: 'center' }}>
          {canManage ? (
            <select
              className="panel-input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{ maxWidth: 170 }}
            >
              <option value="curator">Куратор</option>
              <option value="city_leader">Лидер города</option>
            </select>
          ) : null}
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
          {canManage ? (
            <select
              className="panel-input"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">{isLeader ? 'Город (обязательно)' : 'Город (необязательно)'}</option>
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
    </div>
  )
}
