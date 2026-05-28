import { BlockList } from './BlockList'
import { DashboardClient } from './DashboardClient'
import { BottomNav } from '../_components/BottomNav'
import './dashboard.css'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <>
      <div className="db-page">
        <DashboardClient />
        <BlockList />
      </div>
      <BottomNav />
    </>
  )
}
