import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

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

export interface CuratorsResponse {
  curators: CuratorRow[]
  totalCurators: number
  totalStudents: number
}

/**
 * GET /api/panel/curators — список кураторов с городом, страной и их учениками.
 * Один проход: select кураторов + select учеников (curator_id) + cities/countries map.
 */
export async function GET(req: NextRequest) {
  const session = getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceSupabase()

  const [curatorsRes, studentsRes, citiesRes, countriesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, city_id')
      .eq('role', 'curator'),
    supabase
      .from('profiles')
      .select('id, full_name, contact_info, curator_id')
      .eq('role', 'student')
      .not('curator_id', 'is', null),
    supabase.from('cities').select('id, name_ru, country_id'),
    supabase.from('countries').select('id, name_ru'),
  ])

  const firstError =
    curatorsRes.error || studentsRes.error || citiesRes.error || countriesRes.error
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const countryById = new Map<number, string>()
  for (const c of countriesRes.data ?? []) {
    countryById.set(c.id, c.name_ru)
  }

  const cityById = new Map<number, { name: string; country: string | null }>()
  for (const c of citiesRes.data ?? []) {
    cityById.set(c.id, {
      name: c.name_ru,
      country: c.country_id != null ? countryById.get(c.country_id) ?? null : null,
    })
  }

  const studentsByCurator = new Map<string, CuratorStudent[]>()
  let totalStudents = 0
  for (const s of studentsRes.data ?? []) {
    if (!s.curator_id) continue
    const list = studentsByCurator.get(s.curator_id) ?? []
    list.push({ id: s.id, name: s.full_name, nick: s.contact_info })
    studentsByCurator.set(s.curator_id, list)
    totalStudents += 1
  }

  const curators: CuratorRow[] = (curatorsRes.data ?? []).map((cu) => {
    const city = cu.city_id != null ? cityById.get(cu.city_id) ?? null : null
    const students = studentsByCurator.get(cu.id) ?? []
    return {
      id: cu.id,
      name: cu.full_name,
      nick: cu.contact_info,
      city: city?.name ?? null,
      country: city?.country ?? null,
      studentsCount: students.length,
      students,
    }
  })

  curators.sort(
    (a, b) => b.studentsCount - a.studentsCount || (a.name ?? '').localeCompare(b.name ?? ''),
  )

  const payload: CuratorsResponse = {
    curators,
    totalCurators: curators.length,
    totalStudents,
  }

  return NextResponse.json(payload)
}
