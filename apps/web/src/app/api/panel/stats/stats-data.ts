import { createServiceSupabase } from '@/lib/supabase-service'

/**
 * Сбор статистики для обзора /panel.
 * Логика вынесена сюда, чтобы её можно было звать и из API-роута, и из
 * Server Component страницы (без HTTP-хопа). Данные — через service-role
 * (обход RLS, это сервер админа). Нетипизированные таблицы/rpc — через any.
 */

export interface StatTotals {
  students: number
  curators: number
  admins: number
  passedCourse: number
  cities: number
}

export interface CityRow {
  city: string
  country: string
  count: number
}

export interface CountryRow {
  country: string
  count: number
}

export interface ProgressRow {
  block: number
  count: number
}

export interface StreakRow {
  name: string
  telegram: string | null
  city: string
  maxStreak: number
  totalDays: number
}

export interface StuckRow {
  name: string
  telegram: string | null
  city: string
  currentBlock: number
  lastDayAgo: number | null
}

export interface PanelStats {
  totals: StatTotals
  byCity: CityRow[]
  byCountry: CountryRow[]
  progress: ProgressRow[]
  streaks: StreakRow[]
  stuck: StuckRow[]
}

interface ProfileRow {
  id: string
  full_name: string | null
  contact_info: string | null
  role: string
  city_id: number | null
  curator_id: string | null
  course_started_at: string | null
  hidden_from_tracking: boolean | null
}

const MAX_BLOCK = 10
const STUCK_DAYS = 3

/**
 * Фильтр учеников по видимости.
 * isOwner=true → все ученики (включая hidden_from_tracking).
 * isOwner=false → только visible (hidden_from_tracking != true).
 * scopeCuratorId — если задан, ограничивает выборку учениками этого куратора.
 */
function visibleStudents(
  profiles: ProfileRow[],
  isOwner: boolean,
  scopeCuratorId?: string,
): ProfileRow[] {
  let base: ProfileRow[]
  if (isOwner) {
    base = profiles.filter((p) => p.role === 'student')
  } else {
    base = profiles.filter((p) => p.role === 'student' && !(p as any).hidden_from_tracking)
  }
  if (scopeCuratorId) {
    base = base.filter((p) => (p as any).curator_id === scopeCuratorId)
  }
  return base
}

/** UTC-дата YYYY-MM-DD → порядковый номер дня (для поиска подряд-ранов). */
function dayIndex(d: string): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000)
}

