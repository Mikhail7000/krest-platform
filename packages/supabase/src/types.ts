export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          approved_city_id: number | null
          approved_role: string | null
          created_at: string
          decided_at: string | null
          decided_by: number | null
          first_name: string | null
          id: string
          last_name: string | null
          status: string
          telegram_chat_id: number
          username: string | null
        }
        Insert: {
          approved_city_id?: number | null
          approved_role?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: string
          telegram_chat_id: number
          username?: string | null
        }
        Update: {
          approved_city_id?: number | null
          approved_role?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: string
          telegram_chat_id?: number
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_approved_city_id_fkey"
            columns: ["approved_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
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
        Relationships: [
          {
            foreignKeyName: "bible_verses_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_user_id_fkey"
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
          max_record_seconds: number
          order_index: number
          practice_mode: string | null
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
          max_record_seconds?: number
          order_index?: number
          practice_mode?: string | null
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
          max_record_seconds?: number
          order_index?: number
          practice_mode?: string | null
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
      bot_pending_action: {
        Row: {
          action: string
          created_at: string
          telegram_chat_id: number
        }
        Insert: {
          action: string
          created_at?: string
          telegram_chat_id: number
        }
        Update: {
          action?: string
          created_at?: string
          telegram_chat_id?: number
        }
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
      community_posts: {
        Row: {
          author_id: string
          content_text: string | null
          created_at: string
          deleted_by: string | null
          id: string
          is_deleted: boolean
          kind: string
          storage_path: string | null
        }
        Insert: {
          author_id: string
          content_text?: string | null
          created_at?: string
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          kind: string
          storage_path?: string | null
        }
        Update: {
          author_id?: string
          content_text?: string | null
          created_at?: string
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          kind?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      curator_notify_state: {
        Row: {
          created_at: string
          event_key: string
          event_type: string
          id: number
          student_id: string
        }
        Insert: {
          created_at?: string
          event_key?: string
          event_type: string
          id?: never
          student_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          event_type?: string
          id?: never
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curator_notify_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "journal_entries_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "lessons_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "notifications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      placeholder_bible_verses: {
        Row: {
          book: string
          chapter: number
          created_at: string | null
          id: number
          reference: string
          testament: string
          text: string
          translation: string
          verse_end: number | null
          verse_start: number
        }
        Insert: {
          book: string
          chapter: number
          created_at?: string | null
          id?: number
          reference: string
          testament: string
          text: string
          translation?: string
          verse_end?: number | null
          verse_start: number
        }
        Update: {
          book?: string
          chapter?: number
          created_at?: string | null
          id?: number
          reference?: string
          testament?: string
          text?: string
          translation?: string
          verse_end?: number | null
          verse_start?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          can_skip_block_lock: boolean
          city_id: number | null
          contact_info: string | null
          country_id: number | null
          course_started_at: string | null
          created_at: string | null
          curator_id: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          hidden_from_tracking: boolean
          id: string
          interests: string | null
          is_protected: boolean | null
          is_whitelisted: boolean
          lang: string | null
          latitude: number | null
          leaderboard_bg_path: string | null
          location_name: string | null
          longitude: number | null
          onboarding_done: boolean | null
          referral_detail: string | null
          referral_source: string | null
          role: string | null
          telegram_chat_id: number | null
          test_daily_accel: boolean
          theme_pref: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          can_skip_block_lock?: boolean
          city_id?: number | null
          contact_info?: string | null
          country_id?: number | null
          course_started_at?: string | null
          created_at?: string | null
          curator_id?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          hidden_from_tracking?: boolean
          id: string
          interests?: string | null
          is_protected?: boolean | null
          is_whitelisted?: boolean
          lang?: string | null
          latitude?: number | null
          leaderboard_bg_path?: string | null
          location_name?: string | null
          longitude?: number | null
          onboarding_done?: boolean | null
          referral_detail?: string | null
          referral_source?: string | null
          role?: string | null
          telegram_chat_id?: number | null
          test_daily_accel?: boolean
          theme_pref?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          can_skip_block_lock?: boolean
          city_id?: number | null
          contact_info?: string | null
          country_id?: number | null
          course_started_at?: string | null
          created_at?: string | null
          curator_id?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          hidden_from_tracking?: boolean
          id?: string
          interests?: string | null
          is_protected?: boolean | null
          is_whitelisted?: boolean
          lang?: string | null
          latitude?: number | null
          leaderboard_bg_path?: string | null
          location_name?: string | null
          longitude?: number | null
          onboarding_done?: boolean | null
          referral_detail?: string | null
          referral_source?: string | null
          role?: string | null
          telegram_chat_id?: number | null
          test_daily_accel?: boolean
          theme_pref?: string | null
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
      student_block_daily_cross: {
        Row: {
          block_id: number
          created_at: string
          id: string
          storage_path: string
          submitted_date: string
          user_id: string
        }
        Insert: {
          block_id: number
          created_at?: string
          id?: string
          storage_path: string
          submitted_date: string
          user_id: string
        }
        Update: {
          block_id?: number
          created_at?: string
          id?: string
          storage_path?: string
          submitted_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_daily_cross_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_daily_cross_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_daily_prayer: {
        Row: {
          block_id: number
          created_at: string
          id: string
          prayed_date: string
          user_id: string
        }
        Insert: {
          block_id: number
          created_at?: string
          id?: string
          prayed_date: string
          user_id: string
        }
        Update: {
          block_id?: number
          created_at?: string
          id?: string
          prayed_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_daily_prayer_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_daily_prayer_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_daily_trainer: {
        Row: {
          block_id: number
          created_at: string
          id: string
          trained_date: string
          user_id: string
        }
        Insert: {
          block_id: number
          created_at?: string
          id?: string
          trained_date: string
          user_id: string
        }
        Update: {
          block_id?: number
          created_at?: string
          id?: string
          trained_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_daily_trainer_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_emotions: {
        Row: {
          block_id: number
          content_text: string | null
          created_at: string
          id: string
          kind: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          block_id: number
          content_text?: string | null
          created_at?: string
          id?: string
          kind: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          block_id?: number
          content_text?: string | null
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_emotions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_emotions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_friday_practice: {
        Row: {
          block_id: number
          created_at: string
          id: string
          impressions: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id: number
          created_at?: string
          id?: string
          impressions: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_id?: number
          created_at?: string
          id?: string
          impressions?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_friday_practice_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_friday_practice_user_id_fkey"
            columns: ["user_id"]
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
          block_passed_at: string | null
          block_unlocked_at: string | null
          created_at: string
          daily_cross_count: number
          id: string
          last_quiz_score_pct: number | null
          locations_attempts: number
          locations_audio_completed_at: string | null
          locations_locked_until: string | null
          locations_passed_at: string | null
          locations_video_completed_at: string | null
          quiz_attempts: number
          quiz_locked_until: string | null
          quiz_passed_at: string | null
          recitation_audio_passed_at: string | null
          recitation_videos_passed_at: string | null
          status: string
          summary_acknowledged_at: string | null
          trainer_passed_at: string | null
          updated_at: string
          user_id: string
          videos_completed_at: string | null
        }
        Insert: {
          block_completed_at?: string | null
          block_id: number
          block_passed_at?: string | null
          block_unlocked_at?: string | null
          created_at?: string
          daily_cross_count?: number
          id?: string
          last_quiz_score_pct?: number | null
          locations_attempts?: number
          locations_audio_completed_at?: string | null
          locations_locked_until?: string | null
          locations_passed_at?: string | null
          locations_video_completed_at?: string | null
          quiz_attempts?: number
          quiz_locked_until?: string | null
          quiz_passed_at?: string | null
          recitation_audio_passed_at?: string | null
          recitation_videos_passed_at?: string | null
          status?: string
          summary_acknowledged_at?: string | null
          trainer_passed_at?: string | null
          updated_at?: string
          user_id: string
          videos_completed_at?: string | null
        }
        Update: {
          block_completed_at?: string | null
          block_id?: number
          block_passed_at?: string | null
          block_unlocked_at?: string | null
          created_at?: string
          daily_cross_count?: number
          id?: string
          last_quiz_score_pct?: number | null
          locations_attempts?: number
          locations_audio_completed_at?: string | null
          locations_locked_until?: string | null
          locations_passed_at?: string | null
          locations_video_completed_at?: string | null
          quiz_attempts?: number
          quiz_locked_until?: string | null
          quiz_passed_at?: string | null
          recitation_audio_passed_at?: string | null
          recitation_videos_passed_at?: string | null
          status?: string
          summary_acknowledged_at?: string | null
          trainer_passed_at?: string | null
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
      student_block_recitations: {
        Row: {
          ai_call_id: string | null
          ai_comment: string | null
          ai_score: number | null
          block_id: number
          created_at: string
          duration_seconds: number | null
          effective_date: string | null
          id: string
          medium: string
          passed: boolean
          storage_path: string
          transcript: string | null
          user_id: string
        }
        Insert: {
          ai_call_id?: string | null
          ai_comment?: string | null
          ai_score?: number | null
          block_id: number
          created_at?: string
          duration_seconds?: number | null
          effective_date?: string | null
          id?: string
          medium: string
          passed: boolean
          storage_path: string
          transcript?: string | null
          user_id: string
        }
        Update: {
          ai_call_id?: string | null
          ai_comment?: string | null
          ai_score?: number | null
          block_id?: number
          created_at?: string
          duration_seconds?: number | null
          effective_date?: string | null
          id?: string
          medium?: string
          passed?: boolean
          storage_path?: string
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_recitations_ai_call_id_fkey"
            columns: ["ai_call_id"]
            isOneToOne: false
            referencedRelation: "ai_call_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_recitations_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_recitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_daily_activity: {
        Row: {
          activity_date: string
          opened: boolean
          opened_at: string | null
          reminded_18: boolean
          reminded_20: boolean
          reminded_21: boolean
          reminded_evening: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date: string
          opened?: boolean
          opened_at?: string | null
          reminded_18?: boolean
          reminded_20?: boolean
          reminded_21?: boolean
          reminded_evening?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          opened?: boolean
          opened_at?: string | null
          reminded_18?: boolean
          reminded_20?: boolean
          reminded_21?: boolean
          reminded_evening?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_daily_activity_user_id_fkey"
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
          effective_date: string | null
          file_size_bytes: number | null
          id: string
          location_id: string
          medium: string
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
          effective_date?: string | null
          file_size_bytes?: number | null
          id?: string
          location_id: string
          medium?: string
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
          effective_date?: string | null
          file_size_bytes?: number | null
          id?: string
          location_id?: string
          medium?: string
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
        Relationships: [
          {
            foreignKeyName: "student_progress_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_user_id_fkey"
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
      support_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string
          status: string
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          status?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          status?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      testing_whitelist: {
        Row: {
          added_at: string | null
          added_by: string
          assign_role: string | null
          assigned_city_id: number | null
          assigned_curator_id: string | null
          claimed_chat_id: number | null
          display_name: string | null
          hidden: boolean
          id: number
          telegram_username: string
          updated_at: string | null
        }
        Insert: {
          added_at?: string | null
          added_by: string
          assign_role?: string | null
          assigned_city_id?: number | null
          assigned_curator_id?: string | null
          claimed_chat_id?: number | null
          display_name?: string | null
          hidden?: boolean
          id?: number
          telegram_username: string
          updated_at?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string
          assign_role?: string | null
          assigned_city_id?: number | null
          assigned_curator_id?: string | null
          claimed_chat_id?: number | null
          display_name?: string | null
          hidden?: boolean
          id?: number
          telegram_username?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testing_whitelist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testing_whitelist_assigned_curator_id_fkey"
            columns: ["assigned_curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "uploads_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_user_id_fkey"
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
      view_as_log: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          target_id: string
          target_role: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          target_id: string
          target_role?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          target_id?: string
          target_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_as_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_as_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "weekly_submissions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      closed_dates_all: {
        Args: never
        Returns: {
          d: string
          user_id: string
        }[]
      }
      get_leader_chat_id: { Args: { student_id: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_block_unlocked: {
        Args: { p_block_id: number; p_user_id: string }
        Returns: boolean
      }
      is_day_closed: {
        Args: { p_d: string; p_user_id: string }
        Returns: boolean
      }
      is_visible_to: {
        Args: { target_id: string; viewer_id: string }
        Returns: boolean
      }
      locations_complete: {
        Args: { p_block_id: number; p_user_id: string }
        Returns: boolean
      }
      passed_blocks_all: {
        Args: never
        Returns: {
          blocks_passed: number
          user_id: string
        }[]
      }
      student_days: {
        Args: { p_user_ids: string[] }
        Returns: {
          closed: boolean
          cross_done: boolean
          d: string
          loc_done: boolean
          opened: boolean
          prayer_done: boolean
          quiz_done: boolean
          recit_done: boolean
          user_id: string
        }[]
      }
      user_closed_days: {
        Args: { p_user_id: string }
        Returns: {
          block_id: number
          days: number
        }[]
      }
      user_max_closed_date: { Args: { p_user_id: string }; Returns: string }
      user_practice_day_counts: {
        Args: { p_user_id: string }
        Returns: {
          block_id: number
          cross_days: number
          loc_days: number
          loc_required: boolean
          prayer_days: number
          recv_days: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
