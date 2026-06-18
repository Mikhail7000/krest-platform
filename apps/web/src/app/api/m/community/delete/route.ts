/**
 * POST /api/m/community/delete
 * Мягкое удаление поста (soft-delete).
 * Body: { initData, post_id }
 * Разрешено автору поста или роли: curator | admin | super_admin.
 * Ответ: { ok: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const PRIVILEGED_ROLES = new Set(['curator', 'admin', 'super_admin'])

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    initData?: string
    post_id?: string
  } | null

  if (!body) return err('Invalid JSON', 'BAD_REQUEST', 400)

  const postId = body.post_id
  if (!postId || typeof postId !== 'string' || postId.trim().length === 0) {
    return err('post_id обязателен', 'MISSING_POST_ID', 400)
  }

  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  const supabase = createServiceSupabase()

  // Загружаем пост и роль автора параллельно
  const [postResult, profileResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('community_posts')
      .select('id, author_id, is_deleted')
      .eq('id', postId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.userId)
      .maybeSingle(),
  ])

  const post = postResult.data as { id: string; author_id: string; is_deleted: boolean } | null
  const requesterRole =
    (profileResult.data as { role: string | null } | null)?.role ?? null

  if (!post) {
    return err('Пост не найден', 'POST_NOT_FOUND', 404)
  }

  if (post.is_deleted) {
    return err('Пост уже удалён', 'ALREADY_DELETED', 409)
  }

  const isAuthor = post.author_id === auth.userId
  const isPrivileged = requesterRole !== null && PRIVILEGED_ROLES.has(requesterRole)

  if (!isAuthor && !isPrivileged) {
    return err('Нет прав на удаление этого поста', 'FORBIDDEN', 403)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from('community_posts')
    .update({ is_deleted: true, deleted_by: auth.userId })
    .eq('id', postId)

  if (updateErr) {
    console.error('[community/delete] update error:', updateErr)
    return err('Не удалось удалить пост', 'DB_ERROR', 500)
  }

  return NextResponse.json({ ok: true })
}
