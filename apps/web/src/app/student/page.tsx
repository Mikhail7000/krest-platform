import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Profile, Block, StudentProgress } from '@/lib/supabase-server'
import Link from 'next/link'

function BlockCard({
  block,
  unlocked,
  progress,
}: {
  block: Block
  unlocked: boolean
  progress: StudentProgress | null
}) {
  const approved = progress?.admin_approved === true
  const submitted = progress !== null
  const available = unlocked && !submitted

  let status: 'locked' | 'available' | 'pending' | 'approved'
  if (!unlocked) status = 'locked'
  else if (approved) status = 'approved'
  else if (submitted) status = 'pending'
  else status = 'available'

  const statusConfig = {
    locked: { icon: '🔒', label: 'Заблокирован', color: 'bg-gray-50 border-gray-200 text-gray-400' },
    available: { icon: '▶️', label: 'Начать', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    pending: { icon: '⏳', label: 'Ожидает одобрения', color: 'bg-amber-50 border-amber-200 text-amber-700' },
    approved: { icon: '✅', label: 'Завершён', color: 'bg-green-50 border-green-200 text-green-700' },
  }

  const cfg = statusConfig[status]

  const card = (
    <div className={`rounded-xl border p-5 transition-all ${cfg.color} ${status === 'available' ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium opacity-60">Блок {block.order_num}</span>
          </div>
          <h3 className="font-semibold text-base leading-snug">{block.title_ru}</h3>
        </div>
        <span className="text-xl shrink-0">{cfg.icon}</span>
      </div>
      <div className="mt-3 pt-3 border-t border-current border-opacity-20">
        <span className="text-xs font-medium">{cfg.label}</span>
      </div>
    </div>
  )

  if (status === 'available') {
    return <Link href={`/student/lesson/${block.id}`}>{card}</Link>
  }
  return card
}

export default async function StudentDashboard() {
  const supabase = await createServerSupabase()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) redirect('/login')
  const user = authData!.user!

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as Profile | null
  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')

  const { data: rawBlocks } = await supabase
    .from('blocks')
    .select('*')
    .order('order_num', { ascending: true })
  const blocks = (rawBlocks as unknown as Block[]) ?? []

  const { data: rawProgress } = await supabase
    .from('student_progress')
    .select('*')
    .eq('user_id', user.id)
    .is('lesson_id', null)
  const progressList = (rawProgress as unknown as StudentProgress[]) ?? []

  const progressMap = new Map(progressList.map((p) => [p.block_id, p]))

  const completedCount = progressList.filter((p) => p.admin_approved).length

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">КРЕСТ</h1>
          <p className="text-gray-500 mt-1">
            Добро пожаловать, {profile.full_name || 'студент'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Прогресс курса</span>
            <span className="text-sm font-bold text-gray-900">{completedCount} / 6</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Block grid */}
        <div className="grid grid-cols-1 gap-3">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              unlocked={block.order_num <= profile.blocks_unlocked}
              progress={progressMap.get(block.id) ?? null}
            />
          ))}
        </div>

        {/* Logout */}
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
