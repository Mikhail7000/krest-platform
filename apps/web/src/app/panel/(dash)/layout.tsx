import { redirect } from 'next/navigation'
import { getPanelSession } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { countPendingRequests } from '@/lib/admin/access-requests'
import { PanelNav } from './PanelNav'

/**
 * Гард-каркас дашборда: требует cookie-сессию админа, иначе → /panel/login.
 * Рендерит адаптивную навигацию (sidebar desktop / topbar mobile) + контент.
 */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getPanelSession()
  if (!session) redirect('/panel/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const pendingCount = await countPendingRequests(supabase)

  return (
    <div className="panel-shell">
      <PanelNav name={session.name} role={session.role} pendingCount={pendingCount} />
      <main className="panel-main">{children}</main>
    </div>
  )
}
