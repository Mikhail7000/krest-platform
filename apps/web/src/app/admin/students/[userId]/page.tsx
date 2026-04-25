import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Profile, Block, StudentProgress, JournalEntry } from '@/lib/supabase-server'
import { ApproveButton } from './ApproveButton'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ userId: string }>
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { userId } = await params
  const supabase = await createServerSupabase()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) redirect('/login')

  const { data: rawAdminProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()
  const adminProfile = rawAdminProfile as unknown as Profile | null
  if (!adminProfile || adminProfile.role !== 'admin') redirect('/student')

  const { data: rawStudent } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  const student = rawStudent as unknown as Profile | null
  if (!student) redirect('/admin')

  const { data: rawBlocks } = await supabase
    .from('blocks')
    .select('*')
    .order('order_num', { ascending: true })
  const blocks = (rawBlocks as unknown as Block[]) ?? []

  const { data: rawProgress } = await supabase
    .from('student_progress')
    .select('*')
    .eq('user_id', userId)
    .is('lesson_id', null)
  const progressList = (rawProgress as unknown as StudentProgress[]) ?? []
  const progressMap = new Map(progressList.map((p) => [p.block_id, p]))

  const { data: rawJournal } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  const journal = (rawJournal as unknown as JournalEntry[]) ?? []
  const journalMap = new Map(journal.map((j) => [j.block_id, j]))

  let nastavnik: Profile | null = null
  if (student.nastavnik_id) {
    const { data: rawNastavnik } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', student.nastavnik_id)
      .single()
    nastavnik = rawNastavnik as unknown as Profile | null
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Все студенты
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {student.full_name || 'Студент'}
          </h1>
          <p className="text-sm text-gray-400">{student.email}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Информация о горнице</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Тип:</span>
              <span className="text-gray-900 font-medium">
                {student.gornitsa_type === 'offline'
                  ? 'Офлайн'
                  : student.gornitsa_type === 'online'
                  ? 'Онлайн'
                  : 'Не выбрано'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Город:</span>
              <span className="text-gray-900 font-medium">
                {student.city || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Наставник:</span>
              <span className="text-gray-900 font-medium">
                {nastavnik ? nastavnik.full_name : 'не назначен'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {blocks.map((block) => {
            const progress = progressMap.get(block.id) ?? null
            const entry = journalMap.get(block.id) ?? null
            const unlocked = block.order_num <= student.blocks_unlocked
            const submitted = progress !== null
            const approved = progress?.admin_approved === true

            return (
              <div key={block.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">Блок {block.order_num}</span>
                      {!unlocked && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 закрыт</span>}
                      {unlocked && !submitted && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">В процессе</span>}
                      {submitted && !approved && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Ожидает</span>}
                      {approved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Одобрен</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900">{block.title_ru}</h3>

                    {entry && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Ответ студента:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.content}</p>
                      </div>
                    )}
                  </div>

                  {submitted && !approved && (
                    <ApproveButton
                      userId={userId}
                      blockId={block.id}
                      progressId={progress!.id}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
