'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconHome, IconUser, IconCards, IconUsers } from './icons'

const TABS = [
  { href: '/m/dashboard', label: 'Курс', Icon: IconHome },
  { href: '/m/trainer', label: 'Тренажёр', Icon: IconCards },
  { href: '/m/tracking', label: 'Трекинг', Icon: IconUsers },
  { href: '/m/profile', label: 'Профиль', Icon: IconUser },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="db-bottomnav">
      {TABS.map(({ href, label, Icon }) => {
        // «Курс» — точное совпадение, остальные — по префиксу (вложенные роуты)
        const active = href === '/m/dashboard' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`db-navitem${active ? ' db-navitem--active' : ''}`}
          >
            <Icon className="db-navitem__icon" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
