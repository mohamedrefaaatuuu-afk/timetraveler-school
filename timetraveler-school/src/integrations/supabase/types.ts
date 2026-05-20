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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json | null
          school_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
          school_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          double_period: boolean
          id: string
          school_id: string
          subject_id: string
          teacher_id: string | null
          weekly_count: number
        }
        Insert: {
          class_id: string
          created_at?: string
          double_period?: boolean
          id?: string
          school_id: string
          subject_id: string
          teacher_id?: string | null
          weekly_count?: number
        }
        Update: {
          class_id?: string
          created_at?: string
          double_period?: boolean
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string | null
          weekly_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          daily_lessons: number
          grade_level: number | null
          home_classroom_id: string | null
          id: string
          name: string
          school_id: string
          stage: Database["public"]["Enums"]["education_stage"]
          students_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_lessons?: number
          grade_level?: number | null
          home_classroom_id?: string | null
          id?: string
          name: string
          school_id: string
          stage?: Database["public"]["Enums"]["education_stage"]
          students_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_lessons?: number
          grade_level?: number | null
          home_classroom_id?: string | null
          id?: string
          name?: string
          school_id?: string
          stage?: Database["public"]["Enums"]["education_stage"]
          students_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_home_classroom_fk"
            columns: ["home_classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          capacity: number
          created_at: string
          equipment: string[] | null
          id: string
          name: string
          school_id: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["classroom_type"]
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          equipment?: string[] | null
          id?: string
          name: string
          school_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["classroom_type"]
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          equipment?: string[] | null
          id?: string
          name?: string
          school_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["classroom_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read_at: string | null
          school_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read_at?: string | null
          school_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read_at?: string | null
          school_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          class_id: string
          classroom_id: string | null
          created_at: string
          day: Database["public"]["Enums"]["day_of_week"]
          id: string
          is_locked: boolean
          period_no: number
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          classroom_id?: string | null
          created_at?: string
          day: Database["public"]["Enums"]["day_of_week"]
          id?: string
          is_locked?: boolean
          period_no: number
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          classroom_id?: string | null
          created_at?: string
          day?: Database["public"]["Enums"]["day_of_week"]
          id?: string
          is_locked?: boolean
          period_no?: number
          school_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_constraints: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          priority: Database["public"]["Enums"]["constraint_priority"]
          school_id: string
          type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["constraint_priority"]
          school_id: string
          type: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["constraint_priority"]
          school_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_constraints_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          break_after_period: number | null
          break_duration_min: number
          first_period_start: string
          period_duration_min: number
          periods_per_day: number
          school_id: string
          updated_at: string
          working_days: Database["public"]["Enums"]["day_of_week"][]
        }
        Insert: {
          break_after_period?: number | null
          break_duration_min?: number
          first_period_start?: string
          period_duration_min?: number
          periods_per_day?: number
          school_id: string
          updated_at?: string
          working_days?: Database["public"]["Enums"]["day_of_week"][]
        }
        Update: {
          break_after_period?: number | null
          break_duration_min?: number
          first_period_start?: string
          period_duration_min?: number
          periods_per_day?: number
          school_id?: string
          updated_at?: string
          working_days?: Database["public"]["Enums"]["day_of_week"][]
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          code: string | null
          color: string
          created_at: string
          double_period: boolean
          id: string
          is_core: boolean
          name: string
          needs_lab: boolean
          priority: number
          school_id: string
          stage: Database["public"]["Enums"]["education_stage"] | null
          updated_at: string
          weekly_lessons: number
        }
        Insert: {
          code?: string | null
          color?: string
          created_at?: string
          double_period?: boolean
          id?: string
          is_core?: boolean
          name: string
          needs_lab?: boolean
          priority?: number
          school_id: string
          stage?: Database["public"]["Enums"]["education_stage"] | null
          updated_at?: string
          weekly_lessons?: number
        }
        Update: {
          code?: string | null
          color?: string
          created_at?: string
          double_period?: boolean
          id?: string
          is_core?: boolean
          name?: string
          needs_lab?: boolean
          priority?: number
          school_id?: string
          stage?: Database["public"]["Enums"]["education_stage"] | null
          updated_at?: string
          weekly_lessons?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          absence_date: string
          created_at: string
          id: string
          original_teacher_id: string
          reason: string | null
          schedule_entry_id: string
          school_id: string
          status: string
          substitute_teacher_id: string | null
        }
        Insert: {
          absence_date: string
          created_at?: string
          id?: string
          original_teacher_id: string
          reason?: string | null
          schedule_entry_id: string
          school_id: string
          status?: string
          substitute_teacher_id?: string | null
        }
        Update: {
          absence_date?: string
          created_at?: string
          id?: string
          original_teacher_id?: string
          reason?: string | null
          schedule_entry_id?: string
          school_id?: string
          status?: string
          substitute_teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_original_teacher_id_fkey"
            columns: ["original_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_schedule_entry_id_fkey"
            columns: ["schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_substitute_teacher_id_fkey"
            columns: ["substitute_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subjects: {
        Row: {
          subject_id: string
          teacher_id: string
        }
        Insert: {
          subject_id: string
          teacher_id: string
        }
        Update: {
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_unavailability: {
        Row: {
          day: Database["public"]["Enums"]["day_of_week"]
          id: string
          period_no: number
          reason: string | null
          teacher_id: string
        }
        Insert: {
          day: Database["public"]["Enums"]["day_of_week"]
          id?: string
          period_no: number
          reason?: string | null
          teacher_id: string
        }
        Update: {
          day?: Database["public"]["Enums"]["day_of_week"]
          id?: string
          period_no?: number
          reason?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_unavailability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          employee_no: string | null
          full_name: string
          id: string
          max_daily_lessons: number
          max_weekly_lessons: number
          phone: string | null
          school_id: string
          specialization: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string | null
          working_days: Database["public"]["Enums"]["day_of_week"][]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          employee_no?: string | null
          full_name: string
          id?: string
          max_daily_lessons?: number
          max_weekly_lessons?: number
          phone?: string | null
          school_id: string
          specialization?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string | null
          working_days?: Database["public"]["Enums"]["day_of_week"][]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          employee_no?: string | null
          full_name?: string
          id?: string
          max_daily_lessons?: number
          max_weekly_lessons?: number
          phone?: string | null
          school_id?: string
          specialization?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string | null
          working_days?: Database["public"]["Enums"]["day_of_week"][]
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_school: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_school_manager: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "principal" | "scheduler" | "teacher"
      classroom_type:
        | "classroom"
        | "lab"
        | "gym"
        | "workshop"
        | "library"
        | "other"
      constraint_priority: "low" | "medium" | "high" | "must"
      day_of_week:
        | "sunday"
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
      education_stage: "primary" | "preparatory" | "secondary"
      entity_status: "active" | "inactive"
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
      app_role: ["admin", "principal", "scheduler", "teacher"],
      classroom_type: [
        "classroom",
        "lab",
        "gym",
        "workshop",
        "library",
        "other",
      ],
      constraint_priority: ["low", "medium", "high", "must"],
      day_of_week: [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ],
      education_stage: ["primary", "preparatory", "secondary"],
      entity_status: ["active", "inactive"],
    },
  },
} as const
