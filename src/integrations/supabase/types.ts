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
      access_credentials: {
        Row: {
          active: boolean
          credential_type: string
          external_reference: string
          id: string
          label: string | null
          member_id: string
          registered_at: string
          revoked_at: string | null
        }
        Insert: {
          active?: boolean
          credential_type: string
          external_reference: string
          id?: string
          label?: string | null
          member_id: string
          registered_at?: string
          revoked_at?: string | null
        }
        Update: {
          active?: boolean
          credential_type?: string
          external_reference?: string
          id?: string
          label?: string | null
          member_id?: string
          registered_at?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_credentials_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      access_devices: {
        Row: {
          active: boolean
          configuration: Json
          created_at: string
          device_type: string
          external_id: string | null
          id: string
          last_seen_at: string | null
          location: string | null
          name: string
          updated_at: string
          vendor: string
        }
        Insert: {
          active?: boolean
          configuration?: Json
          created_at?: string
          device_type: string
          external_id?: string | null
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name: string
          updated_at?: string
          vendor: string
        }
        Update: {
          active?: boolean
          configuration?: Json
          created_at?: string
          device_type?: string
          external_id?: string | null
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      access_events: {
        Row: {
          created_at: string
          credential_id: string | null
          decision: Database["public"]["Enums"]["access_decision"]
          device_id: string | null
          external_event_id: string
          id: string
          member_id: string | null
          occurred_at: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          decision: Database["public"]["Enums"]["access_decision"]
          device_id?: string | null
          external_event_id: string
          id?: string
          member_id?: string | null
          occurred_at: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          decision?: Database["public"]["Enums"]["access_decision"]
          device_id?: string | null
          external_event_id?: string
          id?: string
          member_id?: string | null
          occurred_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_events_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "access_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          checked_in_at: string
          created_at: string
          external_event_id: string | null
          id: string
          member_id: string
          recorded_by: string | null
          schedule_id: string | null
          source: string
        }
        Insert: {
          checked_in_at?: string
          created_at?: string
          external_event_id?: string | null
          id?: string
          member_id: string
          recorded_by?: string | null
          schedule_id?: string | null
          source?: string
        }
        Update: {
          checked_in_at?: string
          created_at?: string
          external_event_id?: string | null
          id?: string
          member_id?: string
          recorded_by?: string | null
          schedule_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
        }
        Relationships: []
      }
      class_bookings: {
        Row: {
          booked_at: string
          cancelled_at: string | null
          id: string
          member_id: string
          schedule_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booked_at?: string
          cancelled_at?: string | null
          id?: string
          member_id: string
          schedule_id: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booked_at?: string
          cancelled_at?: string | null
          id?: string
          member_id?: string
          schedule_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          cancellation_deadline_minutes: number
          capacity: number
          class_id: string
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          cancellation_deadline_minutes?: number
          capacity: number
          class_id: string
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_deadline_minutes?: number
          capacity?: number
          class_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_waitlists: {
        Row: {
          id: string
          joined_at: string
          member_id: string
          position: number
          promoted_at: string | null
          schedule_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          member_id: string
          position: number
          promoted_at?: string | null
          schedule_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          member_id?: string
          position?: number
          promoted_at?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_waitlists_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_waitlists_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_capacity: number
          description: string | null
          difficulty: string
          duration_minutes: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          default_capacity: number
          description?: string | null
          difficulty?: string
          duration_minutes: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_capacity?: number
          description?: string | null
          difficulty?: string
          duration_minutes?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_redemptions: number | null
          plan_id: string | null
          redemptions_count: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          max_redemptions?: number | null
          plan_id?: string | null
          redemptions_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_redemptions?: number | null
          plan_id?: string | null
          redemptions_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_settings: {
        Row: {
          address: string | null
          app_title: string
          booking_window_days: number
          color_theme: string
          contact_email: string | null
          contact_phone: string | null
          currency: string
          country_code: string
          default_cancellation_minutes: number
          gym_name: string
          id: string
          logo_url: string | null
          payment_gateway: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          app_title?: string
          booking_window_days?: number
          color_theme?: string
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          country_code?: string
          default_cancellation_minutes?: number
          gym_name?: string
          id?: string
          logo_url?: string | null
          payment_gateway?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          app_title?: string
          booking_window_days?: number
          color_theme?: string
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          country_code?: string
          default_cancellation_minutes?: number
          gym_name?: string
          id?: string
          logo_url?: string | null
          payment_gateway?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          id: string
          joined_on: string | null
          member_code: string
          notes: string | null
          profile_id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_on?: string | null
          member_code: string
          notes?: string | null
          profile_id: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_on?: string | null
          member_code?: string
          notes?: string | null
          profile_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          active: boolean
          benefits: string[]
          class_limit: number | null
          created_at: string
          description: string | null
          duration_days: number
          freeze_days: number
          id: string
          joining_fee_amount: number
          name: string
          price_amount: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: string[]
          class_limit?: number | null
          created_at?: string
          description?: string | null
          duration_days: number
          freeze_days?: number
          id?: string
          joining_fee_amount?: number
          name: string
          price_amount: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: string[]
          class_limit?: number | null
          created_at?: string
          description?: string | null
          duration_days?: number
          freeze_days?: number
          id?: string
          joining_fee_amount?: number
          name?: string
          price_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          auto_renew: boolean
          cancelled_at: string | null
          created_at: string
          ends_on: string
          frozen_from: string | null
          frozen_until: string | null
          id: string
          member_id: string
          plan_id: string
          starts_on: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          ends_on: string
          frozen_from?: string | null
          frozen_until?: string | null
          id?: string
          member_id: string
          plan_id: string
          starts_on: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          ends_on?: string
          frozen_from?: string | null
          frozen_until?: string | null
          id?: string
          member_id?: string
          plan_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          base_amount: number
          coupon_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          id: string
          member_id: string
          membership_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          plan_id: string | null
          provider_order_id: string | null
          provider_payment_id: string | null
          receipt_number: string | null
          refund_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          base_amount?: number
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          id?: string
          member_id: string
          membership_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          plan_id?: string | null
          provider_order_id?: string | null
          provider_payment_id?: string | null
          receipt_number?: string | null
          refund_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          id?: string
          member_id?: string
          membership_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          plan_id?: string | null
          provider_order_id?: string | null
          provider_payment_id?: string | null
          receipt_number?: string | null
          refund_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          fitness_goals: string | null
          gender: string | null
          has_illness: boolean | null
          id: string
          medical_notes: string | null
          onboarding_completed: boolean
          phone: string | null
          phone_verified_at: string | null
          preferences: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          fitness_goals?: string | null
          gender?: string | null
          has_illness?: boolean | null
          id: string
          medical_notes?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          preferences?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          fitness_goals?: string | null
          gender?: string | null
          has_illness?: boolean | null
          id?: string
          medical_notes?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      renewal_reminders: {
        Row: {
          channels: string[]
          days_before: number
          id: string
          membership_id: string
          sent_at: string
        }
        Insert: {
          channels?: string[]
          days_before: number
          id?: string
          membership_id: string
          sent_at?: string
        }
        Update: {
          channels?: string[]
          days_before?: number
          id?: string
          membership_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_reminders_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_assignments: {
        Row: {
          created_at: string
          id: string
          schedule_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          schedule_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          schedule_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_assignments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          active: boolean
          bio: string | null
          certifications: string[]
          created_at: string
          id: string
          profile_id: string
          specialties: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          certifications?: string[]
          created_at?: string
          id?: string
          profile_id: string
          specialties?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          certifications?: string[]
          created_at?: string
          id?: string
          profile_id?: string
          specialties?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          exercise_name: string
          id: string
          movement_standard: string | null
          prescription: string
          sequence: number
          workout_id: string
        }
        Insert: {
          exercise_name: string
          id?: string
          movement_standard?: string | null
          prescription: string
          sequence: number
          workout_id: string
        }
        Update: {
          exercise_name?: string
          id?: string
          movement_standard?: string | null
          prescription?: string
          sequence?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_results: {
        Row: {
          id: string
          member_id: string
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          rx: boolean
          score: string
          workout_id: string
        }
        Insert: {
          id?: string
          member_id: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          rx?: boolean
          score: string
          workout_id: string
        }
        Update: {
          id?: string
          member_id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          rx?: boolean
          score?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_results_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_results_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          published: boolean
          scaling_notes: string | null
          scoring_type: string
          stimulus: string | null
          time_cap_minutes: number | null
          title: string
          updated_at: string
          workout_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          published?: boolean
          scaling_notes?: string | null
          scoring_type?: string
          stimulus?: string | null
          time_cap_minutes?: number | null
          title: string
          updated_at?: string
          workout_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          published?: boolean
          scaling_notes?: string | null
          scoring_type?: string
          stimulus?: string | null
          time_cap_minutes?: number | null
          title?: string
          updated_at?: string
          workout_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_membership_payment: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_payment_id: string
          p_provider_payment_id: string
        }
        Returns: { completed: boolean; new_membership_id: string }[]
      }
      [_ in never]: never
    }
    Enums: {
      access_decision: "granted" | "denied"
      app_role: "admin" | "coach" | "member"
      booking_status: "booked" | "cancelled" | "attended" | "no_show"
      member_status: "active" | "inactive" | "frozen" | "expired" | "lead"
      membership_status:
        | "pending"
        | "active"
        | "frozen"
        | "expired"
        | "cancelled"
      payment_method:
        | "razorpay"
        | "stripe"
        | "cash"
        | "upi"
        | "bank_transfer"
        | "card_recorded"
      payment_status:
        | "created"
        | "pending"
        | "verified"
        | "failed"
        | "refunded"
        | "partially_refunded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_decision: ["granted", "denied"],
      app_role: ["admin", "coach", "member"],
      booking_status: ["booked", "cancelled", "attended", "no_show"],
      member_status: ["active", "inactive", "frozen", "expired", "lead"],
      membership_status: [
        "pending",
        "active",
        "frozen",
        "expired",
        "cancelled",
      ],
      payment_method: [
        "razorpay",
        "stripe",
        "cash",
        "upi",
        "bank_transfer",
        "card_recorded",
      ],
      payment_status: [
        "created",
        "pending",
        "verified",
        "failed",
        "refunded",
        "partially_refunded",
      ],
    },
  },
} as const
