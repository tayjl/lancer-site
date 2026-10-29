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
    PostgrestVersion: "14.18"
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
      bionic_bonuses: {
        Row: {
          amount: number
          bionic_id: number
          stat_id: string
        }
        Insert: {
          amount: number
          bionic_id: number
          stat_id: string
        }
        Update: {
          amount?: number
          bionic_id?: number
          stat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bionic_bonuses_bionic_id_fkey"
            columns: ["bionic_id"]
            isOneToOne: false
            referencedRelation: "bionics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bionic_bonuses_stat_id_fkey"
            columns: ["stat_id"]
            isOneToOne: false
            referencedRelation: "pilot_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      bionics: {
        Row: {
          description: string | null
          id: number
          manna_cost: number
          mod_point_cost: number
          name: string
          retired: boolean
        }
        Insert: {
          description?: string | null
          id?: never
          manna_cost?: number
          mod_point_cost?: number
          name: string
          retired?: boolean
        }
        Update: {
          description?: string | null
          id?: never
          manna_cost?: number
          mod_point_cost?: number
          name?: string
          retired?: boolean
        }
        Relationships: []
      }
      character_sheets: {
        Row: {
          character_id: number
          level: number
          manna: number
          review_note: string | null
          sheet: Json
          updated_at: string
        }
        Insert: {
          character_id: number
          level?: number
          manna?: number
          review_note?: string | null
          sheet?: Json
          updated_at?: string
        }
        Update: {
          character_id?: number
          level?: number
          manna?: number
          review_note?: string | null
          sheet?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sheets_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          age: string | null
          appearance: Json | null
          approved_at: string | null
          callsign: string | null
          created_at: string
          died_at: string | null
          eye_colour: string | null
          gender: string | null
          hair_colour: string | null
          height: string | null
          id: number
          mechs: Json
          personality: Json | null
          pilot_image: string | null
          pilot_name: string
          player_id: string
          sexuality: string | null
          status: Database["public"]["Enums"]["character_status"]
          traits: Json | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          age?: string | null
          appearance?: Json | null
          approved_at?: string | null
          callsign?: string | null
          created_at?: string
          died_at?: string | null
          eye_colour?: string | null
          gender?: string | null
          hair_colour?: string | null
          height?: string | null
          id?: never
          mechs?: Json
          personality?: Json | null
          pilot_image?: string | null
          pilot_name: string
          player_id: string
          sexuality?: string | null
          status?: Database["public"]["Enums"]["character_status"]
          traits?: Json | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          age?: string | null
          appearance?: Json | null
          approved_at?: string | null
          callsign?: string | null
          created_at?: string
          died_at?: string | null
          eye_colour?: string | null
          gender?: string | null
          hair_colour?: string | null
          height?: string | null
          id?: never
          mechs?: Json
          personality?: Json | null
          pilot_image?: string | null
          pilot_name?: string
          player_id?: string
          sexuality?: string | null
          status?: Database["public"]["Enums"]["character_status"]
          traits?: Json | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          data: Json
          id: string
          kind: string
          pack_id: number
        }
        Insert: {
          data: Json
          id: string
          kind: string
          pack_id: number
        }
        Update: {
          data?: Json
          id?: string
          kind?: string
          pack_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "content_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_packs: {
        Row: {
          enabled: boolean
          id: number
          imported_at: string
          imported_by: string | null
          manifest: Json
          name: string
          version: string | null
        }
        Insert: {
          enabled?: boolean
          id?: never
          imported_at?: string
          imported_by?: string | null
          manifest: Json
          name: string
          version?: string | null
        }
        Update: {
          enabled?: boolean
          id?: never
          imported_at?: string
          imported_by?: string | null
          manifest?: Json
          name?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_packs_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          description: string | null
          id: number
          name: string
        }
        Insert: {
          description?: string | null
          id?: never
          name: string
        }
        Update: {
          description?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      pending_changes: {
        Row: {
          based_on: string
          character_id: number
          created_at: string
          id: number
          proposed_public: Json
          proposed_sheet: Json
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_status"]
          submitted_at: string | null
          submitted_by: string
        }
        Insert: {
          based_on: string
          character_id: number
          created_at?: string
          id?: never
          proposed_public: Json
          proposed_sheet: Json
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_status"]
          submitted_at?: string | null
          submitted_by: string
        }
        Update: {
          based_on?: string
          character_id?: number
          created_at?: string
          id?: never
          proposed_public?: Json
          proposed_sheet?: Json
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_status"]
          submitted_at?: string | null
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_changes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_changes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_changes_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_stats: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reputation: {
        Row: {
          character_id: number
          level_id: number
          organisation_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          character_id: number
          level_id: number
          organisation_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          character_id?: number
          level_id?: number
          organisation_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "reputation_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_levels: {
        Row: {
          id: number
          name: string
          sort_order: number
        }
        Insert: {
          id?: never
          name: string
          sort_order?: number
        }
        Update: {
          id?: never
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_change: { Args: { change_id: number }; Returns: undefined }
      dismiss_approval_note: {
        Args: { expected_note: string; target_character_id: number }
        Returns: undefined
      }
      import_lcp: {
        Args: {
          expected_imported_at?: string
          expected_pack_id?: number
          pack_items: Json
          pack_manifest: Json
        }
        Returns: Json
      }
      is_gm: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      mark_dead: { Args: { target_character_id: number }; Returns: undefined }
    }
    Enums: {
      change_status: "pending" | "approved" | "rejected"
      character_status: "pending" | "approved" | "dead"
      user_role: "player" | "gm" | "owner"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      change_status: ["pending", "approved", "rejected"],
      character_status: ["pending", "approved", "dead"],
      user_role: ["player", "gm", "owner"],
    },
  },
} as const
