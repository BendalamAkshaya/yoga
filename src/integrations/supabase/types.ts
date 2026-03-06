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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      asanas: {
        Row: {
          asana_code: string
          asana_name: string
          base_value: number
          id: string
          image_url: string | null
          type: Database["public"]["Enums"]["asana_type"]
        }
        Insert: {
          asana_code: string
          asana_name: string
          base_value?: number
          id?: string
          image_url?: string | null
          type?: Database["public"]["Enums"]["asana_type"]
        }
        Update: {
          asana_code?: string
          asana_name?: string
          base_value?: number
          id?: string
          image_url?: string | null
          type?: Database["public"]["Enums"]["asana_type"]
        }
        Relationships: []
      }
      athletes: {
        Row: {
          age: number | null
          created_at: string
          district: string | null
          event_id: string
          gender: string | null
          id: string
          name: string
          optional_asana1: string | null
          optional_asana2: string | null
          sort_order: number
          status: Database["public"]["Enums"]["athlete_status"]
        }
        Insert: {
          age?: number | null
          created_at?: string
          district?: string | null
          event_id: string
          gender?: string | null
          id?: string
          name: string
          optional_asana1?: string | null
          optional_asana2?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["athlete_status"]
        }
        Update: {
          age?: number | null
          created_at?: string
          district?: string | null
          event_id?: string
          gender?: string | null
          id?: string
          name?: string
          optional_asana1?: string | null
          optional_asana2?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["athlete_status"]
        }
        Relationships: [
          {
            foreignKeyName: "athletes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          is_active: boolean
          no_of_asanas: number
          round: Database["public"]["Enums"]["event_round"]
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          is_active?: boolean
          no_of_asanas?: number
          round?: Database["public"]["Enums"]["event_round"]
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          is_active?: boolean
          no_of_asanas?: number
          round?: Database["public"]["Enums"]["event_round"]
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: []
      }
      judges: {
        Row: {
          created_at: string
          event_id: string
          id: string
          judge_label: string | null
          name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          judge_label?: string | null
          name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          judge_label?: string | null
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          approved: boolean
          athlete_id: string
          created_at: string
          event_id: string
          id: string
          penalty_value: number
          reason: string | null
        }
        Insert: {
          approved?: boolean
          athlete_id: string
          created_at?: string
          event_id: string
          id?: string
          penalty_value?: number
          reason?: string | null
        }
        Update: {
          approved?: boolean
          athlete_id?: string
          created_at?: string
          event_id?: string
          id?: string
          penalty_value?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalties_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          asana_code: string
          athlete_id: string
          base_value: number
          created_at: string
          final_score: number
          id: string
          judge_id: string
          score: number
          submitted: boolean
          updated_at: string
        }
        Insert: {
          asana_code: string
          athlete_id: string
          base_value?: number
          created_at?: string
          final_score?: number
          id?: string
          judge_id: string
          score?: number
          submitted?: boolean
          updated_at?: string
        }
        Update: {
          asana_code?: string
          athlete_id?: string
          base_value?: number
          created_at?: string
          final_score?: number
          id?: string
          judge_id?: string
          score?: number
          submitted?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "judges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "tsr_admin"
        | "chief_judge"
        | "d_judge"
        | "t_judge"
        | "e_judge"
        | "stage_manager"
      asana_type: "compulsory" | "optional"
      athlete_status: "waiting" | "performing" | "completed" | "absent"
      event_round: "semi" | "final"
      event_type: "individual" | "pair"
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
      app_role: [
        "tsr_admin",
        "chief_judge",
        "d_judge",
        "t_judge",
        "e_judge",
        "stage_manager",
      ],
      asana_type: ["compulsory", "optional"],
      athlete_status: ["waiting", "performing", "completed", "absent"],
      event_round: ["semi", "final"],
      event_type: ["individual", "pair"],
    },
  },
} as const
