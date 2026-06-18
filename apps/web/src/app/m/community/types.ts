export type PostKind = 'text' | 'audio' | 'video_note' | 'photo'

export interface FeedPost {
  id: string
  kind: PostKind
  content_text: string | null
  media_url: string | null
  author_name: string
  author_city: string | null
  author_avatar: string | null
  created_at: string
  can_delete: boolean
}

export interface FeedResponse {
  posts: FeedPost[]
  has_more: boolean
}
