'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconHome, IconUser } from './icons'

const TABS = [
  { href: '/m/dashboard', label: 'Курс', Icon: IconHome },
  { href: '/m/profile', label: 'Профиль', Icon: IconUser },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="db-bottomnav">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href
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
