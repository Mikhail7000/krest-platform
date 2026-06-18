export type Tier = 'gold' | 'silver' | 'bronze' | 'normal'

export interface LeaderRow {
  rank: number
  tier: Tier
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
