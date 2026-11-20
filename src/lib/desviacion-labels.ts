import type { DesviacionMotivo } from "@/lib/supabase/types";

export const DESVIACION_MOTIVO_LABELS: Record<DesviacionMotivo, string> = {
  falla_equipo: "Falla de equipo",
  espera_insumos: "Espera de insumos",
  espera_leche: "Espera de leche",
  ajuste_proceso: "Ajuste de proceso",
  error_registro: "Error de registro",
  otro: "Otro",
};
