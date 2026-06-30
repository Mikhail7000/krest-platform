'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CuratorRow } from './types'
import { RoleModal } from './RoleModal'

const ROLE_BADGE: Record<string, { cls: string; label: string }> = {
  curator: { cls: 'panel-badge panel-badge--acc', label: 'Куратор' },
  city_leader: { cls: 'panel-badge panel-badge--acc', label: 'Лидер города' },
  admin: { cls: 'panel-badge panel-badge--warn', label: 'Админ' },
}

/** Кого может «открыть» (view-as) текущий зритель по роли цели. */
function rowCanViewAs(role: string, isOwner: boolean): boolean {
  if (isOwner) return role === 'curator' || role === 'city_leader' || role === 'admin'
  // обычный admin (не владелец) — только scoped-роли, без админов
  return role === 'curator' || role === 'city_leader'
}

/**
 * Таблица кураторов с разворотом списка учеников.
 *  - canManage (admin/super_admin): смена роли, привязка учеников.
 *  - canViewAs: кнопка «Войти как» (view-as) для подходящих по роли целей.
 * Добавление куратора доступно и лидеру города (роут сам относит его в город лидера).
 * Имена/города выводятся как React-текст (auto-escape, без innerHTML).
 */
export function CuratorsView({
  curators,
  canManage,
  isSuperAdmin,
  canViewAs = false,
  isOwner = false,
}: {
  curators: CuratorRow[]
  canManage: boolean
  isSuperAdmin: boolean
  canViewAs?: boolean
  isOwner?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [attachTarget, setAttachTarget] = useState<CuratorRow | null>(null)
  const [roleTarget, setRoleTarget] = useState<CuratorRow | null>(null)

  return (
    <>
      <AddCuratorBar />
      {curators.length === 0 ? (
        <div className="panel-empty">Кураторов пока нет</div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Куратор</th>
                <th>Город</th>
                <th>Ученики</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {curators.map((cu) => {
                const isOpen = openId === cu.id
                const hasStudents = cu.studentsCount > 0
                return (
                  <CuratorRowGroup
                    key={cu.id}
                    curator={cu}
                    isOpen={isOpen}
                    hasStudents={hasStudents}
                    canManage={canManage}
                    canChangeRole={canManage && !cu.isProtected && (isSuperAdmin || cu.role !== 'admin')}
                    canViewAs={canViewAs && !cu.isProtected && rowCanViewAs(cu.role, isOwner)}
                    onToggle={() => setOpenId(isOpen ? null : cu.id)}
                    onAttach={() => setAttachTarget(cu)}
                    onRole={() => setRoleTarget(cu)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {attachTarget ? (
        <AttachModal
          curator={attachTarget}
          onClose={() => setAttachTarget(null)}
        />
      ) : null}

      {roleTarget ? (
        <RoleModal
          curator={roleTarget}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setRoleTarget(null)}
        />
      ) : null}
    </>
  )
}

/** Добавление куратора по нику (зеркало «Добавить ученика»). */
function AddCuratorBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nick, setNick] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async () => {
    const v = nick.trim().replace(/^@+/, '')
    if (!/^[a-z0-9_]{4,32}$/i.test(v)) {
      setNotice('Ник: 4–32 символа, латиница, цифры, _')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/panel/actions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: v, role: 'curator' }),
      })
      const b = await res.json().catch(() => ({}))
      if (res.ok && b.ok) {
        setNotice(`✓ @${v} добавлен как куратор`)
        setNick('')
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
          + Добавить куратора
        </button>
        {notice ? <span className="panel-muted">{notice}</span> : null}
      </div>
      {open ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', maxWidth: 440 }}>
          <input
            className="panel-input"
            placeholder="@ник куратора в Telegram"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" className="panel-btn panel-btn--primary" onClick={submit} disabled={busy}>
            {busy ? '…' : 'Добавить'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function CuratorRowGroup({
  curator,
  isOpen,
  hasStudents,
  canManage,
  canChangeRole,
  canViewAs,
  onToggle,
  onAttach,
  onRole,
}: {
  curator: CuratorRow
  isOpen: boolean
  hasStudents: boolean
  canManage: boolean
  canChangeRole: boolean
  canViewAs: boolean
  onToggle: () => void
  onAttach: () => void
  onRole: () => void
}) {
  const [viewBusy, setViewBusy] = useState(false)

  const enterViewAs = async () => {
    setViewBusy(true)
    try {
      const res = await fetch('/api/panel/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: curator.id }),
      })
      if (res.ok) {
        window.location.href = '/panel' // полная перезагрузка под новой view-as сессией
      } else {
        const b = await res.json().catch(() => ({}))
        console.error('[view-as]', b.error || res.status)
        setViewBusy(false)
      }
    } catch {
      setViewBusy(false)
    }
  }

  const cityLabel = curator.city
    ? curator.country
      ? `${curator.city}, ${curator.country}`
      : curator.city
    : '—'
  const badge = ROLE_BADGE[curator.role]

  return (
    <>
      <tr
        onClick={hasStudents ? onToggle : undefined}
        style={{ cursor: hasStudents ? 'pointer' : 'default' }}
      >
        <td>
          <div style={{ fontWeight: 600 }}>{curator.name ?? 'Без имени'}</div>
          {curator.nick ? <div className="panel-muted">{curator.nick}</div> : null}
          {badge ? (
            <span className={badge.cls} style={{ marginTop: 4, display: 'inline-block' }}>
              {badge.label}
            </span>
          ) : null}
        </td>
        <td>{cityLabel}</td>
        <td>
          <span
            className={
              hasStudents ? 'panel-badge panel-badge--acc' : 'panel-badge'
            }
          >
            {curator.studentsCount}
          </span>
          {hasStudents ? (
            <button
              type="button"
              className="panel-btn"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              style={{ marginLeft: 10 }}
            >
              {isOpen ? 'Скрыть' : 'Показать'}
            </button>
          ) : null}
        </td>
        <td>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {canViewAs ? (
              <button
                type="button"
                className="panel-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  enterViewAs()
                }}
                disabled={viewBusy}
                title="Открыть панель этого пользователя в режиме просмотра"
              >
                {viewBusy ? '…' : '👁 Войти как'}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="panel-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onAttach()
                }}
              >
                Привязать учеников
              </button>
            ) : null}
            {!canManage ? null : curator.isProtected ? (
              <span className="panel-badge" style={{ alignSelf: 'center' }}>🔒 Защищён</span>
            ) : canChangeRole ? (
              <button
                type="button"
                className="panel-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onRole()
                }}
              >
                Сменить роль
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {isOpen && hasStudents ? (
        <tr>
          <td colSpan={4}>
            <div className="panel-section-title">Ученики ({curator.studentsCount})</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {curator.students.map((s) => (
                <li key={s.id} style={{ marginBottom: 4 }}>
                  {s.name ?? 'Без имени'}
                  {s.nick ? <span className="panel-muted"> {s.nick}</span> : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  )
}

/** Модалка массовой привязки учеников к куратору. */
function AttachModal({
  curator,
  onClose,
}: {
  curator: CuratorRow
  onClose: () => void
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setIsError(true)
      setNotice('Введите хотя бы один ник')
      return
    }
    setBusy(true)
    setNotice(null)
    setIsError(false)
    try {
      const res = await fetch('/api/panel/actions/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curatorId: curator.id, usernames: trimmed }),
      })
      const b = await res.json().catch(() => ({}))
      if (res.ok && b.ok) {
        const attached: string[] = b.attached ?? []
        const pending: string[] = b.pending ?? []
        setIsError(false)
        setNotice(
          `Привязано сразу: ${attached.length}. Привяжутся при входе: ${pending.length}.`,
        )
        setText('')
        router.refresh()
      } else {
        setIsError(true)
        setNotice(b.error || 'Не удалось привязать')
      }
    } catch {
      setIsError(true)
      setNotice('Сеть недоступна')
    } finally {
      setBusy(false)
    }
  }

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="panel-overlay"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        padding: '16px',
      }}
      onClick={handleBackdrop}
    >
      <div
        className="panel-card"
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <div className="panel-section-title" style={{ marginBottom: 4 }}>
            Привязать учеников
          </div>
          <div className="panel-muted" style={{ fontSize: '0.88rem' }}>
            Куратор: <strong>{curator.name ?? curator.nick ?? curator.id}</strong>
          </div>
        </div>

        <textarea
          className="panel-input"
          placeholder="@ник1 @ник2 … через пробел, запятую или с новой строки"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          style={{ resize: 'vertical', minHeight: 100, fontFamily: 'inherit' }}
          disabled={busy}
        />

        {notice ? (
          <div
            className="panel-muted"
            style={{
              fontSize: '0.88rem',
              color: isError ? 'var(--pl-err)' : 'var(--pl-ok)',
            }}
          >
            {notice}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="panel-btn"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
          <button
            type="button"
            className="panel-btn panel-btn--primary"
            onClick={submit}
            disabled={busy || !text.trim()}
          >
            {busy ? '…' : 'Привязать'}
          </button>
        </div>
      </div>
    </div>
  )
}
