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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Заявки на доступ — только admin/super_admin (куратор и лидер города не видят).
  let pendingCount = 0
  if (isAdminRole(session.role)) {
    pendingCount = await countPendingRequests(supabase)
  }

  // Название города лидера — для подписи «Лидер города <Город>».
  let cityName: string | null = null
  if (session.role === 'city_leader' && session.city != null) {
    const { data } = await supabase.from('cities').select('name_ru').eq('id', session.city).maybeSingle()
    cityName = (data as { name_ru: string | null } | null)?.name_ru ?? null
  }

  return (
    <div className="panel-shell">
      <PanelNav name={session.name} role={session.role} cityName={cityName} pendingCount={pendingCount} />
      <main className="panel-main">
        {session.via && <ViewAsBanner name={session.name} role={session.role} cityName={cityName} />}
        {children}
      </main>
    </div>
  )
}
