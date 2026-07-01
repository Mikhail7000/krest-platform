export interface LeaderCurator {
  id: string
  name: string | null
  nick: string | null
}

export interface LeaderRow {
  id: string
  name: string | null
  nick: string | null
  /** Защищён от изменения роли (владелец) — действия скрыты. */
  isProtected: boolean
  city: string | null
  cityId: number | null
  country: string | null
  /** Кураторов в городе лидера. */
  curatorsCount: number
  curators: LeaderCurator[]
  /** Добавлен в whitelist, но ещё не заходил в приложение (профиля нет). */
  pending?: boolean
}
