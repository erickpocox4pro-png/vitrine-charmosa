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
      audit_logs: {
        Row: {
          action: string
          admin_email: string
          admin_user_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_email?: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_email?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          applies_to: string
          category_ids: string[] | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order_value: number | null
          starts_at: string | null
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          applies_to?: string
          category_ids?: string[] | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          applies_to?: string
          category_ids?: string[] | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          admin_email: string | null
          admin_user_id: string
          created_at: string
          customer_user_id: string
          id: string
          note: string
        }
        Insert: {
          admin_email?: string | null
          admin_user_id: string
          created_at?: string
          customer_user_id: string
          id?: string
          note: string
        }
        Update: {
          admin_email?: string | null
          admin_user_id?: string
          created_at?: string
          customer_user_id?: string
          id?: string
          note?: string
        }
        Relationships: []
      }
      import_job_items: {
        Row: {
          action: string
          created_at: string
          data: Json | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          job_id: string
          line_number: number | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          data?: Json | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          job_id: string
          line_number?: number | null
          status?: string
        }
        Update: {
          action?: string
          created_at?: string
          data?: Json | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          job_id?: string
          line_number?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          admin_user_id: string
          completed_at: string | null
          created_at: string
          created_count: number | null
          error_count: number | null
          file_name: string | null
          id: string
          skipped_count: number | null
          status: string
          summary: Json | null
          total_items: number | null
          updated_count: number | null
        }
        Insert: {
          admin_user_id: string
          completed_at?: string | null
          created_at?: string
          created_count?: number | null
          error_count?: number | null
          file_name?: string | null
          id?: string
          skipped_count?: number | null
          status?: string
          summary?: Json | null
          total_items?: number | null
          updated_count?: number | null
        }
        Update: {
          admin_user_id?: string
          completed_at?: string | null
          created_at?: string
          created_count?: number | null
          error_count?: number | null
          file_name?: string | null
          id?: string
          skipped_count?: number | null
          status?: string
          summary?: Json | null
          total_items?: number | null
          updated_count?: number | null
        }
        Relationships: []
      }
      manual_sales: {
        Row: {
          admin_email: string
          admin_user_id: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_date: string
          total: number
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          admin_email?: string
          admin_user_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_date?: string
          total: number
          unit_price: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          admin_email?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_date?: string
          total?: number
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_sales_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline: {
        Row: {
          admin_email: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          admin_email?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          admin_email?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          internal_notes: string | null
          payment_method: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          status: string
          total: number
          tracking_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          payment_method?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string
          total: number
          tracking_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          payment_method?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          created_at: string
          id: string
          page_path: string
          referrer: string | null
          session_id: string | null
          source_label: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path?: string
          referrer?: string | null
          session_id?: string | null
          source_label?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
          referrer?: string | null
          session_id?: string | null
          source_label?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      pix_payments: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          order_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          id?: string
          order_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          order_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          color_name: string | null
          created_at: string
          estampa: string | null
          id: string
          is_active: boolean
          name: string
          numbering: string | null
          price: number | null
          product_id: string
          size: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          color_name?: string | null
          created_at?: string
          estampa?: string | null
          id?: string
          is_active?: boolean
          name?: string
          numbering?: string | null
          price?: number | null
          product_id: string
          size?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          color_name?: string | null
          created_at?: string
          estampa?: string | null
          id?: string
          is_active?: boolean
          name?: string
          numbering?: string | null
          price?: number | null
          product_id?: string
          size?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bg_color_group: string | null
          brand: string | null
          category: string
          category_id: string | null
          created_at: string
          description: string | null
          height: number | null
          id: string
          image_url: string
          is_active: boolean
          is_bestseller: boolean | null
          is_featured: boolean | null
          is_new: boolean
          keywords: string | null
          length: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          original_price: number | null
          price: number
          secondary_category_id: string | null
          short_description: string | null
          sku: string | null
          slug: string | null
          sort_order: number
          status: string | null
          subcategory_id: string | null
          tags: string[] | null
          updated_at: string
          video_url: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          bg_color_group?: string | null
          brand?: string | null
          category: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          image_url: string
          is_active?: boolean
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          is_new?: boolean
          keywords?: string | null
          length?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          original_price?: number | null
          price: number
          secondary_category_id?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          sort_order?: number
          status?: string | null
          subcategory_id?: string | null
          tags?: string[] | null
          updated_at?: string
          video_url?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          bg_color_group?: string | null
          brand?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string
          is_active?: boolean
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          is_new?: boolean
          keywords?: string | null
          length?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          original_price?: number | null
          price?: number
          secondary_category_id?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          sort_order?: number
          status?: string | null
          subcategory_id?: string | null
          tags?: string[] | null
          updated_at?: string
          video_url?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_secondary_category_id_fkey"
            columns: ["secondary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipping_rules: {
        Row: {
          cep_end: string
          cep_start: string
          created_at: string
          delivery_days_max: number
          delivery_days_min: number
          id: string
          is_active: boolean
          is_free: boolean
          price: number
          region_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cep_end: string
          cep_start: string
          created_at?: string
          delivery_days_max?: number
          delivery_days_min?: number
          id?: string
          is_active?: boolean
          is_free?: boolean
          price?: number
          region_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cep_end?: string
          cep_start?: string
          created_at?: string
          delivery_days_max?: number
          delivery_days_min?: number
          id?: string
          is_active?: boolean
          is_free?: boolean
          price?: number
          region_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_coupon: {
        Args: { _code: string; _order_total?: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
