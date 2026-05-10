/**
 * Supabase Database Types for KREST Platform
 * Regenerated via mcp__supabase__generate_typescript_types on 2026-05-09
 * после применения 9 миграций AI-first flow.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_call_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          provider: string
          purpose: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          provider: string
          purpose: string
          success: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          purpose?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      block_locations_to_recite: {
        Row: {
          block_id: number
          check_mode: string
          created_at: string
          exact_text: string
          id: string
          is_required: boolean
          order_index: number
          reference: string
          rubric: string | null
          similarity_threshold: number
          topic_label: string | null
          updated_at: string
        }
        Insert: {
          block_id: number
          check_mode?: string
          created_at?: string
          exact_text: string
          id?: string
          is_required?: boolean
          order_index?: number
          reference: string
          rubric?: string | null
          similarity_threshold?: number
          topic_label?: string | null
          updated_at?: string
        }
        Update: {
          block_id?: number
          check_mode?: string
          created_at?: string
          exact_text?: string
          id?: string
          is_required?: boolean
          order_index?: number
          reference?: string
          rubric?: string | null
          similarity_threshold?: number
          topic_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_locations_to_recite_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      block_quiz_questions: {
        Row: {
          block_id: number
          correct_indices: number[] | null
          created_at: string
          edited_manually: boolean
          expected_answer: string | null
          generated_by_ai: boolean
          id: string
          is_final_exam: boolean
          is_mid_exam: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          rubric: string | null
          updated_at: string
        }
        Insert: {
          block_id: number
          correct_indices?: number[] | null
          created_at?: string
          edited_manually?: boolean
          expected_answer?: string | null
          generated_by_ai?: boolean
          id?: string
          is_final_exam?: boolean
          is_mid_exam?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
          rubric?: string | null
          updated_at?: string
        }
        Update: {
          block_id?: number
          correct_indices?: number[] | null
          created_at?: string
          edited_manually?: boolean
          expected_answer?: string | null
          generated_by_ai?: boolean
          id?: string
          is_final_exam?: boolean
          is_mid_exam?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          rubric?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_quiz_questions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
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
          summary_md: string | null
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
          summary_md?: string | null
          title_ru: string
          transcript_md?: string | null
          updated_at?: string
        }
        Update: {
          block_id?: number
          created_at?: string
          description_ru?: string | null
          id?: string
          is_required?: boolean
          kinescope_id?: string | null
          order_num?: number
          resource_type?: string
          storage_path?: string | null
          summary_md?: string | null
          title_ru?: string
          transcript_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_resources_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          color?: string | null
          content_en?: string | null
          content_ru?: string | null
          course_id?: number | null
          description_en?: string | null
          description_ru?: string | null
          id?: number
          letter?: string | null
          order_num?: number | null
          slug?: string | null
          subtitle_en?: string | null
          subtitle_ru?: string | null
          title_en?: string | null
          title_ru?: string | null
          youtube_en?: string | null
          youtube_ru?: string | null
        }
        Update: {
          color?: string | null
          content_en?: string | null
          content_ru?: string | null
          course_id?: number | null
          description_en?: string | null
          description_ru?: string | null
          id?: number
          letter?: string | null
          order_num?: number | null
          slug?: string | null
          subtitle_en?: string | null
          subtitle_ru?: string | null
          title_en?: string | null
          title_ru?: string | null
          youtube_en?: string | null
          youtube_ru?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          country_id: number
          created_at?: string
          id?: number
          name_en?: string | null
          name_ru: string
          status?: string | null
          timezone?: string
        }
        Update: {
          country_id?: number
          created_at?: string
          id?: number
          name_en?: string | null
          name_ru?: string
          status?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          code: string
          created_at?: string
          id?: number
          name_en: string
          name_ru: string
          status?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          name_en?: string
          name_ru?: string
          status?: string | null
        }
        Relationships: []
      }
      course_intro_video: {
        Row: {
          course_id: number
          created_at: string
          description_ru: string | null
          duration_sec: number | null
          id: string
          kinescope_id: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          course_id: number
          created_at?: string
          description_ru?: string | null
          duration_sec?: number | null
          id?: string
          kinescope_id: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          course_id?: number
          created_at?: string
          description_ru?: string | null
          duration_sec?: number | null
          id?: string
          kinescope_id?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_intro_video_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          completed_at?: string | null
          course_id: number
          final_exam_passed_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: number
          final_exam_passed_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          created_at?: string
          description_ru?: string | null
          id?: number
          order_num: number
          slug: string
          status?: string
          title_en?: string | null
          title_ru: string
          unlock_after_course_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ru?: string | null
          id?: number
          order_num?: number
          slug?: string
          status?: string
          title_en?: string | null
          title_ru?: string
          unlock_after_course_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_unlock_after_course_id_fkey"
            columns: ["unlock_after_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          avatar_url?: string | null
          city_id?: number | null
          contact_info?: string | null
          country_id?: number | null
          created_at?: string | null
          curator_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          interests?: string | null
          is_protected?: boolean | null
          lang?: string | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          onboarding_done?: boolean | null
          referral_detail?: string | null
          referral_source?: string | null
          role?: string | null
          telegram_chat_id?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          city_id?: number | null
          contact_info?: string | null
          country_id?: number | null
          created_at?: string | null
          curator_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          interests?: string | null
          is_protected?: boolean | null
          lang?: string | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          onboarding_done?: boolean | null
          referral_detail?: string | null
          referral_source?: string | null
          role?: string | null
          telegram_chat_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_nastavnik_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          changed_by: string
          changed_user_id: string
          created_at?: string
          id?: string
          new_role: string
          old_role: string
          reason?: string | null
        }
        Update: {
          changed_by?: string
          changed_user_id?: string
          created_at?: string
          id?: string
          new_role?: string
          old_role?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_change_log_changed_user_id_fkey"
            columns: ["changed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_progress: {
        Row: {
          block_completed_at: string | null
          block_id: number
          created_at: string
          id: string
          last_quiz_score_pct: number | null
          locations_attempts: number
          locations_locked_until: string | null
          locations_passed_at: string | null
          quiz_attempts: number
          quiz_locked_until: string | null
          quiz_passed_at: string | null
          status: string
          summary_acknowledged_at: string | null
          updated_at: string
          user_id: string
          videos_completed_at: string | null
        }
        Insert: {
          block_completed_at?: string | null
          block_id: number
          created_at?: string
          id?: string
          last_quiz_score_pct?: number | null
          locations_attempts?: number
          locations_locked_until?: string | null
          locations_passed_at?: string | null
          quiz_attempts?: number
          quiz_locked_until?: string | null
          quiz_passed_at?: string | null
          status?: string
          summary_acknowledged_at?: string | null
          updated_at?: string
          user_id: string
          videos_completed_at?: string | null
        }
        Update: {
          block_completed_at?: string | null
          block_id?: number
          created_at?: string
          id?: string
          last_quiz_score_pct?: number | null
          locations_attempts?: number
          locations_locked_until?: string | null
          locations_passed_at?: string | null
          quiz_attempts?: number
          quiz_locked_until?: string | null
          quiz_passed_at?: string | null
          status?: string
          summary_acknowledged_at?: string | null
          updated_at?: string
          user_id?: string
          videos_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_block_progress_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_exam_progress: {
        Row: {
          attempts: number
          created_at: string
          exam_locked_until: string | null
          exam_type: string
          id: string
          last_score_pct: number | null
          passed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          exam_locked_until?: string | null
          exam_type: string
          id?: string
          last_score_pct?: number | null
          passed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          exam_locked_until?: string | null
          exam_type?: string
          id?: string
          last_score_pct?: number | null
          passed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_exam_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_intro_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          intro_video_id: string
          max_watched_seconds: number
          total_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          intro_video_id: string
          max_watched_seconds?: number
          total_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          intro_video_id?: string
          max_watched_seconds?: number
          total_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_intro_progress_intro_video_id_fkey"
            columns: ["intro_video_id"]
            isOneToOne: false
            referencedRelation: "course_intro_video"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_intro_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_location_attempts: {
        Row: {
          ai_call_id: string | null
          ai_comment: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          location_id: string
          passed: boolean
          similarity_score: number | null
          source_type: string
          storage_path: string
          telegram_message_id: number | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          ai_call_id?: string | null
          ai_comment?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          location_id: string
          passed: boolean
          similarity_score?: number | null
          source_type: string
          storage_path: string
          telegram_message_id?: number | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          ai_call_id?: string | null
          ai_comment?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          location_id?: string
          passed?: boolean
          similarity_score?: number | null
          source_type?: string
          storage_path?: string
          telegram_message_id?: number | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_location_attempts_ai_call_id_fkey"
            columns: ["ai_call_id"]
            isOneToOne: false
            referencedRelation: "ai_call_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_location_attempts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "block_locations_to_recite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_location_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_quiz_attempts: {
        Row: {
          ai_call_id: string | null
          answers: Json
          block_id: number | null
          created_at: string
          exam_type: string | null
          id: string
          passed: boolean
          score_pct: number
          user_id: string
        }
        Insert: {
          ai_call_id?: string | null
          answers: Json
          block_id?: number | null
          created_at?: string
          exam_type?: string | null
          id?: string
          passed: boolean
          score_pct: number
          user_id: string
        }
        Update: {
          ai_call_id?: string | null
          answers?: Json
          block_id?: number | null
          created_at?: string
          exam_type?: string | null
          id?: string
          passed?: boolean
          score_pct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_quiz_attempts_ai_call_id_fkey"
            columns: ["ai_call_id"]
            isOneToOne: false
            referencedRelation: "ai_call_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_quiz_attempts_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_watch_progress: {
        Row: {
          block_resource_id: string
          completed_at: string | null
          created_at: string
          id: string
          max_watched_seconds: number
          total_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          block_resource_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          max_watched_seconds?: number
          total_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          block_resource_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          max_watched_seconds?: number
          total_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_progress_block_resource_id_fkey"
            columns: ["block_resource_id"]
            isOneToOne: false
            referencedRelation: "block_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_watch_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
        Insert: {
          block_id?: number | null
          created_at?: string | null
          id?: number
          lesson_id?: number | null
          memorized?: boolean | null
          order_num?: number | null
          reference?: string | null
          text_en?: string | null
          text_ru?: string | null
          user_id?: string | null
          verse_text?: string | null
        }
        Update: {
          block_id?: number | null
          created_at?: string | null
          id?: number
          lesson_id?: number | null
          memorized?: boolean | null
          order_num?: number | null
          reference?: string | null
          text_en?: string | null
          text_ru?: string | null
          user_id?: string | null
          verse_text?: string | null
        }
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
        Insert: {
          block_id?: number | null
          content?: string | null
          created_at?: string | null
          id?: number
          leader_feedback?: string | null
          lesson_id?: number | null
          submitted_at?: string | null
          submitted_to_leader?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          block_id?: number | null
          content?: string | null
          created_at?: string | null
          id?: number
          leader_feedback?: string | null
          lesson_id?: number | null
          submitted_at?: string | null
          submitted_to_leader?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      leader_materials: {
        Row: {
          access_role: string
          created_at: string
          description_ru: string | null
          duration_sec: number | null
          id: string
          kinescope_id: string
          order_num: number
          title_ru: string
          updated_at: string
        }
        Insert: {
          access_role?: string
          created_at?: string
          description_ru?: string | null
          duration_sec?: number | null
          id?: string
          kinescope_id: string
          order_num?: number
          title_ru: string
          updated_at?: string
        }
        Update: {
          access_role?: string
          created_at?: string
          description_ru?: string | null
          duration_sec?: number | null
          id?: string
          kinescope_id?: string
          order_num?: number
          title_ru?: string
          updated_at?: string
        }
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
        Insert: {
          block_id?: number | null
          content_en?: string | null
          content_ru?: string | null
          id?: number
          order_num?: number | null
          title_en?: string | null
          title_ru?: string | null
          verses?: Json | null
          youtube_url?: string | null
        }
        Update: {
          block_id?: number | null
          content_en?: string | null
          content_ru?: string | null
          id?: number
          order_num?: number | null
          title_en?: string | null
          title_ru?: string | null
          verses?: Json | null
          youtube_url?: string | null
        }
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
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          type?: string
          user_id?: string | null
        }
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
        Insert: {
          admin_approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          block_id?: number | null
          completed?: boolean | null
          completed_at?: string | null
          id?: number
          last_visited?: string | null
          lesson_id?: number | null
          rejection_count?: number | null
          user_id?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          block_id?: number | null
          completed?: boolean | null
          completed_at?: string | null
          id?: number
          last_visited?: string | null
          lesson_id?: number | null
          rejection_count?: number | null
          user_id?: string | null
        }
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
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: number
          journal_entry_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: number
          journal_entry_id?: number | null
          user_id?: string | null
        }
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
        Insert: {
          block_id?: number | null
          id?: number
          leader_feedback?: string | null
          leader_reviewed?: boolean | null
          submitted_at?: string | null
          summary?: string | null
          user_id?: string | null
          week_number?: number | null
        }
        Update: {
          block_id?: number | null
          id?: number
          leader_feedback?: string | null
          leader_reviewed?: boolean | null
          submitted_at?: string | null
          summary?: string | null
          user_id?: string | null
          week_number?: number | null
        }
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
