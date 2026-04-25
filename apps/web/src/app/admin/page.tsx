import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Profile } from '@/lib/supabase-server'
import Link from 'next/link'

interface StudentRow {
  id: string
  full_name: string | null
  email: string | null
  blocks_unlocked: number
  pendingCount: number
  city: string | null
  gornitsa_type: string | null
  nastavnik_id: string | null
  nastavnik_name: string | null
  onboarding_done: boolean | null
}

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  const { filter } = await searchParams
  const supabase = await createServerSupabase()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) redirect('/login')
  const user = authData!.user!

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/student')

  const { data: rawStudents } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('full_name', { ascending: true })
  const students = (rawStudents as unknown as Profile[]) ?? []

  const nastavnikIds = [...new Set(students.map(s => s.nastavnik_id).filter(Boolean))]
  const { data: rawNastavniki } = nastavnikIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', nastavnikIds)
    : { data: [] }
  const nastavnikiMap = new Map(
    ((rawNastavniki as unknown as Profile[]) ?? []).map(n => [n.id, n.full_name])
  )

  const { data: rawPending } = await supabase
    .from('student_progress')
    .select('user_id, admin_approved')
    .eq('admin_approved', false)
    .is('lesson_id', null)
  const pending = (rawPending as unknown as { user_id: string; admin_approved: boolean }[]) ?? []

  const pendingByUser = new Map<string, number>()
  pending.forEach(({ user_id }) => {
    pendingByUser.set(user_id, (pendingByUser.get(user_id) ?? 0) + 1)
  })

  let studentRows: StudentRow[] = students.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    email: s.email,
    blocks_unlocked: s.blocks_unlocked,
    pendingCount: pendingByUser.get(s.id) ?? 0,
    city: s.city,
    gornitsa_type: s.gornitsa_type,
    nastavnik_id: s.nastavnik_id,
    nastavnik_name: s.nastavnik_id ? nastavnikiMap.get(s.nastavnik_id) ?? null : null,
    onboarding_done: s.onboarding_done,
  }))

  if (filter === 'offline') {
    studentRows = studentRows.filter(s => s.gornitsa_type === 'offline')
  } else if (filter === 'online') {
    studentRows = studentRows.filter(s => s.gornitsa_type === 'online')
  } else if (filter === 'pending') {
    studentRows = studentRows.filter(s => s.onboarding_done === false || s.onboarding_done === null)
  }

  const totalPending = pending.length

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Панель лидера</h1>
            <p className="text-gray-500 mt-1">{profile.full_name}</p>
          </div>
          {totalPending > 0 && (
            <div className="bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1.5 rounded-full">
              {totalPending} ожидает одобрения
            </div>
          )}
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <Link
            href="/admin"
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !filter
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Все
          </Link>
          <Link
            href="/admin?filter=offline"
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'offline'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Офлайн
          </Link>
          <Link
            href="/admin?filter=online"
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'online'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Онлайн
          </Link>
          <Link
            href="/admin?filter=pending"
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Не выбрано
          </Link>
        </div>

        <div className="space-y-3">
          {studentRows.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Студентов пока нет
            </div>
          )}
          {studentRows.map((s) => (
            <Link key={s.id} href={`/admin/students/${s.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {s.full_name || 'Без имени'}
                    </p>
                    <p className="text-sm text-gray-400 truncate">{s.email}</p>
                    {s.city && s.gornitsa_type && (
                      <p className="text-xs text-gray-500 mt-1">
                        {s.gornitsa_type === 'offline' ? '⛪️' : '🌐'} {s.city} ({s.gornitsa_type === 'offline' ? 'офлайн' : 'онлайн'})
                      </p>
                    )}
                    {s.nastavnik_name && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Наставник: {s.nastavnik_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">Блок {s.blocks_unlocked} / 6</div>
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${(s.blocks_unlocked / 6) * 100}%` }}
                        />
                      </div>
                    </div>
                    {s.pendingCount > 0 && (
                      <div className="w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {s.pendingCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
