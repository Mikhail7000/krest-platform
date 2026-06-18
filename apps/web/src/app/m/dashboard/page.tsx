import { DashboardShell } from './DashboardShell'
import { BottomNav } from '../_components/BottomNav'
import './dashboard.css'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <>
      <div className="db-page">
        <DashboardShell />
      </div>
      <BottomNav />
    </>
  )
}
