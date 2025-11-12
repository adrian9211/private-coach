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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          avg_cadence: number | null
          avg_heart_rate: number | null
          avg_power: number | null
          avg_speed: number | null
          avg_temperature: number | null
          created_at: string | null
          data: Json | null
          device: string | null
          feeling: number | null
          file_name: string
          file_size: number
          gps_track: Json | null
          id: string
          max_cadence: number | null
          max_heart_rate: number | null
          max_power: number | null
          max_speed: number | null
          max_temperature: number | null
          metadata: Json | null
          min_temperature: number | null
          personal_notes: string | null
          processed_at: string | null
          processed_date: string | null
          processing_method: string | null
          rpe: number | null
          sport: string | null
          start_time: string | null
          status: string | null
          sub_sport: string | null
          total_ascent: number | null
          total_calories: number | null
          total_descent: number | null
          total_distance: number | null
          total_elapsed_time: number | null
          total_timer_time: number | null
          updated_at: string | null
          upload_date: string | null
          user_id: string | null
        }
        Insert: {
          avg_cadence?: number | null
          avg_heart_rate?: number | null
          avg_power?: number | null
          avg_speed?: number | null
          avg_temperature?: number | null
          created_at?: string | null
          data?: Json | null
          device?: string | null
          feeling?: number | null
          file_name: string
          file_size: number
          gps_track?: Json | null
          id?: string
          max_cadence?: number | null
          max_heart_rate?: number | null
          max_power?: number | null
          max_speed?: number | null
          max_temperature?: number | null
          metadata?: Json | null
          min_temperature?: number | null
          personal_notes?: string | null
          processed_at?: string | null
          processed_date?: string | null
          processing_method?: string | null
          rpe?: number | null
          sport?: string | null
          start_time?: string | null
          status?: string | null
          sub_sport?: string | null
          total_ascent?: number | null
          total_calories?: number | null
          total_descent?: number | null
          total_distance?: number | null
          total_elapsed_time?: number | null
          total_timer_time?: number | null
          updated_at?: string | null
          upload_date?: string | null
          user_id?: string | null
        }
        Update: {
          avg_cadence?: number | null
          avg_heart_rate?: number | null
          avg_power?: number | null
          avg_speed?: number | null
          avg_temperature?: number | null
          created_at?: string | null
          data?: Json | null
          device?: string | null
          feeling?: number | null
          file_name?: string
          file_size?: number
          gps_track?: Json | null
          id?: string
          max_cadence?: number | null
          max_heart_rate?: number | null
          max_power?: number | null
          max_speed?: number | null
          max_temperature?: number | null
          metadata?: Json | null
          min_temperature?: number | null
          personal_notes?: string | null
          processed_at?: string | null
          processed_date?: string | null
          processing_method?: string | null
          rpe?: number | null
          sport?: string | null
          start_time?: string | null
          status?: string | null
          sub_sport?: string | null
          total_ascent?: number | null
          total_calories?: number | null
          total_descent?: number | null
          total_distance?: number | null
          total_elapsed_time?: number | null
          total_timer_time?: number | null
          updated_at?: string | null
          upload_date?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_analyses: {
        Row: {
          activity_id: string | null
          created_at: string | null
          generated_at: string | null
          id: string
          insights: Json | null
          performance_metrics: Json | null
          recommendations: Json | null
          summary: string
          trends: Json | null
          updated_at: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          insights?: Json | null
          performance_metrics?: Json | null
          recommendations?: Json | null
          summary: string
          trends?: Json | null
          updated_at?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          insights?: Json | null
          performance_metrics?: Json | null
          recommendations?: Json | null
          summary?: string
          trends?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_analyses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_chat_messages: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_chat_messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      intervals_connections: {
        Row: {
          access_token: string
          athlete_id: string
          connected_at: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_id: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_id?: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervals_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      intervals_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          items_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervals_sync_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_workouts: {
        Row: {
          activity_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          scheduled_date: string
          scheduled_time: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          workout_category: string | null
          workout_id: string | null
          workout_name: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          workout_category?: string | null
          workout_id?: string | null
          workout_name: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workout_category?: string | null
          workout_id?: string | null
          workout_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_workouts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_workouts_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_insights: {
        Row: {
          created_at: string | null
          data_snapshot: Json | null
          generated_at: string | null
          id: string
          recommendations: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_snapshot?: Json | null
          generated_at?: string | null
          id?: string
          recommendations: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_snapshot?: Json | null
          generated_at?: string | null
          id?: string
          recommendations?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          preferences: Json | null
          training_goals: string | null
          updated_at: string | null
          vo2_max: number | null
          weekly_training_hours: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          preferences?: Json | null
          training_goals?: string | null
          updated_at?: string | null
          vo2_max?: number | null
          weekly_training_hours?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          preferences?: Json | null
          training_goals?: string | null
          updated_at?: string | null
          vo2_max?: number | null
          weekly_training_hours?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          author: string | null
          category: string
          created_at: string | null
          description: string | null
          download_url: string | null
          duration: string | null
          duration_seconds: number | null
          id: string
          intensity_factor: number | null
          name: string
          power_zones: string[] | null
          slug: string
          source: string | null
          sport_type: string | null
          steps: Json | null
          tss: number | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          download_url?: string | null
          duration?: string | null
          duration_seconds?: number | null
          id?: string
          intensity_factor?: number | null
          name: string
          power_zones?: string[] | null
          slug: string
          source?: string | null
          sport_type?: string | null
          steps?: Json | null
          tss?: number | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          download_url?: string | null
          duration?: string | null
          duration_seconds?: number | null
          id?: string
          intensity_factor?: number | null
          name?: string
          power_zones?: string[] | null
          slug?: string
          source?: string | null
          sport_type?: string | null
          steps?: Json | null
          tss?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      activity_summaries: {
        Row: {
          avg_heart_rate: number | null
          avg_power: number | null
          avg_speed: number | null
          total_activities: number | null
          total_calories: number | null
          total_distance: number | null
          total_duration: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_level: { Args: { name: string }; Returns: number }
      get_prefix: { Args: { name: string }; Returns: string }
      get_prefixes: { Args: { name: string }; Returns: string[] }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const
