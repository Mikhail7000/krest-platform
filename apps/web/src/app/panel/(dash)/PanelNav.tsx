'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const ALL_LINKS = [
  { href: '/panel', label: 'Обзор', icon: '📊', curatorVisible: true },
  { href: '/panel/requests', label: 'Заявки', icon: '📥', curatorVisible: false },
  { href: '/panel/students', label: 'Ученики', icon: '🎓', curatorVisible: true },
  { href: '/panel/activity', label: 'Активность', icon: '📈', curatorVisible: true },
  { href: '/panel/curators', label: 'Кураторы', icon: '🧭', curatorVisible: false },
  { href: '/panel/cities', label: 'Города', icon: '🌍', curatorVisible: false },
]

function roleLabel(role: string): string {
  if (role === 'super_admin') return 'Супер-админ'
  if (role === 'curator') return 'Куратор'
  return 'Админ'
}

export function PanelNav({
  name,
  role,
  pendingCount = 0,
}: {
  name: string | null
  role: string
  pendingCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const isCurator = role === 'curator'
  const links = ALL_LINKS.filter((l) => !isCurator || l.curatorVisible)

  const isActive = (href: string) =>
    href === '/panel' ? pathname === '/panel' : pathname.startsWith(href)

  const logout = async () => {
    await fetch('/api/panel/auth/logout', { method: 'POST' })
    router.replace('/panel/login')
    router.refresh()
  }

  return (
    <>
      {/* Мобильная шапка */}
      <header className="panel-topbar">
        <span className="panel-topbar__brand">КРЕСТ</span>
        <button
          type="button"
          className="panel-topbar__burger"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню"
        >
          {open ? '✕' : '☰'}
        </button>
      </header>

      {/* Sidebar (desktop) / выезжающее меню (mobile) */}
      <aside className={`panel-sidebar${open ? ' panel-sidebar--open' : ''}`}>
        <div className="panel-sidebar__brand">КРЕСТ</div>
        <p className="panel-sidebar__sub">Панель администратора</p>

        <nav className="panel-nav">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`panel-nav__item${isActive(l.href) ? ' panel-nav__item--active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="panel-nav__icon">{l.icon}</span>
              {l.label}
              {l.href === '/panel/requests' && !isCurator && pendingCount > 0 && (
                <span className="panel-nav__badge">{pendingCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="panel-sidebar__foot">
          <div className="panel-sidebar__user">
            <span className="panel-sidebar__name">{name ?? 'Админ'}</span>
            <span className="panel-sidebar__role">{roleLabel(role)}</span>
          </div>
          <button type="button" className="panel-sidebar__logout" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>

      {open && <div className="panel-overlay" onClick={() => setOpen(false)} />}
    </>
  )
}
