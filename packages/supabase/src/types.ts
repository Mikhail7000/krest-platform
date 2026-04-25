// Типы будут сгенерированы через:
// supabase gen types typescript --project-id aejhlmoydnhgedgfndql
// Пока — placeholder

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: 'student' | 'admin'
          blocks_unlocked: number
          telegram_chat_id: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      blocks: {
        Row: {
          id: string
          order_num: number
          title_ru: string
          title_en: string
          content_ru: string
          content_en: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['blocks']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['blocks']['Insert']>
      }
      student_progress: {
        Row: {
          id: string
          user_id: string
          block_id: string
          lesson_id: string | null
          admin_approved: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['student_progress']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['student_progress']['Insert']>
      }
      journal_entries: {
        Row: {
          id: string
          user_id: string
          block_id: string
          content: string
          submitted_to_leader: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>
      }
    }
  }
}
