import { BottomNav } from '../_components/BottomNav'
import { TrackingClient } from './TrackingClient'
import '../dashboard/dashboard.css'
import '../profile/profile.css'
import './tracking.css'

export const dynamic = 'force-dynamic'

// Трекинг: список участников теста с прогрессом — все видят друг друга
export default function TrackingPage() {
  return (
    <>
      <div className="db-page miniapp-container">
        <div className="pf-head">
          <h1 className="pf-name">Трекинг</h1>
          <p className="pf-role">Прогресс участников теста</p>
        </div>
        <TrackingClient />
      </div>
      <BottomNav />
    </>
  )
}
