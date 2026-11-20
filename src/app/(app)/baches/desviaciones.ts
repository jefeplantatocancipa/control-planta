// Helper compartido para registrar una desviación (tiempo de etapa o
// receta de insumos) y su entrada automática en Bitácora. No es un Server
// Action en sí mismo -- lo llama finishStage (actions.ts) después de haber
// cerrado la etapa, nunca antes ni condicionando el cierre.
import type { SupabaseClient } from "@supabase/supabase-js";
import { turnoActualId } from "@/lib/turno-actual";
import type { Database, DesviacionMotivo, DesviacionTipo } from "@/lib/supabase/types";

const MOTIVO_LABELS: Record<DesviacionMotivo, string> = {
  falla_equipo: "falla de equipo",
  espera_insumos: "espera de insumos",
  espera_leche: "espera de leche",
  ajuste_proceso: "ajuste de proceso",
  error_registro: "error de registro",
  otro: "otro",
};

export interface RegistrarDesviacionInput {
  bacheId: string;
  batchCode: string;
  stageRecordId: string;
  stageName: string;
  tipo: DesviacionTipo;
  insumoId?: string | null;
  insumoNombre?: string | null;
  unidad: "min" | "kg";
  valorReal: number;
  valorEsperado: number | null;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  motivo: DesviacionMotivo;
  descripcion: string;
  createdBy: string;
}

function textoBitacora(input: RegistrarDesviacionInput) {
  const rango =
    input.limiteInferior != null && input.limiteSuperior != null
      ? ` (rango ${round(input.limiteInferior)}–${round(input.limiteSuperior)} ${input.unidad})`
      : "";
  const esperado =
    input.valorEsperado != null
      ? `estándar ${round(input.valorEsperado)} ${input.unidad}${rango}`
      : "sin estándar configurado";
  const sujeto =
    input.tipo === "tiempo"
      ? `bache ${input.batchCode}, etapa ${input.stageName}`
      : `bache ${input.batchCode}, etapa ${input.stageName}, insumo ${input.insumoNombre ?? "—"}`;
  const tituloTipo = input.tipo === "tiempo" ? "Desviación de tiempo" : "Desviación de receta";
  return (
    `${tituloTipo} — ${sujeto}: ${round(input.valorReal)} ${input.unidad} (${esperado}). ` +
    `Motivo: ${MOTIVO_LABELS[input.motivo]}. ${input.descripcion}`
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

// No revierte nada si falla: la etapa ya quedó cerrada antes de llamar esto,
// y los controles de desviación nunca deben bloquear producción. En el peor
// caso, la desviación o la nota de bitácora no quedan guardadas.
export async function registrarDesviacion(
  supabase: SupabaseClient<Database>,
  input: RegistrarDesviacionInput,
): Promise<void> {
  const { data: turnos } = await supabase
    .from("turnos")
    .select("id, hora_inicio, hora_fin, active")
    .eq("active", true);
  const turnoId = turnoActualId(turnos ?? []);

  const { data: desviacion, error } = await supabase
    .from("desviaciones")
    .insert({
      bache_id: input.bacheId,
      stage_record_id: input.stageRecordId,
      tipo: input.tipo,
      insumo_id: input.insumoId || null,
      valor_real: input.valorReal,
      valor_esperado: input.valorEsperado,
      limite_inferior: input.limiteInferior,
      limite_superior: input.limiteSuperior,
      motivo: input.motivo,
      descripcion: input.descripcion,
      turno_id: turnoId,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error || !desviacion) return;

  const { data: entrada } = await supabase
    .from("bitacora_entradas")
    .insert({
      tipo: "novedad",
      turno_id: turnoId,
      equipo_id: null,
      bache_id: input.bacheId,
      texto: textoBitacora(input),
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (!entrada) return;

  await supabase
    .from("desviaciones")
    .update({ bitacora_entrada_id: entrada.id })
    .eq("id", desviacion.id);
}
