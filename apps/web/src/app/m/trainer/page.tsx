import Link from 'next/link'
import { createServiceSupabase } from '@/lib/supabase-service'
import { BottomNav } from '../_components/BottomNav'
import '../dashboard/dashboard.css'
import '../profile/profile.css'

export const dynamic = 'force-dynamic'

// Индекс тренажёра местописаний: список блоков → /m/trainer/[blockId]
export default async function TrainerIndexPage() {
  const supabase = createServiceSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blocks } = await (supabase as any)
    .from('blocks')
    .select('id, title_ru, order_num')
    .eq('course_id', 1)
    // Блок 0 «Подготовка» не показываем в тренажёре — у него нет местописаний
    .gte('order_num', 1)
    .order('order_num', { ascending: true })

  type Row = { id: number; title_ru: string; order_num: number }
  const list = (blocks ?? []) as Row[]

  return (
    <>
      <div className="db-page miniapp-container">
        <div className="pf-head">
          <h1 className="pf-name">Тренажёр местописаний</h1>
          <p className="pf-role">Выбери блок для тренировки</p>
        </div>

        <p className="pf-section">Блоки</p>
        {list.map((b) => (
          <Link key={b.id} href={`/m/trainer/${b.id}`} className="pf-card pf-linkrow">
            <span className="pf-row__label">
              Блок {b.order_num} · {b.title_ru}
            </span>
            <span className="pf-linkrow__arrow">›</span>
          </Link>
        ))}
      </div>
      <BottomNav />
    </>
  )
}
