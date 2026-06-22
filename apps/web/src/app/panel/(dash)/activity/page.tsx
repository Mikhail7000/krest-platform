import { ActivityClient } from './ActivityClient'

export const dynamic = 'force-dynamic'

/**
 * /panel/activity — таблица активности учеников: выбор галочками + просмотр
 * активности по дням (что выполнено в какой день). Видимость по роли (owner/
 * admin/curator) обеспечивают /api/panel/students и /api/panel/activity/days.
 */
export default function ActivityPage() {
  return (
    <div>
      <h1 className="panel-page__title">Активность</h1>
      <p className="panel-page__subtitle">
        Отметь учеников галочками и посмотри их активность по дням — что и когда выполнено.
      </p>
      <ActivityClient />
    </div>
  )
}
