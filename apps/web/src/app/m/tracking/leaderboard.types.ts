export type Tier = 'gold' | 'silver' | 'bronze' | 'blue' | 'green' | 'normal'

export interface LeaderRow {
  rank: number
  tier: Tier
  /** true для тестовых аккаунтов — показываем в конце, без места в рейтинге */
  outOfRanking?: boolean
  name: string
  telegram: string | null
  city: string | null
  avatar_url: string | null
  points: number
  closedDays: number
  currentStreak: number
  blocksPassed: number
  currentBlock: number
  achievements: string[]
  is_self: boolean
}
