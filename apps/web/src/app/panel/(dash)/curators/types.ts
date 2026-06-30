export interface CuratorStudent {
  id: string
  name: string | null
  nick: string | null
}

export interface CuratorRow {
  id: string
  name: string | null
  nick: string | null
  /** Роль: curator | admin (страница показывает обе для управления). */
  role: string
  /** Защищён от изменения роли (владелец) — действия скрыты. */
  isProtected: boolean
  city: string | null
  /** id города (для смены роли на лидера города — дефолт селекта). */
  cityId: number | null
  country: string | null
  studentsCount: number
  students: CuratorStudent[]
}
