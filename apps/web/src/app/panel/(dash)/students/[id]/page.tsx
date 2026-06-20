import { StudentDetailClient } from './StudentDetailClient'

/**
 * /panel/students/[id] — детальная карточка ученика с прогрессом по блокам.
 * Гард-каркас (dash)/layout уже защищает маршрут.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <StudentDetailClient id={id} />
}
