import { BlockList } from './BlockList'
import { DashboardClient } from './DashboardClient'
import { StreakCard } from './StreakCard'
import { BottomNav } from '../_components/BottomNav'
import './dashboard.css'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <>
      <div className="db-page">
        <DashboardClient />
        <div className="miniapp-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <StreakCard />
        </div>
        <BlockList />
      </div>
      <BottomNav />
    </>
  )
}