/** Самый длинный непрерывный ран по календарным дням. */
function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const idx = Array.from(new Set(dates.map(dayIndex))).sort((a, b) => a - b)
  let best = 1
  let run = 1
  for (let i = 1; i < idx.length; i++) {
    run = idx[i] === idx[i - 1] + 1 ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

const todayIndex = () => Math.floor(Date.now() / 86_400_000)

export async function getPanelStats(isOwner = false, scopeCuratorId?: string): Promise<PanelStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const [
    { data: profilesRaw },
    { data: citiesRaw },
    { data: countriesRaw },
    { data: passedRaw },
    { data: closedRaw },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, role, city_id, curator_id, course_started_at, hidden_from_tracking'),
    supabase.from('cities').select('id, name_ru, country_id'),
    supabase.from('countries').select('id, name_ru'),
    supabase.rpc('passed_blocks_all'),
    supabase.rpc('closed_dates_all'),
  ])

  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const cities = (citiesRaw ?? []) as { id: number; name_ru: string; country_id: number | null }[]
  const countries = (countriesRaw ?? []) as { id: number; name_ru: string }[]
  const passed = (passedRaw ?? []) as { user_id: string; blocks_passed: number }[]
  const closed = (closedRaw ?? []) as { user_id: string; d: string }[]

  // Справочники
  const countryName = new Map<number, string>()
  for (const c of countries) countryName.set(c.id, c.name_ru)

  const cityName = new Map<number, string>()
  const cityCountry = new Map<number, string>()
  for (const c of cities) {
    cityName.set(c.id, c.name_ru)
    cityCountry.set(c.id, c.country_id != null ? (countryName.get(c.country_id) ?? '—') : '—')
  }

  const NO_CITY = 'Без города'

  // ── totals ───────────────────────────────────────────────
  const totals: StatTotals = {
    students: 0,
    curators: 0,
    admins: 0,
    passedCourse: 0,
    cities: 0,
  }
  // Ученики с учётом видимости (скрытые исключаются, если запрашивающий не владелец)
  const students = visibleStudents(profiles, isOwner, scopeCuratorId)
  // Куратор видит только агрегаты своей группы, не платформенные счётчики персонала
  if (!scopeCuratorId) {
    for (const p of profiles) {
      if (p.role === 'curator') totals.curators++
      else if (p.role === 'admin' || p.role === 'super_admin') totals.admins++
    }
  }
  totals.students = students.length

  const passedMap = new Map<string, number>()
  for (const p of passed) passedMap.set(p.user_id, p.blocks_passed)
  const currentBlock = (uid: string) => Math.min(MAX_BLOCK, (passedMap.get(uid) ?? 0) + 1)

  // ── byCity / byCountry (только ученики) ──────────────────
  const cityCount = new Map<string, { city: string; country: string; count: number }>()
  const countryCount = new Map<string, number>()
  const activeCityIds = new Set<number>()

  for (const s of students) {
    const cId = s.city_id
    const city = cId != null ? (cityName.get(cId) ?? NO_CITY) : NO_CITY
    const country = cId != null ? (cityCountry.get(cId) ?? '—') : '—'
    if (cId != null && cityName.has(cId)) activeCityIds.add(cId)

    const key = `${city}__${country}`
    const cur = cityCount.get(key)
    if (cur) cur.count++
    else cityCount.set(key, { city, country, count: 1 })

    countryCount.set(country, (countryCount.get(country) ?? 0) + 1)

    if ((passedMap.get(s.id) ?? 0) >= MAX_BLOCK) totals.passedCourse++
  }
  totals.cities = activeCityIds.size

  const byCity: CityRow[] = [...cityCount.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const byCountry: CountryRow[] = [...countryCount.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)

  // ── progress: распределение по текущему блоку 1..10 ──────
  const progressCounts = new Array<number>(MAX_BLOCK + 1).fill(0) // index 1..10
  for (const s of students) progressCounts[currentBlock(s.id)]++
  const progress: ProgressRow[] = []
  for (let b = 1; b <= MAX_BLOCK; b++) progress.push({ block: b, count: progressCounts[b] })

  // ── streaks ──────────────────────────────────────────────
  const datesByUser = new Map<string, string[]>()
  for (const row of closed) {
    const arr = datesByUser.get(row.user_id)
    if (arr) arr.push(row.d)
    else datesByUser.set(row.user_id, [row.d])
  }

  const studentById = new Map<string, ProfileRow>()
  for (const s of students) studentById.set(s.id, s)

  const streaks: StreakRow[] = []
  for (const [uid, dates] of datesByUser) {
    const s = studentById.get(uid)
    // studentById содержит только видимых учеников (уже отфильтровано через visibleStudents)
    if (!s) continue
    const totalDays = new Set(dates.map(dayIndex)).size
    streaks.push({
      name: s.full_name ?? 'Без имени',
      telegram: s.contact_info ?? null,
      city: s.city_id != null ? (cityName.get(s.city_id) ?? NO_CITY) : NO_CITY,
      maxStreak: longestStreak(dates),
      totalDays,
    })
  }
  streaks.sort((a, b) => b.maxStreak - a.maxStreak || b.totalDays - a.totalDays)
  const topStreaks = streaks.slice(0, 10)

  // ── stuck ────────────────────────────────────────────────
  const today = todayIndex()
  const stuckList: StuckRow[] = []
  for (const s of students) {
    // students уже отфильтрован через visibleStudents — скрытые там не попадают (если !isOwner)
    const dates = datesByUser.get(s.id)
    const hasStarted = !!s.course_started_at
    const passedAll = (passedMap.get(s.id) ?? 0) >= MAX_BLOCK
    if (passedAll) continue

    if (!dates || dates.length === 0) {
      // 0 закрытых дней при заданном старте курса
      if (hasStarted) {
        stuckList.push({
          name: s.full_name ?? 'Без имени',
          telegram: s.contact_info ?? null,
          city: s.city_id != null ? (cityName.get(s.city_id) ?? NO_CITY) : NO_CITY,
          currentBlock: currentBlock(s.id),
          lastDayAgo: null,
        })
      }
      continue
    }

    const lastIdx = Math.max(...dates.map(dayIndex))
    const ago = today - lastIdx
    if (ago > STUCK_DAYS) {
      stuckList.push({
        name: s.full_name ?? 'Без имени',
        telegram: s.contact_info ?? null,
        city: s.city_id != null ? (cityName.get(s.city_id) ?? NO_CITY) : NO_CITY,
        currentBlock: currentBlock(s.id),
        lastDayAgo: ago,
      })
    }
  }
  // null (никогда не закрывал) — наверх, дальше по давности
  stuckList.sort((a, b) => {
    if (a.lastDayAgo === null && b.lastDayAgo === null) return 0
    if (a.lastDayAgo === null) return -1
    if (b.lastDayAgo === null) return 1
    return b.lastDayAgo - a.lastDayAgo
  })
  const stuck = stuckList.slice(0, 15)

  return { totals, byCity, byCountry, progress, streaks: topStreaks, stuck }
}
