'use client'

import Link from 'next/link'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { BottomNav } from '../_components/BottomNav'
import { ProfileActivity } from './ProfileActivity'
import { AddToHomeScreenButton } from './AddToHomeScreenButton'
import { AvatarUpload } from './AvatarUpload'
import '../dashboard/dashboard.css'
import './profile.css'

export default function ProfilePage() {
  const { user } = useTelegram()
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Ученик'

  return (
    <>
      <div className="db-page miniapp-container">
        <div className="pf-head">
          <h1 className="pf-name">{name}</h1>
          <p className="pf-role">Ученик курса КРЕСТ</p>
        </div>

        <p className="pf-section">Аватар</p>
        <div className="pf-card">
          <AvatarUpload name={name} initialUrl={null} />
        </div>

        <p className="pf-section">Активность</p>
        <ProfileActivity />

        <p className="pf-section">О курсе</p>
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

        <AddToHomeScreenButton />

        <p className="pf-section">Помощь</p>
        <Link href="/m/support" className="pf-card pf-linkrow">
          <span className="pf-row__label">Помощь и поддержка</span>
          <span className="pf-linkrow__arrow">›</span>
        </Link>
      </div>
      <BottomNav />
    </>
  )
}
