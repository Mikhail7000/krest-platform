// Server Component — reads block progress and renders a banner
// TODO: after database-architect adds student_block_progress table, swap local types for DB types

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../../../../../packages/supabase/src/types'

const adminClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

// TODO: replace with real table type once migration is applied
interface BlockProgress {
  block_unlocked_at: string | null
  block_passed_at: string | null
  can_skip_block_lock: boolean
}

async function loadBlockProgress(blockId: number): Promise<BlockProgress | null> {
  const userId = process.env.DEV_BYPASS_USER_ID
  if (!userId) return null

  const supabase = adminClient()

  // Read can_skip_block_lock from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('can_skip_block_lock')
    .eq('id', userId)
    .maybeSingle()

  // TODO: once student_block_progress table exists, query it here for block_unlocked_at / block_passed_at
  // const { data: progress } = await supabase
  //   .from('student_block_progress')
  //   .select('block_unlocked_at, block_passed_at')
  //   .eq('user_id', userId)
  //   .eq('block_id', blockId)
  //   .maybeSingle()

  return {
    block_unlocked_at: null, // placeholder until migration
    block_passed_at: null,
    can_skip_block_lock: !!(profile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock,
  }
}

function daysBetween(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

interface Props { blockId: number }

export async function BlockProgressBanner({ blockId }: Props) {
  const progress = await loadBlockProgress(blockId)
  if (!progress) return null

  if (progress.can_skip_block_lock) {
    return (
      <div className="lesson-progress-banner lesson-progress-banner--skip">
        ✓ Тестовый режим — все блоки доступны без ожидания
      </div>
    )
  }

  if (progress.block_passed_at) {
    return (
      <div className="lesson-progress-banner lesson-progress-banner--done">
        Блок завершён — следующий доступен
      </div>
    )
  }

  if (progress.block_unlocked_at) {
    const days = daysBetween(progress.block_unlocked_at)
    const clampedDay = Math.min(7, Math.max(1, days + 1))
    const pct = Math.min(100, Math.round((clampedDay / 7) * 100))
    return (
      <div className="lesson-progress-banner">
        <div className="lesson-progress-banner__label">
          <span>День {clampedDay} / 7</span>
        </div>
        <div className="lesson-progress-bar">
          <div className="lesson-progress-bar__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return null
}
