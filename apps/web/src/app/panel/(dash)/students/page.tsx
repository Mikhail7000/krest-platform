import { getPanelSession } from '@/lib/admin/guard'
import { StudentsClient } from './StudentsClient'

/**
 * /panel/students — список учеников с действиями (роль, куратор, удаление, добавление).
 * Каркас (dash)/layout уже редиректит на /panel/login при отсутствии сессии.
 * Для кураторов: только чтение своей группы, без кнопки добавления и действий над строками.
 */
export default async function StudentsPage() {
  const session = await getPanelSession()
  const isCurator = session?.role === 'curator'

  return (
    <>
      <h1 className="panel-page__title">Ученики</h1>
      <p className="panel-page__subtitle">
        {isCurator
          ? 'Ваша группа и их прогресс'
          : 'Прогресс, кураторы и управление участниками курса'}
      </p>
      <StudentsClient isCurator={isCurator} />
    </>
  )
}
