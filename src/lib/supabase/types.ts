// Tipos generados a mano a partir de supabase/migrations/*.sql.
// Cuando el proyecto Supabase esté enlazado, se pueden regenerar con:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type UserRole = "jefe_planta" | "supervisor" | "operario";
export type ProcessType = "bache";
export type ProgramStatus = "borrador" | "publicado" | "cerrado";
export type OrderStatus = "pendiente" | "en_proceso" | "completado" | "cancelado";
export type BacheStatus = "en_proceso" | "completado" | "cancelado";

export interface StageParameterDef {
  key: string;
  label: string;
  type: "number" | "text";
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          active?: boolean;
        };
        Update: Partial<{
          full_name: string;
          role: UserRole;
          active: boolean;
        }>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          code: string;
          name: string;
          unit: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          unit?: string;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      process_stage_templates: {
        Row: {
          id: string;
          product_id: string | null;
          process_type: ProcessType;
          name: string;
          sequence_order: number;
          parameter_schema: StageParameterDef[];
          active: boolean;
          created_at: string;
        };
        Insert: {
          product_id?: string | null;
          process_type?: ProcessType;
          name: string;
          sequence_order: number;
          parameter_schema?: StageParameterDef[];
          active?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["process_stage_templates"]["Insert"]
        >;
        Relationships: [];
      };
      production_programs: {
        Row: {
          id: string;
          week_start_date: string;
          status: ProgramStatus;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          week_start_date: string;
          status?: ProgramStatus;
          notes?: string | null;
          created_by: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["production_programs"]["Insert"]
        >;
        Relationships: [];
      };
      production_orders: {
        Row: {
          id: string;
          program_id: string;
          product_id: string;
          scheduled_date: string;
          planned_quantity: number;
          unit: string;
          status: OrderStatus;
          created_at: string;
        };
        Insert: {
          program_id: string;
          product_id: string;
          scheduled_date: string;
          planned_quantity: number;
          unit?: string;
          status?: OrderStatus;
        };
        Update: Partial<
          Database["public"]["Tables"]["production_orders"]["Insert"]
        >;
        Relationships: [];
      };
      baches: {
        Row: {
          id: string;
          production_order_id: string | null;
          product_id: string;
          batch_code: string;
          status: BacheStatus;
          volumen_total_litros: number | null;
          started_at: string;
          completed_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          production_order_id?: string | null;
          product_id: string;
          batch_code: string;
          status?: BacheStatus;
          volumen_total_litros?: number | null;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["baches"]["Insert"]> & {
          completed_at?: string | null;
        };
        Relationships: [];
      };
      bache_stage_records: {
        Row: {
          id: string;
          bache_id: string;
          stage_template_id: string;
          operario_id: string;
          started_at: string;
          ended_at: string | null;
          parameters: Record<string, string | number>;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          bache_id: string;
          stage_template_id: string;
          operario_id: string;
          started_at?: string;
          ended_at?: string | null;
          parameters?: Record<string, string | number>;
          notes?: string | null;
          created_by: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["bache_stage_records"]["Insert"]
        >;
        Relationships: [];
      };
      envasados: {
        Row: {
          id: string;
          bache_id: string;
          operario_id: string;
          presentacion: string;
          cantidad_unidades: number;
          cantidad_mermas: number;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          bache_id: string;
          operario_id: string;
          presentacion: string;
          cantidad_unidades: number;
          cantidad_mermas?: number;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["envasados"]["Insert"]>;
        Relationships: [];
      };
      vasos_enmangados: {
        Row: {
          id: string;
          envasado_id: string;
          operario_id: string;
          lote_etiqueta: string | null;
          cantidad_unidades: number;
          cantidad_mermas: number;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          envasado_id: string;
          operario_id: string;
          lote_etiqueta?: string | null;
          cantidad_unidades: number;
          cantidad_mermas?: number;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_by: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["vasos_enmangados"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      v_proceso_actual: {
        Row: {
          bache_id: string;
          batch_code: string;
          product_id: string;
          product_name: string;
          bache_status: BacheStatus;
          bache_started_at: string;
          stage_id: string | null;
          stage_name: string | null;
          sequence_order: number | null;
          stage_record_id: string | null;
          operario_id: string | null;
          operario_name: string | null;
          stage_started_at: string | null;
          stage_ended_at: string | null;
          parameters: Record<string, string | number> | null;
        };
        Relationships: [];
      };
      v_cumplimiento_programa: {
        Row: {
          production_order_id: string;
          program_id: string;
          week_start_date: string;
          scheduled_date: string;
          product_id: string;
          product_name: string;
          planned_quantity: number;
          unit: string;
          executed_quantity: number;
          cumplimiento_pct: number;
        };
        Relationships: [];
      };
      v_estadisticas_operario: {
        Row: {
          operario_id: string;
          operario_name: string;
          stage_id: string;
          stage_name: string;
          etapas_completadas: number;
          duracion_promedio_min: number | null;
        };
        Relationships: [];
      };
      v_estadisticas_envasado_operario: {
        Row: {
          operario_id: string;
          operario_name: string;
          eventos_envasado: number;
          total_unidades: number;
          total_mermas: number;
          tasa_merma_pct: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
