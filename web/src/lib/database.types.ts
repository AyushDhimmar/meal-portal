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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          entity: string
          entity_id: string | null
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      cycle_holidays: {
        Row: {
          cycle_id: string
          day: string
          label: string | null
        }
        Insert: {
          cycle_id: string
          day: string
          label?: string | null
        }
        Update: {
          cycle_id?: string
          day?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_holidays_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "lunch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_holidays_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_holidays_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_lunch_days"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "cycle_holidays_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          created_at: string
          department: string | null
          email: string
          emp_code: string
          id: string
          name: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          emp_code: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          emp_code?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          cycle_id: string
          employee_id: string
          opted_in: boolean
          source: Database["public"]["Enums"]["enroll_source"]
          updated_at: string
        }
        Insert: {
          cycle_id: string
          employee_id: string
          opted_in: boolean
          source?: Database["public"]["Enums"]["enroll_source"]
          updated_at?: string
        }
        Update: {
          cycle_id?: string
          employee_id?: string
          opted_in?: boolean
          source?: Database["public"]["Enums"]["enroll_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "lunch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_lunch_days"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "enrollments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      lunch_cycles: {
        Row: {
          billing_basis: Database["public"]["Enums"]["billing_basis"]
          created_at: string
          enforce_serving_window: boolean
          id: string
          month: string
          optin_closes_at: string
          optin_opens_at: string
          price_paise: number
          serve_end: string
          serve_start: string
          status: Database["public"]["Enums"]["cycle_status"]
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          billing_basis?: Database["public"]["Enums"]["billing_basis"]
          created_at?: string
          enforce_serving_window?: boolean
          id?: string
          month: string
          optin_closes_at: string
          optin_opens_at: string
          price_paise: number
          serve_end?: string
          serve_start?: string
          status?: Database["public"]["Enums"]["cycle_status"]
          updated_at?: string
          weekdays: number[]
        }
        Update: {
          billing_basis?: Database["public"]["Enums"]["billing_basis"]
          created_at?: string
          enforce_serving_window?: boolean
          id?: string
          month?: string
          optin_closes_at?: string
          optin_opens_at?: string
          price_paise?: number
          serve_end?: string
          serve_start?: string
          status?: Database["public"]["Enums"]["cycle_status"]
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          employee_id: string
          id: string
          method: Database["public"]["Enums"]["serve_method"]
          served_at: string
          served_by: string | null
          served_on: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          employee_id: string
          id?: string
          method?: Database["public"]["Enums"]["serve_method"]
          served_at?: string
          served_by?: string | null
          served_on: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          employee_id?: string
          id?: string
          method?: Database["public"]["Enums"]["serve_method"]
          served_at?: string
          served_by?: string | null
          served_on?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "meal_logs_served_by_fkey"
            columns: ["served_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_served_by_fkey"
            columns: ["served_by"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "meal_logs_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          employee_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          employee_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          employee_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_bill"
            referencedColumns: ["employee_id"]
          },
        ]
      }
    }
    Views: {
      v_cycle_overview: {
        Row: {
          billing_basis: Database["public"]["Enums"]["billing_basis"] | null
          holidays: number | null
          id: string | null
          lunch_days: number | null
          month: string | null
          opted_in: number | null
          optin_close_date: string | null
          optin_closes_at: string | null
          optin_open_date: string | null
          optin_opens_at: string | null
          price_paise: number | null
          serve_end: string | null
          serve_start: string | null
          status: Database["public"]["Enums"]["cycle_status"] | null
          weekdays: number[] | null
        }
        Insert: {
          billing_basis?: Database["public"]["Enums"]["billing_basis"] | null
          holidays?: never
          id?: string | null
          lunch_days?: never
          month?: string | null
          opted_in?: never
          optin_close_date?: never
          optin_closes_at?: string | null
          optin_open_date?: never
          optin_opens_at?: string | null
          price_paise?: number | null
          serve_end?: string | null
          serve_start?: string | null
          status?: Database["public"]["Enums"]["cycle_status"] | null
          weekdays?: number[] | null
        }
        Update: {
          billing_basis?: Database["public"]["Enums"]["billing_basis"] | null
          holidays?: never
          id?: string | null
          lunch_days?: never
          month?: string | null
          opted_in?: never
          optin_close_date?: never
          optin_closes_at?: string | null
          optin_open_date?: never
          optin_opens_at?: string | null
          price_paise?: number | null
          serve_end?: string | null
          serve_start?: string | null
          status?: Database["public"]["Enums"]["cycle_status"] | null
          weekdays?: number[] | null
        }
        Relationships: []
      }
      v_lunch_days: {
        Row: {
          cycle_id: string | null
          day: string | null
        }
        Relationships: []
      }
      v_monthly_bill: {
        Row: {
          billing_basis: Database["public"]["Enums"]["billing_basis"] | null
          consumed_days: number | null
          cycle_id: string | null
          department: string | null
          emp_code: string | null
          employee_id: string | null
          month: string | null
          name: string | null
          opted_days: number | null
          opted_days_to_date: number | null
          payable_paise: number | null
          price_paise: number | null
          status: Database["public"]["Enums"]["employee_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_audit_log: {
        Args: {
          p_before_id?: number
          p_category?: string
          p_from?: string
          p_limit?: number
          p_q?: string
          p_to?: string
        }
        Returns: {
          action: string
          actor_code: string
          actor_name: string
          after: Json
          at: string
          before: Json
          cycle_month: string
          entity: string
          entity_id: string
          id: number
          reason: string
          subject_code: string
          subject_name: string
        }[]
      }
      admin_override_enrollment: {
        Args: {
          p_cycle_id: string
          p_employee_id: string
          p_opted_in: boolean
          p_reason: string
        }
        Returns: undefined
      }
      admin_record_meal: {
        Args: { p_day: string; p_emp_code: string; p_reason: string }
        Returns: Json
      }
      admin_save_cycle: {
        Args: {
          p_id: string
          p_month: string
          p_open?: boolean
          p_optin_close: string
          p_optin_open: string
          p_price_paise: number
          p_serve_end?: string
          p_serve_start?: string
          p_weekdays: number[]
        }
        Returns: Json
      }
      admin_save_employee: {
        Args: {
          p_department: string
          p_email: string
          p_emp_code: string
          p_id: string
          p_name: string
          p_roles: Database["public"]["Enums"]["app_role"][]
          p_status: Database["public"]["Enums"]["employee_status"]
        }
        Returns: Json
      }
      admin_save_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      admin_set_holiday: {
        Args: {
          p_cycle_id: string
          p_day: string
          p_is_holiday: boolean
          p_label?: string
          p_reason?: string
        }
        Returns: undefined
      }
      admin_update_cycle: {
        Args: { p_changes: Json; p_cycle_id: string; p_reason: string }
        Returns: undefined
      }
      admin_void_meal: {
        Args: { p_meal_id: string; p_reason: string }
        Returns: undefined
      }
      counter_counts: { Args: { p_day?: string }; Returns: Json }
      counter_recent: {
        Args: { p_limit?: number }
        Returns: {
          department: string
          emp_code: string
          name: string
          served_at: string
        }[]
      }
      counter_today: {
        Args: { p_day?: string }
        Returns: {
          department: string
          emp_code: string
          expected: boolean
          meal_id: string
          method: string
          name: string
          served_at: string
        }[]
      }
      import_employees: {
        Args: { p_dry_run?: boolean; p_rows: Json }
        Returns: Json
      }
      my_history: { Args: { p_cycle_id?: string }; Returns: Json }
      my_home: { Args: never; Returns: Json }
      search_employees_for_counter: {
        Args: { p_day?: string; p_q: string }
        Returns: {
          department: string
          eligible: boolean
          emp_code: string
          name: string
          served: boolean
        }[]
      }
      set_cycle_status: {
        Args: {
          p_cycle_id: string
          p_status: Database["public"]["Enums"]["cycle_status"]
        }
        Returns: undefined
      }
      set_my_enrollment: {
        Args: { p_cycle_id: string; p_opted_in: boolean }
        Returns: Json
      }
      verify_and_serve: {
        Args: {
          p_day?: string
          p_emp_code: string
          p_mark?: boolean
          p_method?: Database["public"]["Enums"]["serve_method"]
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "verifier"
      billing_basis: "opted" | "consumed"
      cycle_status: "draft" | "open" | "closed" | "locked"
      employee_status: "active" | "inactive"
      enroll_source: "self" | "admin_override"
      serve_method: "code" | "scan" | "name" | "paper"
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
      app_role: ["admin", "verifier"],
      billing_basis: ["opted", "consumed"],
      cycle_status: ["draft", "open", "closed", "locked"],
      employee_status: ["active", "inactive"],
      enroll_source: ["self", "admin_override"],
      serve_method: ["code", "scan", "name", "paper"],
    },
  },
} as const
