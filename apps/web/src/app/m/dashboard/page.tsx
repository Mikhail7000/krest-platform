import { BlockList } from './BlockList'
import { DashboardClient } from './DashboardClient'
import './dashboard.css'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <>
      <DashboardClient />
      <BlockList />
    </>
  )
}
