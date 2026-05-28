'use client'

import { useTelegram } from '@/components/telegram/TelegramProvider'
import { BottomNav } from '../_components/BottomNav'
import '../dashboard/dashboard.css'
import './profile.css'

export default function ProfilePage() {
  const { user } = useTelegram()
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Ученик'
  const initial = (user?.firstName?.[0] ?? 'У').toUpperCase()

  return (
    <>
      <div className="db-page miniapp-container">
        <div className="pf-head">
          <div className="pf-avatar">{initial}</div>
          <h1 className="pf-name">{name}</h1>
          <p className="pf-role">Ученик курса КРЕСТ</p>
        </div>

        <div className="pf-card">
          <div className="pf-row">
            <span className="pf-row__label">Курс</span>
            <span className="pf-row__value">КРЕСТ</span>
          </div>
          <div className="pf-row">
            <span className="pf-row__label">Язык</span>
            <span className="pf-row__value">Русский</span>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  )
}
