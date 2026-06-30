import { getPanelSession } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { isAdminRole } from '@/lib/admin/session'
import { StudentsClient } from './StudentsClient'

/**
 * /panel/students — список учеников с действиями (роль, куратор, удаление, добавление).
 * Каркас (dash)/layout уже редиректит на /panel/login при отсутствии сессии.
 * Видимость по роли — на сервере (/api/panel/students). Добавлять могут все роли,
 * набор ролей в форме зависит от роли добавляющего.
 */
export default async function StudentsPage() {
  const session = await getPanelSession()
  const role = session?.role ?? 'curator'
  const isCurator = role === 'curator'

  // Города нужны только админу — выбрать город при добавлении лидера/куратора.
  let cities: { id: number; name: string }[] = []
  if (session && isAdminRole(session.role)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data } = await supabase.from('cities').select('id, name_ru').order('name_ru')
    cities = ((data ?? []) as { id: number; name_ru: string }[]).map((c) => ({
      id: c.id,
      name: c.name_ru,
    }))
  }

  return (
    <>
      <h1 className="panel-page__title">Ученики</h1>
      <p className="panel-page__subtitle">
        {isCurator ? 'Ваша группа и их прогресс' : 'Прогресс, кураторы и управление участниками'}
      </p>
      <StudentsClient role={role} cities={cities} />
    </>
  )
}
