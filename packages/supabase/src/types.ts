/**
 * Supabase Database Types for KREST Platform
 * Generated via mcp__supabase__generate_typescript_types on 2026-05-03.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      bible_verses: {
        Row: {
          block_id: number | null
          created_at: string | null
          id: number
          lesson_id: number | null
          memorized: boolean | null
          order_num: number | null
          reference: string | null
          text_en: string | null
          text_ru: string | null
          user_id: string | null
          verse_text: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["bible_verses"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["bible_verses"]["Row"]>
        Relationships: []
      }
      block_resources: {
        Row: {
          block_id: number
          created_at: string
          description_ru: string | null
          id: string
          is_required: boolean
          kinescope_id: string | null
          order_num: number
          resource_type: string
          storage_path: string | null
          title_ru: string
          transcript_md: string | null
          updated_at: string
        }
        Insert: {
          block_id: number
          created_at?: string
          description_ru?: string | null
          id?: string
          is_required?: boolean
          kinescope_id?: string | null
          order_num?: number
          resource_type: string
          storage_path?: string | null
          title_ru: string
          transcript_md?: string | null
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["block_resources"]["Row"]>
        Relationships: []
      }
      blocks: {
        Row: {
          color: string | null
          content_en: string | null
          content_ru: string | null
          course_id: number | null
          description_en: string | null
          description_ru: string | null
          id: number
          letter: string | null
          order_num: number | null
          slug: string | null
          subtitle_en: string | null
          subtitle_ru: string | null
          title_en: string | null
          title_ru: string | null
          youtube_en: string | null
          youtube_ru: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["blocks"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["blocks"]["Row"]>
        Relationships: []
      }
      cities: {
        Row: {
          country_id: number
          created_at: string
          id: number
          name_en: string | null
          name_ru: string
          status: string | null
          timezone: string
        }
        Insert: Partial<Database["public"]["Tables"]["cities"]["Row"]> & { country_id: number; name_ru: string }
        Update: Partial<Database["public"]["Tables"]["cities"]["Row"]>
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          id: number
          name_en: string
          name_ru: string
          status: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["countries"]["Row"]> & { code: string; name_en: string; name_ru: string }
        Update: Partial<Database["public"]["Tables"]["countries"]["Row"]>
        Relationships: []
      }
      course_progress: {
        Row: {
          completed_at: string | null
          course_id: number
          final_exam_passed_at: string | null
          id: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: Partial<Database["public"]["Tables"]["course_progress"]["Row"]> & { course_id: number; user_id: string }
        Update: Partial<Database["public"]["Tables"]["course_progress"]["Row"]>
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          description_ru: string | null
          id: number
          order_num: number
          slug: string
          status: string
          title_en: string | null
          title_ru: string
          unlock_after_course_id: number | null
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["courses"]["Row"]> & { order_num: number; slug: string; title_ru: string }
        Update: Partial<Database["public"]["Tables"]["courses"]["Row"]>
        Relationships: []
      }
      journal_entries: {
        Row: {
          block_id: number | null
          content: string | null
          created_at: string | null
          id: number
          leader_feedback: string | null
          lesson_id: number | null
          submitted_at: string | null
          submitted_to_leader: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["journal_entries"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["journal_entries"]["Row"]>
        Relationships: []
      }
      lessons: {
        Row: {
          block_id: number | null
          content_en: string | null
          content_ru: string | null
          id: number
          order_num: number | null
          title_en: string | null
          title_ru: string | null
          verses: Json | null
          youtube_url: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["lessons"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["lessons"]["Row"]>
        Relationships: []
      }
      notifications_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          status: string | null
          type: string
          user_id: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["notifications_log"]["Row"]> & { channel: string; type: string }
        Update: Partial<Database["public"]["Tables"]["notifications_log"]["Row"]>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city_id: number | null
          contact_info: string | null
          country_id: number | null
          created_at: string | null
          curator_id: string | null
          email: string | null
          full_name: string | null
          id: string
          interests: string | null
          is_protected: boolean | null
          lang: string | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          onboarding_done: boolean | null
          referral_detail: string | null
          referral_source: string | null
          role: string | null
          telegram_chat_id: number | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
        Relationships: []
      }
      role_change_log: {
        Row: {
          changed_by: string
          changed_user_id: string
          created_at: string
          id: string
          new_role: string
          old_role: string
          reason: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["role_change_log"]["Row"]> & { changed_by: string; changed_user_id: string; new_role: string; old_role: string }
        Update: Partial<Database["public"]["Tables"]["role_change_log"]["Row"]>
        Relationships: []
      }
      student_progress: {
        Row: {
          admin_approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          block_id: number | null
          completed: boolean | null
          completed_at: string | null
          id: number
          last_visited: string | null
          lesson_id: number | null
          rejection_count: number | null
          user_id: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["student_progress"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["student_progress"]["Row"]>
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: number
          journal_entry_id: number | null
          user_id: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["uploads"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["uploads"]["Row"]>
        Relationships: []
      }
      weekly_submissions: {
        Row: {
          block_id: number | null
          id: number
          leader_feedback: string | null
          leader_reviewed: boolean | null
          submitted_at: string | null
          summary: string | null
          user_id: string | null
          week_number: number | null
        }
        Insert: Partial<Database["public"]["Tables"]["weekly_submissions"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["weekly_submissions"]["Row"]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_leader_chat_id: { Args: { student_id: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_visible_to: { Args: { target_id: string; viewer_id: string }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
