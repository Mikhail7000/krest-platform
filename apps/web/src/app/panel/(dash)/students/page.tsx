import { StudentsClient } from './StudentsClient'

/**
 * /panel/students — список учеников с действиями (роль, куратор, удаление, добавление).
 * Каркас (dash)/layout уже редиректит на /panel/login при отсутствии сессии.
 */
export default function StudentsPage() {
  return (
    <>
      <h1 className="panel-page__title">Ученики</h1>
      <p className="panel-page__subtitle">Прогресс, кураторы и управление участниками курса</p>
      <StudentsClient />
    </>
  )
}
