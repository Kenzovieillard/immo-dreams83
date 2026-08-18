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
      activities: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          user_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          user_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          period_end: string
          period_start: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          period_end: string
          period_start: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          source?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          additional_comments: string | null
          appointment_type: string
          assigned_to: string | null
          blocking_points: string[]
          buyer_feedback: string | null
          comment: string | null
          contact_id: string | null
          created_at: string
          ends_at: string | null
          general_impression: string | null
          id: string
          interest_level: number | null
          lead_id: string | null
          location: string | null
          next_action: string | null
          outcome: string | null
          positive_points: string[]
          property_id: string | null
          report_next_action: string | null
          report_submitted_at: string | null
          satisfaction_rating: number | null
          seller_feedback: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          visit_status: string
        }
        Insert: {
          additional_comments?: string | null
          appointment_type?: string
          assigned_to?: string | null
          blocking_points?: string[]
          buyer_feedback?: string | null
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          ends_at?: string | null
          general_impression?: string | null
          id?: string
          interest_level?: number | null
          lead_id?: string | null
          location?: string | null
          next_action?: string | null
          outcome?: string | null
          positive_points?: string[]
          property_id?: string | null
          report_next_action?: string | null
          report_submitted_at?: string | null
          satisfaction_rating?: number | null
          seller_feedback?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          visit_status?: string
        }
        Update: {
          additional_comments?: string | null
          appointment_type?: string
          assigned_to?: string | null
          blocking_points?: string[]
          buyer_feedback?: string | null
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          ends_at?: string | null
          general_impression?: string | null
          id?: string
          interest_level?: number | null
          lead_id?: string | null
          location?: string | null
          next_action?: string | null
          outcome?: string | null
          positive_points?: string[]
          property_id?: string | null
          report_next_action?: string | null
          report_submitted_at?: string | null
          satisfaction_rating?: number | null
          seller_feedback?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          visit_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["admin_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_searches: {
        Row: {
          assigned_to: string | null
          cities: string[]
          contact_id: string | null
          created_at: string
          id: string
          max_budget: number | null
          min_rooms: number | null
          min_surface: number | null
          property_types: string[]
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cities?: string[]
          contact_id?: string | null
          created_at?: string
          id?: string
          max_budget?: number | null
          min_rooms?: number | null
          min_surface?: number | null
          property_types?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cities?: string[]
          contact_id?: string | null
          created_at?: string
          id?: string
          max_budget?: number | null
          min_rooms?: number | null
          min_surface?: number | null
          property_types?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_searches_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_searches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string | null
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          lead_id: string | null
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          lead_id?: string | null
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          lead_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          active_prospect: boolean
          address: string | null
          archived: boolean
          assigned_to: string | null
          canonical_contact_id: string | null
          city: string | null
          contact_preference: string | null
          contact_role: string
          contact_source: string
          created_at: string
          current_residence: string | null
          dedupe_status: string
          email: string
          estimated_budget: number | null
          id: string
          interest_score: number | null
          last_contacted_at: string | null
          message: string
          name: string
          normalized_email: string | null
          normalized_phone: string | null
          notes: string | null
          personal_situation: string | null
          phone: string | null
          pipeline_lead_id: string | null
          postal_code: string | null
          priority: string
          profession: string | null
          qualification_source: string
          qualification_status: string
          qualified_at: string | null
          qualified_by: string | null
          request_type: string
          status: string
          updated_at: string
        }
        Insert: {
          active_prospect?: boolean
          address?: string | null
          archived?: boolean
          assigned_to?: string | null
          canonical_contact_id?: string | null
          city?: string | null
          contact_preference?: string | null
          contact_role?: string
          contact_source?: string
          created_at?: string
          current_residence?: string | null
          dedupe_status?: string
          email: string
          estimated_budget?: number | null
          id?: string
          interest_score?: number | null
          last_contacted_at?: string | null
          message: string
          name: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          personal_situation?: string | null
          phone?: string | null
          pipeline_lead_id?: string | null
          postal_code?: string | null
          priority?: string
          profession?: string | null
          qualification_source?: string
          qualification_status?: string
          qualified_at?: string | null
          qualified_by?: string | null
          request_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          active_prospect?: boolean
          address?: string | null
          archived?: boolean
          assigned_to?: string | null
          canonical_contact_id?: string | null
          city?: string | null
          contact_preference?: string | null
          contact_role?: string
          contact_source?: string
          created_at?: string
          current_residence?: string | null
          dedupe_status?: string
          email?: string
          estimated_budget?: number | null
          id?: string
          interest_score?: number | null
          last_contacted_at?: string | null
          message?: string
          name?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          personal_situation?: string | null
          phone?: string | null
          pipeline_lead_id?: string | null
          postal_code?: string | null
          priority?: string
          profession?: string | null
          qualification_source?: string
          qualification_status?: string
          qualified_at?: string | null
          qualified_by?: string | null
          request_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_canonical_contact_id_fkey"
            columns: ["canonical_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_qualified_by_fkey"
            columns: ["qualified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_onboarding_progress: {
        Row: {
          appointment_completed: boolean
          completed_at: string | null
          contacts_completed: boolean
          pipeline_completed: boolean
          profile_completed: boolean
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_completed?: boolean
          completed_at?: string | null
          contacts_completed?: boolean
          pipeline_completed?: boolean
          profile_completed?: boolean
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_completed?: boolean
          completed_at?: string | null
          contacts_completed?: boolean
          pipeline_completed?: boolean
          profile_completed?: boolean
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_onboarding_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          provider: string
          provider_message_id: string | null
          recipient: string
          status: string
          subject: string
          template_key: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          provider: string
          provider_message_id?: string | null
          recipient: string
          status?: string
          subject: string
          template_key?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient?: string
          status?: string
          subject?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      estimations: {
        Row: {
          appointment_at: string | null
          appointment_location: string | null
          archived: boolean
          assigned_to: string | null
          city: string
          commercial_reference: string | null
          commercial_status: string
          construction_year: number | null
          contact_id: string | null
          converted_property_id: string | null
          converted_to_property: boolean
          created_at: string
          duration_minutes: number
          email: string
          estimate_high: number | null
          estimate_low: number | null
          estimated_value: number | null
          id: string
          listing_price: number | null
          market_comparables: Json
          message: string | null
          name: string
          notes: string | null
          phone: string
          postal_code: string | null
          property_address: string | null
          property_condition: string | null
          property_type: string
          report_generated_at: string | null
          report_storage_path: string | null
          requested_at: string
          rooms: number | null
          selected_mandate_type: string | null
          status: string
          surface: number
          time_slot: string | null
          updated_at: string
        }
        Insert: {
          appointment_at?: string | null
          appointment_location?: string | null
          archived?: boolean
          assigned_to?: string | null
          city: string
          commercial_reference?: string | null
          commercial_status?: string
          construction_year?: number | null
          contact_id?: string | null
          converted_property_id?: string | null
          converted_to_property?: boolean
          created_at?: string
          duration_minutes?: number
          email: string
          estimate_high?: number | null
          estimate_low?: number | null
          estimated_value?: number | null
          id?: string
          listing_price?: number | null
          market_comparables?: Json
          message?: string | null
          name: string
          notes?: string | null
          phone: string
          postal_code?: string | null
          property_address?: string | null
          property_condition?: string | null
          property_type: string
          report_generated_at?: string | null
          report_storage_path?: string | null
          requested_at?: string
          rooms?: number | null
          selected_mandate_type?: string | null
          status?: string
          surface: number
          time_slot?: string | null
          updated_at?: string
        }
        Update: {
          appointment_at?: string | null
          appointment_location?: string | null
          archived?: boolean
          assigned_to?: string | null
          city?: string
          commercial_reference?: string | null
          commercial_status?: string
          construction_year?: number | null
          contact_id?: string | null
          converted_property_id?: string | null
          converted_to_property?: boolean
          created_at?: string
          duration_minutes?: number
          email?: string
          estimate_high?: number | null
          estimate_low?: number | null
          estimated_value?: number | null
          id?: string
          listing_price?: number | null
          market_comparables?: Json
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string
          postal_code?: string | null
          property_address?: string | null
          property_condition?: string | null
          property_type?: string
          report_generated_at?: string | null
          report_storage_path?: string | null
          requested_at?: string
          rooms?: number | null
          selected_mandate_type?: string | null
          status?: string
          surface?: number
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimations_converted_property_id_fkey"
            columns: ["converted_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimations_converted_property_id_fkey"
            columns: ["converted_property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_runs: {
        Row: {
          ambiguous: number
          contacts_read: number
          created_at: string
          created_by: string | null
          estimations_read: number
          id: string
          match_certain: number
          match_probable: number
          mode: string
          no_match: number
          report: Json
          source: string
          writes_performed: boolean
        }
        Insert: {
          ambiguous?: number
          contacts_read?: number
          created_at?: string
          created_by?: string | null
          estimations_read?: number
          id?: string
          match_certain?: number
          match_probable?: number
          mode?: string
          no_match?: number
          report?: Json
          source?: string
          writes_performed?: boolean
        }
        Update: {
          ambiguous?: number
          contacts_read?: number
          created_at?: string
          created_by?: string | null
          estimations_read?: number
          id?: string
          match_certain?: number
          match_probable?: number
          mode?: string
          no_match?: number
          report?: Json
          source?: string
          writes_performed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_merge_logs: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          match_category: string
          matched_keys: Json
          merged_contact_id: string | null
          next_payload: Json | null
          note: string | null
          previous_payload: Json | null
          primary_contact_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          match_category: string
          matched_keys?: Json
          merged_contact_id?: string | null
          next_payload?: Json | null
          note?: string | null
          previous_payload?: Json | null
          primary_contact_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          match_category?: string
          matched_keys?: Json
          merged_contact_id?: string | null
          next_payload?: Json | null
          note?: string | null
          previous_payload?: Json | null
          primary_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_merge_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_merge_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_merge_logs_merged_contact_id_fkey"
            columns: ["merged_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_merge_logs_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      lead_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          lead_id: string | null
          next_status: string
          previous_status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          next_status: string
          previous_status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          next_status?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean
          assigned_to: string | null
          blocking_reason: string | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          commercial_alert: string | null
          contact_id: string | null
          created_at: string
          dedupe_status: string
          desired_rooms: number | null
          desired_surface: number | null
          dossier_reference: string | null
          estimated_budget: number | null
          estimation_id: string | null
          expected_signature_date: string | null
          financing_approved: boolean
          id: string
          is_blocked: boolean
          lead_type: string
          linked_property_id: string | null
          notes: string | null
          pipeline_stage: string | null
          pipeline_type: string
          postal_code: string | null
          priority: string
          project_type: string | null
          property_type: string | null
          request_type: string | null
          source: string
          source_code: string | null
          source_id: string | null
          source_payload: Json
          source_table: string | null
          stage_entered_at: string
          status: string
          title: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          archived?: boolean
          assigned_to?: string | null
          blocking_reason?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          commercial_alert?: string | null
          contact_id?: string | null
          created_at?: string
          dedupe_status?: string
          desired_rooms?: number | null
          desired_surface?: number | null
          dossier_reference?: string | null
          estimated_budget?: number | null
          estimation_id?: string | null
          expected_signature_date?: string | null
          financing_approved?: boolean
          id?: string
          is_blocked?: boolean
          lead_type?: string
          linked_property_id?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          pipeline_type?: string
          postal_code?: string | null
          priority?: string
          project_type?: string | null
          property_type?: string | null
          request_type?: string | null
          source?: string
          source_code?: string | null
          source_id?: string | null
          source_payload?: Json
          source_table?: string | null
          stage_entered_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          archived?: boolean
          assigned_to?: string | null
          blocking_reason?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          commercial_alert?: string | null
          contact_id?: string | null
          created_at?: string
          dedupe_status?: string
          desired_rooms?: number | null
          desired_surface?: number | null
          dossier_reference?: string | null
          estimated_budget?: number | null
          estimation_id?: string | null
          expected_signature_date?: string | null
          financing_approved?: boolean
          id?: string
          is_blocked?: boolean
          lead_type?: string
          linked_property_id?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          pipeline_type?: string
          postal_code?: string | null
          priority?: string
          project_type?: string | null
          property_type?: string | null
          request_type?: string | null
          source?: string
          source_code?: string | null
          source_id?: string | null
          source_payload?: Json
          source_table?: string | null
          stage_entered_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_estimation_id_fkey"
            columns: ["estimation_id"]
            isOneToOne: false
            referencedRelation: "estimations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_linked_property_id_fkey"
            columns: ["linked_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_linked_property_id_fkey"
            columns: ["linked_property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
        ]
      }
      mandates: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          lead_id: string | null
          mandate_number: string
          mandate_type: string
          property_id: string | null
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          lead_id?: string | null
          mandate_number: string
          mandate_type?: string
          property_id?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          lead_id?: string | null
          mandate_number?: string
          mandate_type?: string
          property_id?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      match_suggestions: {
        Row: {
          buyer_search_id: string | null
          created_at: string
          id: string
          property_id: string | null
          reasons: Json
          score: number
          status: string
        }
        Insert: {
          buyer_search_id?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          reasons?: Json
          score?: number
          status?: string
        }
        Update: {
          buyer_search_id?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          reasons?: Json
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_suggestions_buyer_search_id_fkey"
            columns: ["buyer_search_id"]
            isOneToOne: false
            referencedRelation: "buyer_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_alert_events: {
        Row: {
          alert_date: string
          alert_type: string
          created_at: string
          id: string
          negotiation_id: string
          read_at: string | null
          recipient_user_id: string
        }
        Insert: {
          alert_date?: string
          alert_type: string
          created_at?: string
          id?: string
          negotiation_id: string
          read_at?: string | null
          recipient_user_id: string
        }
        Update: {
          alert_date?: string
          alert_type?: string
          created_at?: string
          id?: string
          negotiation_id?: string
          read_at?: string | null
          recipient_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_alert_events_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_alert_events_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "v_negotiation_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_alert_events_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_documents: {
        Row: {
          confidentiality: string
          created_at: string
          document_status: string
          document_type: string | null
          file_name: string
          id: string
          mime_type: string | null
          negotiation_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          confidentiality?: string
          created_at?: string
          document_status?: string
          document_type?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          negotiation_id: string
          storage_bucket?: string
          storage_path: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          confidentiality?: string
          created_at?: string
          document_status?: string
          document_type?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          negotiation_id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_documents_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_documents_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "v_negotiation_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_exchanges: {
        Row: {
          amount: number | null
          author_id: string | null
          author_name: string | null
          comment: string | null
          created_at: string
          exchange_type: string
          id: string
          is_internal_note: boolean
          negotiation_id: string
        }
        Insert: {
          amount?: number | null
          author_id?: string | null
          author_name?: string | null
          comment?: string | null
          created_at?: string
          exchange_type: string
          id?: string
          is_internal_note?: boolean
          negotiation_id: string
        }
        Update: {
          amount?: number | null
          author_id?: string | null
          author_name?: string | null
          comment?: string | null
          created_at?: string
          exchange_type?: string
          id?: string
          is_internal_note?: boolean
          negotiation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_exchanges_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_exchanges_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_exchanges_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "v_negotiation_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_steps: {
        Row: {
          amount: number | null
          author_role: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          label: string
          negotiation_id: string
          step_number: number
          step_status: string
        }
        Insert: {
          amount?: number | null
          author_role?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          label: string
          negotiation_id: string
          step_number: number
          step_status?: string
        }
        Update: {
          amount?: number | null
          author_role?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          label?: string
          negotiation_id?: string
          step_number?: number
          step_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_steps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_steps_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_steps_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "v_negotiation_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiations: {
        Row: {
          asking_price: number
          buyer_contact_id: string
          concluded_at: string | null
          created_at: string
          current_amount: number
          current_gap_percent: number | null
          current_step: number
          days_without_activity: number
          final_amount: number | null
          id: string
          initial_amount: number
          internal_notes: string | null
          is_urgent: boolean
          last_activity_at: string
          offer_id: string
          property_id: string
          response_deadline: string | null
          responsible_user_id: string
          seller_contact_id: string | null
          status: string
          total_steps: number
          updated_at: string
        }
        Insert: {
          asking_price: number
          buyer_contact_id: string
          concluded_at?: string | null
          created_at?: string
          current_amount: number
          current_gap_percent?: number | null
          current_step?: number
          days_without_activity?: number
          final_amount?: number | null
          id?: string
          initial_amount: number
          internal_notes?: string | null
          is_urgent?: boolean
          last_activity_at?: string
          offer_id: string
          property_id: string
          response_deadline?: string | null
          responsible_user_id: string
          seller_contact_id?: string | null
          status?: string
          total_steps?: number
          updated_at?: string
        }
        Update: {
          asking_price?: number
          buyer_contact_id?: string
          concluded_at?: string | null
          created_at?: string
          current_amount?: number
          current_gap_percent?: number | null
          current_step?: number
          days_without_activity?: number
          final_amount?: number | null
          id?: string
          initial_amount?: number
          internal_notes?: string | null
          is_urgent?: boolean
          last_activity_at?: string
          offer_id?: string
          property_id?: string
          response_deadline?: string | null
          responsible_user_id?: string
          seller_contact_id?: string | null
          status?: string
          total_steps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_buyer_contact_id_fkey"
            columns: ["buyer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_seller_contact_id_fkey"
            columns: ["seller_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_documents: {
        Row: {
          confidentiality: string
          created_at: string
          document_status: string
          document_type: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          offer_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          confidentiality?: string
          created_at?: string
          document_status?: string
          document_type?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          offer_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          confidentiality?: string
          created_at?: string
          document_status?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          offer_id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_documents_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_exchanges: {
        Row: {
          amount: number | null
          author_id: string | null
          author_name: string | null
          comment: string | null
          created_at: string
          exchange_type: string
          id: string
          offer_id: string
        }
        Insert: {
          amount?: number | null
          author_id?: string | null
          author_name?: string | null
          comment?: string | null
          created_at?: string
          exchange_type: string
          id?: string
          offer_id: string
        }
        Update: {
          amount?: number | null
          author_id?: string | null
          author_name?: string | null
          comment?: string | null
          created_at?: string
          exchange_type?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_exchanges_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_exchanges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_negotiation_steps: {
        Row: {
          amount: number | null
          author_role: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          offer_id: string
          step_number: number
          step_status: string
        }
        Insert: {
          amount?: number | null
          author_role?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          offer_id: string
          step_number: number
          step_status?: string
        }
        Update: {
          amount?: number | null
          author_role?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          offer_id?: string
          step_number?: number
          step_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_negotiation_steps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_negotiation_steps_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json
          next_status: string
          offer_id: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          next_status: string
          offer_id: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          next_status?: string
          offer_id?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_status_history_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          amount: number | null
          asking_price: number | null
          assigned_to: string | null
          buyer_contact_id: string | null
          buyer_dossier_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          created_from_visit_id: string | null
          down_payment_amount: number | null
          estimated_interest_rate: number | null
          expires_at: string | null
          financing_type: string
          id: string
          included_furniture: string | null
          is_test: boolean
          lead_id: string | null
          loan_amount: number | null
          loan_duration_years: number | null
          negotiation_comment: string | null
          next_action: string | null
          next_action_due_at: string | null
          notes: string | null
          offer_date: string | null
          offered_at: string | null
          property_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          responsible_user_id: string | null
          signed_document_id: string | null
          status: string
          submitted_to_seller_at: string | null
          suspensive_conditions: string | null
          updated_at: string
          valid_until: string | null
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount?: number | null
          asking_price?: number | null
          assigned_to?: string | null
          buyer_contact_id?: string | null
          buyer_dossier_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          created_from_visit_id?: string | null
          down_payment_amount?: number | null
          estimated_interest_rate?: number | null
          expires_at?: string | null
          financing_type?: string
          id?: string
          included_furniture?: string | null
          is_test?: boolean
          lead_id?: string | null
          loan_amount?: number | null
          loan_duration_years?: number | null
          negotiation_comment?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          offer_date?: string | null
          offered_at?: string | null
          property_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          responsible_user_id?: string | null
          signed_document_id?: string | null
          status?: string
          submitted_to_seller_at?: string | null
          suspensive_conditions?: string | null
          updated_at?: string
          valid_until?: string | null
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number | null
          asking_price?: number | null
          assigned_to?: string | null
          buyer_contact_id?: string | null
          buyer_dossier_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          created_from_visit_id?: string | null
          down_payment_amount?: number | null
          estimated_interest_rate?: number | null
          expires_at?: string | null
          financing_type?: string
          id?: string
          included_furniture?: string | null
          is_test?: boolean
          lead_id?: string | null
          loan_amount?: number | null
          loan_duration_years?: number | null
          negotiation_comment?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          offer_date?: string | null
          offered_at?: string | null
          property_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          responsible_user_id?: string | null
          signed_document_id?: string | null
          status?: string
          submitted_to_seller_at?: string | null
          suspensive_conditions?: string | null
          updated_at?: string
          valid_until?: string | null
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_buyer_contact_id_fkey"
            columns: ["buyer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_buyer_dossier_id_fkey"
            columns: ["buyer_dossier_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_created_from_visit_id_fkey"
            columns: ["created_from_visit_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_export_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json
          portal_export_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json
          portal_export_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json
          portal_export_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_export_logs_portal_export_id_fkey"
            columns: ["portal_export_id"]
            isOneToOne: false
            referencedRelation: "portal_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_exports: {
        Row: {
          created_at: string
          created_by: string | null
          export_type: string
          id: string
          payload: Json
          portal_name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          export_type?: string
          id?: string
          payload?: Json
          portal_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          export_type?: string
          id?: string
          payload?: Json
          portal_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          climate_class: string | null
          commercial_status: string | null
          created_at: string
          created_by: string | null
          description_long: string | null
          description_short: string | null
          energy_class: string | null
          featured: boolean
          features: Json
          fees_included: boolean
          id: string
          land_surface: number | null
          mandate_number: string | null
          photos: Json
          postal_code: string
          price: number
          publication_status: string
          published_at: string | null
          reference: string
          rooms: number | null
          slug: string
          source_url: string | null
          status: string
          surface: number
          title: string
          transaction_type: string
          type: string
          unpublished_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          climate_class?: string | null
          commercial_status?: string | null
          created_at?: string
          created_by?: string | null
          description_long?: string | null
          description_short?: string | null
          energy_class?: string | null
          featured?: boolean
          features?: Json
          fees_included?: boolean
          id?: string
          land_surface?: number | null
          mandate_number?: string | null
          photos?: Json
          postal_code: string
          price: number
          publication_status?: string
          published_at?: string | null
          reference: string
          rooms?: number | null
          slug: string
          source_url?: string | null
          status: string
          surface: number
          title: string
          transaction_type?: string
          type: string
          unpublished_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          climate_class?: string | null
          commercial_status?: string | null
          created_at?: string
          created_by?: string | null
          description_long?: string | null
          description_short?: string | null
          energy_class?: string | null
          featured?: boolean
          features?: Json
          fees_included?: boolean
          id?: string
          land_surface?: number | null
          mandate_number?: string | null
          photos?: Json
          postal_code?: string
          price?: number
          publication_status?: string
          published_at?: string | null
          reference?: string
          rooms?: number | null
          slug?: string
          source_url?: string | null
          status?: string
          surface?: number
          title?: string
          transaction_type?: string
          type?: string
          unpublished_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_history: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changed_fields: Json
          created_at: string
          id: string
          next_value: Json | null
          previous_value: Json | null
          property_id: string | null
          reference: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          next_value?: Json | null
          previous_value?: Json | null
          property_id?: string | null
          reference: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          next_value?: Json | null
          previous_value?: Json | null
          property_id?: string | null
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photo_trash: {
        Row: {
          delete_reason: string
          deleted_at: string
          deleted_by: string | null
          id: string
          public_url: string
          purged_at: string | null
          restore_until: string
          restored_at: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          delete_reason?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          public_url: string
          purged_at?: string | null
          restore_until?: string
          restored_at?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          delete_reason?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          public_url?: string
          purged_at?: string | null
          restore_until?: string
          restored_at?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photo_trash_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          alt_text: string | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          property_id: string
          public_url: string
          purged_at: string | null
          restore_until: string | null
          restored_at: string | null
          sort_order: number
          status: string
          storage_bucket: string
          storage_path: string
          trashed_at: string | null
          trashed_by: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          property_id: string
          public_url: string
          purged_at?: string | null
          restore_until?: string | null
          restored_at?: string | null
          sort_order?: number
          status?: string
          storage_bucket?: string
          storage_path: string
          trashed_at?: string | null
          trashed_by?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          property_id?: string
          public_url?: string
          purged_at?: string | null
          restore_until?: string | null
          restored_at?: string | null
          sort_order?: number
          status?: string
          storage_bucket?: string
          storage_path?: string
          trashed_at?: string | null
          trashed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_trashed_by_fkey"
            columns: ["trashed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_slug_history: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_slug: string
          old_slug: string
          property_id: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_slug: string
          old_slug: string
          property_id?: string | null
          reason?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_slug?: string
          old_slug?: string
          property_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_slug_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_slug_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_slug_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_versions: {
        Row: {
          change_reason: string
          changed_by: string | null
          created_at: string
          id: string
          property_id: string | null
          reference: string
          snapshot: Json
        }
        Insert: {
          change_reason?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          reference: string
          snapshot: Json
        }
        Update: {
          change_reason?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          reference?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "property_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_versions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_versions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          appointment_id: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          email_reminder_enabled: boolean
          email_reminder_last_error: string | null
          email_reminder_scheduled_at: string | null
          email_reminder_sent_at: string | null
          email_reminder_status: string
          id: string
          lead_id: string | null
          offer_id: string | null
          priority: string
          property_id: string | null
          recurrence_rule: string
          reminder_channel: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          email_reminder_enabled?: boolean
          email_reminder_last_error?: string | null
          email_reminder_scheduled_at?: string | null
          email_reminder_sent_at?: string | null
          email_reminder_status?: string
          id?: string
          lead_id?: string | null
          offer_id?: string | null
          priority?: string
          property_id?: string | null
          recurrence_rule?: string
          reminder_channel?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          email_reminder_enabled?: boolean
          email_reminder_last_error?: string | null
          email_reminder_scheduled_at?: string | null
          email_reminder_sent_at?: string | null
          email_reminder_status?: string
          id?: string
          lead_id?: string | null
          offer_id?: string | null
          priority?: string
          property_id?: string | null
          recurrence_rule?: string
          reminder_channel?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crm_legacy_lead_candidates: {
        Row: {
          archived: boolean | null
          city: string | null
          created_at: string | null
          email: string | null
          legacy_id: string | null
          legacy_table: string | null
          name: string | null
          normalized_email: string | null
          normalized_phone: string | null
          payload: Json | null
          phone: string | null
          request_type: string | null
          status: string | null
        }
        Relationships: []
      }
      public_properties: {
        Row: {
          archived_at: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          climate_class: string | null
          commercial_status: string | null
          created_at: string | null
          description_long: string | null
          description_short: string | null
          energy_class: string | null
          featured: boolean | null
          features: Json | null
          fees_included: boolean | null
          id: string | null
          land_surface: number | null
          mandate_number: string | null
          photos: Json | null
          postal_code: string | null
          price: number | null
          publication_status: string | null
          published_at: string | null
          reference: string | null
          rooms: number | null
          slug: string | null
          status: string | null
          surface: number | null
          title: string | null
          transaction_type: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_property_slug_redirects: {
        Row: {
          new_slug: string | null
          old_slug: string | null
        }
        Relationships: []
      }
      v_commercial_estimation_stats: {
        Row: {
          completed_this_month: number | null
          mandates_this_month: number | null
          new_requests: number | null
          scheduled_this_week: number | null
          to_schedule: number | null
        }
        Relationships: []
      }
      v_commercial_pipeline_stats: {
        Row: {
          blocked_count: number | null
          dossier_count: number | null
          estimated_value: number | null
          pipeline_stage: string | null
          pipeline_type: string | null
        }
        Relationships: []
      }
      v_commercial_visit_week_stats: {
        Row: {
          confirmed: number | null
          reports_missing: number | null
          to_confirm: number | null
          total: number | null
        }
        Relationships: []
      }
      v_negotiation_alerts: {
        Row: {
          alert_type: string | null
          buyer_contact_id: string | null
          days_without_activity: number | null
          id: string | null
          property_id: string | null
          response_deadline: string | null
        }
        Insert: {
          alert_type?: never
          buyer_contact_id?: string | null
          days_without_activity?: number | null
          id?: string | null
          property_id?: string | null
          response_deadline?: string | null
        }
        Update: {
          alert_type?: never
          buyer_contact_id?: string | null
          days_without_activity?: number | null
          id?: string | null
          property_id?: string | null
          response_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_buyer_contact_id_fkey"
            columns: ["buyer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "public_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      v_negotiations_kpi: {
        Row: {
          accepted_this_month: number | null
          action_required: number | null
          active: number | null
          average_gap: number | null
          awaiting_response: number | null
          total_volume: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_negotiation_proposal: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_amount: number
          p_author_role: string
          p_comment: string
          p_negotiation_id: string
          p_response_deadline: string
        }
        Returns: string
      }
      can_read_crm: { Args: never; Returns: boolean }
      create_commercial_case: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_assigned_to: string | null
          p_contact_id: string
          p_estimation_id: string | null
          p_notes: string
          p_pipeline_type: string
          p_priority: string
          p_property_id: string | null
          p_title: string
        }
        Returns: string
      }
      create_commercial_offer: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_amount: number
          p_buyer_contact_id: string
          p_buyer_dossier_id: string
          p_down_payment_amount: number | null
          p_financing_type: string
          p_included_furniture: string
          p_loan_amount: number | null
          p_negotiation_comment: string
          p_offer_date: string
          p_property_id: string
          p_responsible_user_id: string
          p_submission: string
          p_suspensive_conditions: string
          p_valid_until: string
          p_visit_id: string | null
        }
        Returns: Json
      }
      create_commercial_visit: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_assigned_to: string
          p_contact_id: string
          p_ends_at: string | null
          p_lead_id: string | null
          p_location: string
          p_notes: string
          p_property_id: string
          p_starts_at: string
        }
        Returns: string
      }
      decide_negotiation: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_comment: string
          p_negotiation_id: string
          p_status: string
        }
        Returns: undefined
      }
      is_active_admin: { Args: never; Returns: boolean }
      merge_crm_contacts: {
        Args: {
          p_actor_email: string
          p_actor_id: string
          p_merged_contact_id: string
          p_note?: string
          p_primary_contact_id: string
        }
        Returns: string
      }
      move_commercial_pipeline: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_lead_id: string
          p_stage: string
        }
        Returns: string
      }
      refresh_negotiation_alerts: { Args: never; Returns: number }
      submit_commercial_visit_report: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_blocking_points: string[]
          p_comments: string
          p_follow_up_at: string | null
          p_general_impression: string
          p_interest_level: number
          p_next_action: string
          p_positive_points: string[]
          p_visit_id: string
        }
        Returns: Json
      }
      transform_commercial_estimation: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_estimation_id: string
          p_listing_price: number
          p_mandate_type: string
        }
        Returns: Json
      }
      update_commercial_visit: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actor_name: string
          p_ends_at: string | null
          p_starts_at: string | null
          p_visit_id: string
          p_visit_status: string | null
        }
        Returns: string
      }
    }
    Enums: {
      admin_role:
        | "ADMIN"
        | "DIRECTOR"
        | "AGENT"
        | "ASSISTANT"
        | "MARKETING"
        | "READ_ONLY"
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
    Enums: {
      admin_role: [
        "ADMIN",
        "DIRECTOR",
        "AGENT",
        "ASSISTANT",
        "MARKETING",
        "READ_ONLY",
      ],
    },
  },
} as const
