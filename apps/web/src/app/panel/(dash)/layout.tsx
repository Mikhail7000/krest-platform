import { redirect } from 'next/navigation'
import { getPanelSession } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { countPendingRequests } from '@/lib/admin/access-requests'
import { isAdminRole } from '@/lib/admin/session'
import { PanelNav } from './PanelNav'
import { ViewAsBanner } from './ViewAsBanner'

/**
 * Гард-каркас дашборда: требует cookie-сессию админа, иначе → /panel/login.
 * Рендерит адаптивную навигацию (sidebar desktop / topbar mobile) + контент.
 */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getPanelSession()
  if (!session) redirect('/panel/login')

  // Заявки на доступ — только admin/super_admin (куратор и лидер города не видят).
  let pendingCount = 0
  if (isAdminRole(session.role)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    pendingCount = await countPendingRequests(supabase)
  }

  return (
    <div className="panel-shell">
      <PanelNav name={session.name} role={session.role} pendingCount={pendingCount} />
      <main className="panel-main">
        {session.via && <ViewAsBanner name={session.name} role={session.role} />}
        {children}
      </main>
    </div>
  )
}
