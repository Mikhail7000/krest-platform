/**
 * POST /api/m/community/feed
 * Глобальная лента сообщества — страница 20 постов, пагинация по created_at.
 * Body: { initData, before?: string }
 * Ответ: { posts: PostItem[], has_more: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const BUCKET = 'community-media'
const SIGNED_TTL = 60 * 60
const PRIVILEGED_ROLES = new Set(['curator', 'admin', 'super_admin'])

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

interface PostRow {
  id: string
  author_id: string
  kind: string
  content_text: string | null
  storage_path: string | null
  created_at: string
  profiles: {
    full_name: string | null
    role: string | null
    cities: { name_ru: string } | null
  } | null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    initData?: string
    before?: string
  } | null

  if (!body) return err('Invalid JSON', 'BAD_REQUEST', 400)

  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  const supabase = createServiceSupabase()

  // Получаем роль запросившего для can_delete
  const { data: requesterProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()

  const requesterRole = (requesterProfile as { role: string | null } | null)?.role ?? null
  const isPrivileged = requesterRole !== null && PRIVILEGED_ROLES.has(requesterRole)

  // Строим запрос ленты
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('community_posts')
    .select(`
      id,
      author_id,
      kind,
      content_text,
      storage_path,
      created_at,
      profiles!community_posts_author_id_fkey (
        full_name,
        role,
        cities ( name_ru )
      )
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1) // берём на 1 больше, чтобы определить has_more

  if (body.before) {
    query = query.lt('created_at', body.before)
  }

  const { data: rawPosts, error: fetchErr } = await query

  if (fetchErr) {
    console.error('[community/feed] fetch error:', fetchErr)
    return err('Не удалось загрузить ленту', 'DB_ERROR', 500)
  }

  const rows = (rawPosts ?? []) as PostRow[]
  const has_more = rows.length > PAGE_SIZE
  const page = has_more ? rows.slice(0, PAGE_SIZE) : rows

  // Signed URL пачкой для медиа-постов
  const mediaPaths = page.map((r) => r.storage_path).filter((p): p is string => !!p)
  const urlByPath = new Map<string, string>()

  if (mediaPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(mediaPaths, SIGNED_TTL)
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl)
    }
  }

  const posts = page.map((r) => {
    const canDelete =
      r.author_id === auth.userId || isPrivileged

    return {
      id: r.id,
      kind: r.kind,
      content_text: r.content_text,
      media_url: r.storage_path ? (urlByPath.get(r.storage_path) ?? null) : null,
      author_name: r.profiles?.full_name ?? 'Участник',
      author_city: r.profiles?.cities?.name_ru ?? null,
      created_at: r.created_at,
      can_delete: canDelete,
    }
  })

  return NextResponse.json({ posts, has_more })
}
