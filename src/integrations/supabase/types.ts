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
  public: {
    Tables: {
      movements: {
        Row: {
          after: number
          before: number
          created_at: string
          date: string
          id: string
          ord: number
          product_id: string
          qty: number
          reason: string
          ref_code: string
          ref_id: string | null
          ref_type: string
          type: string
        }
        Insert: {
          after: number
          before: number
          created_at?: string
          date: string
          id?: string
          ord?: number
          product_id: string
          qty: number
          reason: string
          ref_code: string
          ref_id?: string | null
          ref_type: string
          type: string
        }
        Update: {
          after?: number
          before?: number
          created_at?: string
          date?: string
          id?: string
          ord?: number
          product_id?: string
          qty?: number
          reason?: string
          ref_code?: string
          ref_id?: string | null
          ref_type?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          code: string
          completed_at: string | null
          consumed: Json | null
          created_at: string
          date: string
          id: string
          ord: number
          produced: number | null
          qty: number
          recipe_id: string
          status: string
        }
        Insert: {
          code: string
          completed_at?: string | null
          consumed?: Json | null
          created_at?: string
          date: string
          id: string
          ord?: number
          produced?: number | null
          qty: number
          recipe_id: string
          status: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          consumed?: Json | null
          created_at?: string
          date?: string
          id?: string
          ord?: number
          produced?: number | null
          qty?: number
          recipe_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          cost: number
          created_at: string
          id: string
          min: number
          name: string
          ord: number
          price: number | null
          sku: string
          stock: number
          unit: string
        }
        Insert: {
          active?: boolean
          category: string
          cost?: number
          created_at?: string
          id: string
          min?: number
          name: string
          ord?: number
          price?: number | null
          sku: string
          stock?: number
          unit: string
        }
        Update: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          id?: string
          min?: number
          name?: string
          ord?: number
          price?: number | null
          sku?: string
          stock?: number
          unit?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          position: number
          product_id: string
          qty: number
          recipe_id: string
          unit: string
        }
        Insert: {
          position?: number
          product_id: string
          qty: number
          recipe_id: string
          unit: string
        }
        Update: {
          position?: number
          product_id?: string
          qty?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          name: string
          ord: number
          product_id: string
          yield: number
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          ord?: number
          product_id: string
          yield: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          ord?: number
          product_id?: string
          yield?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          name: string
          position: number
          price: number
          product_id: string
          qty: number
          sale_id: string
        }
        Insert: {
          name: string
          position: number
          price: number
          product_id: string
          qty: number
          sale_id: string
        }
        Update: {
          name?: string
          position?: number
          price?: number
          product_id?: string
          qty?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          date: string
          id: string
          method: string
          number: string
          ord: number
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          date: string
          id: string
          method: string
          number: string
          ord?: number
          status: string
          total?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          method?: string
          number?: string
          ord?: number
          status?: string
          total?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      sk_adjust: {
        Args: {
          p_product: string
          p_qty: number
          p_reason: string
          p_type: string
        }
        Returns: undefined
      }
      sk_apply: {
        Args: {
          p_date: string
          p_deltas: Json
          p_reason: string
          p_ref_code: string
          p_ref_id: string
          p_ref_type: string
          p_type: string
        }
        Returns: undefined
      }
      sk_complete_order: {
        Args: { p_at?: string; p_id: string }
        Returns: undefined
      }
      sk_delete_order: { Args: { p_id: string }; Returns: undefined }
      sk_delete_product: { Args: { p_id: string }; Returns: undefined }
      sk_delete_recipe: { Args: { p_id: string }; Returns: undefined }
      sk_delete_sale: { Args: { p_id: string }; Returns: undefined }
      sk_factor: { Args: { u: string }; Returns: number }
      sk_get_state: { Args: never; Returns: Json }
      sk_next_adj: { Args: never; Returns: string }
      sk_reset_demo: { Args: never; Returns: undefined }
      sk_save_order: { Args: { o: Json }; Returns: undefined }
      sk_save_product: { Args: { p: Json }; Returns: undefined }
      sk_save_recipe: { Args: { r: Json }; Returns: undefined }
      sk_save_sale: {
        Args: { p_confirm: boolean; s: Json }
        Returns: undefined
      }
      sk_set_order_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      sk_set_product_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      sk_void_sale: { Args: { p_id: string }; Returns: undefined }
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
    Enums: {},
  },
} as const
