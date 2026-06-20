import { redirect } from 'next/navigation'
import { getPanelSession } from '@/lib/admin/guard'
import { PanelNav } from './PanelNav'

/**
 * Гард-каркас дашборда: требует cookie-сессию админа, иначе → /panel/login.
 * Рендерит адаптивную навигацию (sidebar desktop / topbar mobile) + контент.
 */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getPanelSession()
  if (!session) redirect('/panel/login')

  return (
    <div className="panel-shell">
      <PanelNav name={session.name} role={session.role} />
      <main className="panel-main">{children}</main>
    </div>
  )
}
