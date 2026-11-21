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
          effect: string
          effect_bonuses: Json
          id: number
          integrated: string[]
          manna_cost: number
          mod_point_cost: number
          name: string
          replace_integrated: boolean
          requires: Json
          retired: boolean
          slot: string
          source: string | null
          special_equipment: string[]
          updated_at: string
        }
        Insert: {
          description?: string | null
          effect?: string
          effect_bonuses?: Json
          id?: never
          integrated?: string[]
          manna_cost?: number
          mod_point_cost?: number
          name: string
          replace_integrated?: boolean
          requires?: Json
          retired?: boolean
          slot?: string
          source?: string | null
          special_equipment?: string[]
          updated_at?: string
        }
        Update: {
          description?: string | null
          effect?: string
          effect_bonuses?: Json
          id?: never
          integrated?: string[]
          manna_cost?: number
          mod_point_cost?: number
          name?: string
          replace_integrated?: boolean
          requires?: Json
          retired?: boolean
          slot?: string
          source?: string | null
          special_equipment?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      character_sheets: {
        Row: {
          character_id: number
          gm_grants: Json
          level: number
          manna: number
          review_note: string | null
          sheet: Json
          updated_at: string
        }
        Insert: {
          character_id: number
          gm_grants?: Json
          level?: number
          manna?: number
          review_note?: string | null
          sheet?: Json
          updated_at?: string
        }
        Update: {
          character_id?: number
          gm_grants?: Json
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
          submitted_at: string | null
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
          submitted_at?: string | null
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
          submitted_at?: string | null
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
      commendations: {
        Row: {
          description: string
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          description?: string
          icon: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          description?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          data: Json
          draft: boolean
          edited: Json | null
          id: string
          kind: string
          pack_id: number
          updated_at: string
        }
        Insert: {
          data: Json
          draft?: boolean
          edited?: Json | null
          id: string
          kind: string
          pack_id: number
          updated_at?: string
        }
        Update: {
          data?: Json
          draft?: boolean
          edited?: Json | null
          id?: string
          kind?: string
          pack_id?: number
          updated_at?: string
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
      lore_entries: {
        Row: {
          body: Json
          created_at: string
          created_by: string | null
          id: string
          kind: string
          published_at: string | null
          related: string[]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          published_at?: string | null
          related?: string[]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          published_at?: string | null
          related?: string[]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_entries_created_by_fkey"
            columns: ["created_by"]
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
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: never
          name: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: never
          name?: string
          updated_at?: string
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
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          based_on?: string
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
          submitted_by?: string | null
          updated_at?: string
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
          submitted_by?: string | null
          updated_at?: string
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
      pilot_commendations: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          character_id: number
          commendation_id: string
          id: string
          reason: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          character_id: number
          commendation_id: string
          id?: string
          reason?: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          character_id?: number
          commendation_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_commendations_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_commendations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_commendations_commendation_id_fkey"
            columns: ["commendation_id"]
            isOneToOne: false
            referencedRelation: "commendations"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_profiles: {
        Row: {
          banner_image: string | null
          banner_x: number
          banner_y: number
          banner_zoom: number
          card_version: string | null
          character_id: number
          colour: string | null
          gallery: Json
          mech_card_versions: Json
          motto: string | null
          updated_at: string
        }
        Insert: {
          banner_image?: string | null
          banner_x?: number
          banner_y?: number
          banner_zoom?: number
          card_version?: string | null
          character_id: number
          colour?: string | null
          gallery?: Json
          mech_card_versions?: Json
          motto?: string | null
          updated_at?: string
        }
        Update: {
          banner_image?: string | null
          banner_x?: number
          banner_y?: number
          banner_zoom?: number
          card_version?: string | null
          character_id?: number
          colour?: string | null
          gallery?: Json
          mech_card_versions?: Json
          motto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_profiles_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_progress: {
        Row: {
          character_id: number
          experience: number
          updated_at: string
        }
        Insert: {
          character_id: number
          experience?: number
          updated_at?: string
        }
        Update: {
          character_id?: number
          experience?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_progress_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_public_backstory: {
        Row: {
          backstory: Json | null
          character_id: number
          updated_at: string
        }
        Insert: {
          backstory?: Json | null
          character_id: number
          updated_at?: string
        }
        Update: {
          backstory?: Json | null
          character_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_public_backstory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_reward_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          character_id: number
          field: string
          id: number
          new_value: number
          old_value: number
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          character_id: number
          field: string
          id?: never
          new_value: number
          old_value: number
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          character_id?: number
          field?: string
          id?: never
          new_value?: number
          old_value?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_reward_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_reward_log_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_stats: {
        Row: {
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pilot_timeline: {
        Row: {
          body: Json | null
          character_id: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          occurred_on: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json | null
          character_id: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          occurred_on?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json | null
          character_id?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          occurred_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_timeline_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_timeline_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pithub_entries: {
        Row: {
          body: Json
          created_at: string
          created_by: string | null
          id: string
          kind: string
          published_at: string | null
          related: string[]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          published_at?: string | null
          related?: string[]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          published_at?: string | null
          related?: string[]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pithub_entries_created_by_fkey"
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
      approve_change: {
        Args: {
          change_id: number
          expected_submitted_at: string
          note?: string
        }
        Returns: undefined
      }
      approve_pilot: {
        Args: {
          expected_updated_at: string
          note?: string
          target_character_id: number
        }
        Returns: undefined
      }
      award: {
        Args: {
          new_experience?: number
          new_level?: number
          new_manna?: number
          reason?: string
          target_character_id: number
        }
        Returns: undefined
      }
      delete_content_item: { Args: { target_id: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      dismiss_approval_note: {
        Args: { expected_note: string; target_character_id: number }
        Returns: undefined
      }
      equip_pilot_gear: {
        Args: { keys: string[]; target_character_id: number }
        Returns: string
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
      item_usage: {
        Args: { is_bionic?: boolean; item_id: string }
        Returns: {
          character_id: number
          pilot: string
        }[]
      }
      level_up: {
        Args: { reason?: string; target_character_id: number }
        Returns: undefined
      }
      mark_dead: { Args: { target_character_id: number }; Returns: undefined }
      mech_card: {
        Args: { target_character_id: number; target_mech_id: string }
        Returns: {
          callsign: string
          card_image: string
          card_version: string
          character_id: number
          colour: string
          frame_id: string
          frame_name: string
          frame_source: string
          manufacturer_id: string
          mech_id: string
          mech_image: string
          mech_name: string
          pilot_name: string
          status: Database["public"]["Enums"]["character_status"]
        }[]
      }
      pack_usage: {
        Args: never
        Returns: {
          character_id: number
          item_name: string
          pack_id: number
          pilot: string
        }[]
      }
      permanent_bonus: { Args: { bonus: Json }; Returns: boolean }
      pilot_card: {
        Args: { target_character_id: number }
        Returns: {
          approved_at: string
          callsign: string
          card_image: string
          card_version: string
          colour: string
          id: number
          level: number
          licence_level: number
          medals: string[]
          pilot_image: string
          pilot_name: string
          status: Database["public"]["Enums"]["character_status"]
        }[]
      }
      pilot_cards: {
        Args: { target_status: Database["public"]["Enums"]["character_status"] }
        Returns: {
          approved_at: string
          callsign: string
          colour: string
          created_at: string
          id: number
          level: number
          licence_level: number
          medals: string[]
          pilot_image: string
          pilot_name: string
          player_name: string
          status: Database["public"]["Enums"]["character_status"]
          submitted_at: string
        }[]
      }
      pilot_sheet: {
        Args: { target_character_id: number }
        Returns: {
          level: number
          sheet: Json
        }[]
      }
      reject_change: {
        Args: { change_id: number; reason: string }
        Returns: undefined
      }
      remove_pack: { Args: { target_pack_id: number }; Returns: undefined }
      save_bionic: {
        Args: {
          expected_updated_at?: string
          new_bonuses: Json
          new_description: string
          new_effect: string
          new_effect_bonuses?: Json
          new_integrated?: string[]
          new_mod_cost: number
          new_name: string
          new_price: number
          new_replace_integrated?: boolean
          new_requires?: Json
          new_retired: boolean
          new_slot: string
          new_source?: string
          new_special_equipment?: string[]
          target_id?: number
        }
        Returns: Json
      }
      send_back_pilot: {
        Args: { note: string; target_character_id: number }
        Returns: undefined
      }
      set_backstory_public: {
        Args: { make_public: boolean; target_character_id: number }
        Returns: undefined
      }
      settle_pilot_gear: {
        Args: { first_approval: boolean; live: Json; proposed: Json }
        Returns: Json
      }
      sheet_rule_problems: {
        Args: { pilot_level: number; sheet: Json }
        Returns: {
          at_mech: string
          problem: string
        }[]
      }
      unmet_requirements: {
        Args: { needs: Json; owned: string[]; pilot: Json }
        Returns: string[]
      }
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
