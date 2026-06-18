import { BottomNav } from '../_components/BottomNav'
import { CommunityClient } from './CommunityClient'
import '../dashboard/dashboard.css'
import '../emotions/[blockId]/emotions.css'
import './community.css'

export const dynamic = 'force-dynamic'

export default function CommunityPage() {
  return (
    <>
      <div className="db-page miniapp-container">
        <div className="cm-header">
          <h1 className="cm-header__title">Лента</h1>
          <p className="cm-header__sub">Истории и эмоции со всего мира</p>
        </div>
        <CommunityClient />
      </div>
      <BottomNav />
    </>
  )
}
