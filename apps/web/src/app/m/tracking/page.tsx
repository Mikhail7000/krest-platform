import { BottomNav } from '../_components/BottomNav'
import { TrackingClient } from './TrackingClient'
import '../dashboard/dashboard.css'
import '../profile/profile.css'
import './tracking.css'

export const dynamic = 'force-dynamic'

export default function TrackingPage() {
  return (
    <>
      <div className="db-page miniapp-container">
        <div className="pf-head">
          <h1 className="pf-name">Рейтинг</h1>
          <p className="pf-role">Закрывай дни подряд — больше очков</p>
        </div>
        <TrackingClient />
      </div>
      <BottomNav />
    </>
  )
}
