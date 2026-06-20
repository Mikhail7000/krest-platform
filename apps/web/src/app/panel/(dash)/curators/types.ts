export interface CuratorStudent {
  id: string
  name: string | null
  nick: string | null
}

export interface CuratorRow {
  id: string
  name: string | null
  nick: string | null
  city: string | null
  country: string | null
  studentsCount: number
  students: CuratorStudent[]
}
