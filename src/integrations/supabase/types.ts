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
      app_settings: {
        Row: {
          accent_color: string | null
          app_name: string
          id: boolean
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          welcome_message: string | null
          welcome_title: string | null
        }
        Insert: {
          accent_color?: string | null
          app_name?: string
          id?: boolean
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          welcome_message?: string | null
          welcome_title?: string | null
        }
        Update: {
          accent_color?: string | null
          app_name?: string
          id?: boolean
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          welcome_message?: string | null
          welcome_title?: string | null
        }
        Relationships: []
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string
          day: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          day: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          day?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          days: Json
          description: string | null
          extras: Json
          icon: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          days?: Json
          description?: string | null
          extras?: Json
          icon?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          days?: Json
          description?: string | null
          extras?: Json
          icon?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      diary_questions: {
        Row: {
          created_at: string
          field_type: string
          hint: string | null
          id: string
          is_active: boolean
          question: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_type?: string
          hint?: string | null
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_type?: string
          hint?: string | null
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          month: string
          recipes: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          recipes?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          recipes?: Json
          user_id?: string
        }
        Relationships: []
      }
      movement_items: {
        Row: {
          blocks: Json
          category: string | null
          cover_image: string | null
          created_at: string
          id: string
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          category?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          category?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_categories: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          key: string
          label: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          key: string
          label: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_items: {
        Row: {
          blocks: Json
          category: string | null
          cover_image: string | null
          created_at: string
          id: string
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          category?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          category?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferences: Json | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferences?: Json | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json | null
        }
        Relationships: []
      }
      progress_metrics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          target_value: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          target_value?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          target_value?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          categories: string[]
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ingredients: Json | null
          is_featured: boolean
          is_high_protein: boolean
          is_library: boolean
          macros: Json | null
          prep_time: number | null
          servings: number | null
          source_user_id: string | null
          sort_order: number
          steps: Json | null
          tags: string[] | null
          title: string
          user_id: string | null
          video_url: string | null
          visibility: string
        }
        Insert: {
          categories?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          is_featured?: boolean
          is_high_protein?: boolean
          is_library?: boolean
          macros?: Json | null
          prep_time?: number | null
          servings?: number | null
          source_user_id?: string | null
          sort_order?: number
          steps?: Json | null
          tags?: string[] | null
          title: string
          user_id?: string | null
          video_url?: string | null
          visibility?: string
        }
        Update: {
          categories?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          is_featured?: boolean
          is_high_protein?: boolean
          is_library?: boolean
          macros?: Json | null
          prep_time?: number | null
          servings?: number | null
          source_user_id?: string | null
          sort_order?: number
          steps?: Json | null
          tags?: string[] | null
          title?: string
          user_id?: string | null
          video_url?: string | null
          visibility?: string
        }
        Relationships: []
      }
      resource_categories: {
        Row: {
          created_at: string
          cover_image: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cover_image?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cover_image?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          blocks: Json
          body: string | null
          category: string | null
          category_id: string | null
          cover_image: string | null
          created_at: string
          id: string
          is_pinned: boolean
          is_published: boolean
          sort_order: number
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          blocks?: Json
          body?: string | null
          category?: string | null
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          sort_order?: number
          title: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          blocks?: Json
          body?: string | null
          category?: string | null
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_recipes: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          category: string | null
          checked: boolean
          created_at: string
          id: string
          name: string
          quantity: string | null
          recipe_id: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          name: string
          quantity?: string | null
          recipe_id?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          quantity?: string | null
          recipe_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_templates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      wellness_entries: {
        Row: {
          arm_cm: number | null
          chest_cm: number | null
          created_at: string
          entry_date: string
          exercise: string | null
          hip_cm: number | null
          id: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          steps: number | null
          thigh_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          water_ml: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          entry_date?: string
          exercise?: string | null
          hip_cm?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          steps?: number | null
          thigh_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          water_ml?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          entry_date?: string
          exercise?: string | null
          hip_cm?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          steps?: number | null
          thigh_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          water_ml?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      wellness_goals: {
        Row: {
          achieved: boolean
          created_at: string
          id: string
          metric: string
          start_value: number | null
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved?: boolean
          created_at?: string
          id?: string
          metric: string
          start_value?: number | null
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved?: boolean
          created_at?: string
          id?: string
          metric?: string
          start_value?: number | null
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wellness_measurements: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          metric: string
          unit: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          metric: string
          unit: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          metric?: string
          unit?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      wellness_progress_photos: {
        Row: {
          created_at: string
          id: string
          image_path: string
          kind: string
          metric: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          kind: string
          metric: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          kind?: string
          metric?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      invitation_status: "pending" | "used" | "expired"
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
      app_role: ["admin", "client"],
      invitation_status: ["pending", "used", "expired"],
    },
  },
} as const
