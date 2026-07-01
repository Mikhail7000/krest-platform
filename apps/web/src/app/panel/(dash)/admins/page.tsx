import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'
import { AdminsView, type AdminRowItem } from './AdminsView'

export const dynamic = 'force-dynamic'

/**
 * /panel/admins — администраторы платформы (ТОЛЬКО super_admin).
 * Список админов с входом в их панель (view-as) и сменой роли.
 * Бэкенд view-as уже разрешает super_admin → admin (api/panel/view-as);
 * эта страница — недостающий экран для этого.
 */
export default async function AdminsPage() {
  const session = await getPanelSession()
  if (session?.role !== 'super_admin') notFound()
  // Внутри view-as вложенный вход запрещён (гард view-as и так не даст).
  const impersonating = !!session.via

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const [{ data: adminsRaw }, { data: citiesRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, role, city_id, is_protected, telegram_chat_id, cities(name_ru)')
      .in('role', ['admin', 'super_admin'])
      .order('role', { ascending: true }),
    supabase.from('cities').select('id, name_ru').order('name_ru'),
  ])

  const admins: AdminRowItem[] = ((adminsRaw ?? []) as Array<{
    id: string
    full_name: string | null
    contact_info: string | null
    role: string
    city_id: number | null
    is_protected: boolean | null
    telegram_chat_id: number | string | null
    cities: { name_ru: string | null } | null
  }>).map((a) => ({
    id: a.id,
    name: a.full_name,
    nick: a.contact_info,
    role: a.role,
    cityId: a.city_id,
    cityName: a.cities?.name_ru ?? null,
    isProtected: !!a.is_protected,
    hasTelegram: a.telegram_chat_id != null,
    isSelf: a.id === session.uid,
  }))

  const cities = ((citiesRaw ?? []) as { id: number; name_ru: string }[]).map((c) => ({
    id: c.id,
    name: c.name_ru,
  }))

  return (
    <div>
      <h1 className="panel-page__title">Администраторы</h1>
      <p className="panel-page__subtitle">
        Полный доступ ко всей платформе. «Войти как» — посмотреть панель глазами админа.
      </p>
      <AdminsView admins={admins} cities={cities} canViewAs={!impersonating} />
    </div>
  )
}
