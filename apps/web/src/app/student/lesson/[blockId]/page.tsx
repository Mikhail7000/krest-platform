import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Block, Lesson, Profile } from '@/lib/supabase-server'
import { LessonClient } from './LessonClient'

interface PageProps {
  params: Promise<{ blockId: string }>
}

export default async function LessonPage({ params }: PageProps) {
  const { blockId } = await params
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
  if (!profile) redirect('/login')

  const { data: rawBlock } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', blockId)
    .single()
  const block = rawBlock as unknown as Block | null
  if (!block) redirect('/student')
  if (block.order_num > profile.blocks_unlocked) redirect('/student')

  const { data: rawLesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('block_id', blockId)
    .order('order_num', { ascending: true })
    .limit(1)
    .single()
  const lesson = rawLesson as unknown as Lesson | null
  if (!lesson) redirect('/student')

  const { data: existingEntry } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('block_id', blockId)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <a href="/student" className="text-sm text-blue-600 hover:underline">
            ← Назад к курсу
          </a>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{block.title_ru}</h1>
          <p className="text-sm text-gray-500 mt-1">Блок {block.order_num} из 6</p>
        </div>

        <LessonClient
          block={block}
          lesson={lesson}
          userId={user.id}
          hasExistingEntry={!!existingEntry}
        />
      </div>
    </main>
  )
}
