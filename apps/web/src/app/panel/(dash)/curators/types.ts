export interface CuratorStudent {
  id: string
  name: string | null
  nick: string | null
}

/** Лидер города для пикера «Назначить лидера» (привязка по городу). */
export interface LeaderPick {
  id: string
  name: string
  cityId: number
  city: string | null
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
  /** Лидер города этого куратора (по совпадению города). Для админов — null. */
  leaderName: string | null
  studentsCount: number
  students: CuratorStudent[]
  /** Метрики группы: заходили сегодня (локальный день ученика). */
  activeToday: number
  /** Закрытых дней группы за последние 7 суток. */
  closed7: number
  /** Застряли: >3 дней без закрытого дня (или ни одного при начатом курсе). */
  stuck: number
}
