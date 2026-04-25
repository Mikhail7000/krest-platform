/**
 * Supabase Database Types for KREST Platform
 * Generated from schema: profiles, blocks, lessons, student_progress, journal_entries, bible_verses, uploads
 */

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
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          role?: 'student' | 'admin'
          blocks_unlocked?: number
          telegram_chat_id?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          role?: 'student' | 'admin'
          blocks_unlocked?: number
          telegram_chat_id?: number | null
          created_at?: string
        }
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
        Insert: {
          id?: string
          order_num: number
          title_ru: string
          title_en: string
          content_ru: string
          content_en: string
          created_at?: string
        }
        Update: {
          id?: string
          order_num?: number
          title_ru?: string
          title_en?: string
          content_ru?: string
          content_en?: string
          created_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          block_id: string
          order_num: number
          title_ru: string
          title_en: string
          youtube_url: string
          created_at: string
        }
        Insert: {
          id?: string
          block_id: string
          order_num: number
          title_ru: string
          title_en: string
          youtube_url: string
          created_at?: string
        }
        Update: {
          id?: string
          block_id?: string
          order_num?: number
          title_ru?: string
          title_en?: string
          youtube_url?: string
          created_at?: string
        }
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
        Insert: {
          id?: string
          user_id: string
          block_id: string
          lesson_id?: string | null
          admin_approved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          block_id?: string
          lesson_id?: string | null
          admin_approved?: boolean
          created_at?: string
        }
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
        Insert: {
          id?: string
          user_id: string
          block_id: string
          content: string
          submitted_to_leader?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          block_id?: string
          content?: string
          submitted_to_leader?: boolean
          created_at?: string
        }
      }
      bible_verses: {
        Row: {
          id: string
          block_id: string | null
          reference: string
          text_ru: string
          text_en: string
          created_at: string
        }
        Insert: {
          id?: string
          block_id?: string | null
          reference: string
          text_ru: string
          text_en: string
          created_at?: string
        }
        Update: {
          id?: string
          block_id?: string | null
          reference?: string
          text_ru?: string
          text_en?: string
          created_at?: string
        }
      }
      uploads: {
        Row: {
          id: string
          user_id: string
          filename: string
          url: string
          block_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          url: string
          block_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          url?: string
          block_id?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for accessing table types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience aliases
export type Profile = Tables<'profiles'>
export type Block = Tables<'blocks'>
export type Lesson = Tables<'lessons'>
export type StudentProgress = Tables<'student_progress'>
export type JournalEntry = Tables<'journal_entries'>
export type BibleVerse = Tables<'bible_verses'>
export type Upload = Tables<'uploads'>
