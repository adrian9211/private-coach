import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// This is the client-side Supabase client
// It's used in client components
export const supabase = createClientComponentClient()

// Database types (will be generated from Supabase)
export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_size: number
          upload_date: string
          processed_date: string | null
          status: 'uploaded' | 'processing' | 'processed' | 'failed'
          metadata: any
          data: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_size: number
          upload_date?: string
          processed_date?: string | null
          status?: 'uploaded' | 'processing' | 'processed' | 'failed'
          metadata?: any
          data?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_size?: number
          upload_date?: string
          processed_date?: string | null
          status?: 'uploaded' | 'processing' | 'processed' | 'failed'
          metadata?: any
          data?: any
          created_at?: string
          updated_at?: string
        }
      }
      activity_analyses: {
        Row: {
          id: string
          activity_id: string
          generated_at: string
          summary: string
          insights: string[]
          recommendations: any[]
          trends: any[]
          performance_metrics: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          generated_at?: string
          summary: string
          insights?: string[]
          recommendations?: any[]
          trends?: any[]
          performance_metrics?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          generated_at?: string
          summary?: string
          insights?: string[]
          recommendations?: any[]
          trends?: any[]
          performance_metrics?: any
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          preferences: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          preferences?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          preferences?: any
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

