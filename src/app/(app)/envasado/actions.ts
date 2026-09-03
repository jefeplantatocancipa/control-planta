"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NO_ORDER_VALUE } from "./constants";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const StartEnvasadoSchema = z.object({
  bache_id: z.string().uuid({ message: "Elegí un bache." }),
  operario_id: z.string().uuid({ message: "Elegí quién realiza el envasado." }),
  envasado_order_id: z.string().uuid().nullable(),
  presentacion: z.string().trim().min(1, "La presentación es obligatoria."),
  insumos_observacion: z.string().trim().optional(),
});

const InsumoUsoSchema = z.object({
  envasado_insumo_id: z.string().uuid(),
  lote: z.string().trim().optional(),
  fecha_vencimiento: z.string().trim().optional(),
  proveedor: z.string().trim().optional(),
  cantidad_usada: z.coerce.number().optional(),
  unidad_medida: z.string().trim().optional(),
  desperdicio: z.coerce.number().optional(),
});

const InsumosUsoArraySchema = z
  .array(InsumoUsoSchema)
  .min(1, "Marcá al menos un insumo de envasado.");

export async function startEnvasado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const orderId = formData.get("envasado_order_id");
  const parsed = StartEnvasadoSchema.safeParse({
    bache_id: formData.get("bache_id"),
    operario_id: formData.get("operario_id"),
    envasado_order_id: orderId && orderId !== NO_ORDER_VALUE ? orderId : null,
    presentacion: formData.get("presentacion"),
    insumos_observacion: formData.get("insumos_observacion") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const insumosParsed = InsumosUsoArraySchema.safeParse(
    JSON.parse(String(formData.get("insumos_uso") || "[]")),
  );
  if (!insumosParsed.success) {
    return {
      error: insumosParsed.error.issues[0]?.message ?? "Insumos inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("envasados")
    .insert({
      bache_id: parsed.data.bache_id,
      operario_id: parsed.data.operario_id,
      envasado_order_id: parsed.data.envasado_order_id,
      presentacion: parsed.data.presentacion,
      insumos_observacion: parsed.data.insumos_observacion || null,
      cantidad_unidades: 0,
      cantidad_mermas: 0,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "No se pudo iniciar el envasado." };
  }

  const { error: insumosError } = await supabase.from("envasado_insumos_uso").insert(
    insumosParsed.data.map((i) => ({
      envasado_id: created.id,
      envasado_insumo_id: i.envasado_insumo_id,
      lote: i.lote || null,
      fecha_vencimiento: i.fecha_vencimiento || null,
      proveedor: i.proveedor || null,
      cantidad_usada: i.cantidad_usada ?? null,
      unidad_medida: i.unidad_medida || null,
      desperdicio: i.desperdicio ?? null,
    })),
  );

  if (insumosError) {
    return {
      error: "El envasado se inició, pero no se pudieron guardar los insumos.",
    };
  }

  revalidatePath("/envasado");
  return { success: true };
}

const SaveEnvasadoSchema = z.object({
  record_id: z.string().uuid(),
  cantidad_unidades: z.coerce
    .number()
    .min(0, "La cantidad no puede ser negativa."),
  cantidad_mermas: z.coerce.number().min(0, "Las mermas no pueden ser negativas."),
  notes: z.string().trim().optional(),
  finalize: z.enum(["true", "false"]),
});

export async function saveEnvasado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = SaveEnvasadoSchema.safeParse({
    record_id: formData.get("record_id"),
    cantidad_unidades: formData.get("cantidad_unidades"),
    cantidad_mermas: formData.get("cantidad_mermas") || 0,
    notes: formData.get("notes"),
    finalize: formData.get("finalize"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("envasados")
    .update({
      cantidad_unidades: parsed.data.cantidad_unidades,
      cantidad_mermas: parsed.data.cantidad_mermas,
      notes: parsed.data.notes || null,
      ended_at: parsed.data.finalize === "true" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.record_id);

  if (error) {
    return { error: "No se pudo guardar el envasado." };
  }

  revalidatePath("/envasado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Corte de turno: checkpoint de calidad y unidades por turno (A/B/C)
// ---------------------------------------------------------------------------
const CorteTurnoSchema = z
  .object({
    envasado_id: z.string().uuid(),
    turno_id: z.string().uuid({ message: "Elegí un turno." }),
    operario_id: z.string().uuid({ message: "Elegí el operario responsable." }),
    operario_2_id: z.string().uuid().nullable(),
    unidades_inicio: z.coerce
      .number()
      .min(0, "Las unidades de inicio no pueden ser negativas."),
    unidades_final: z.coerce
      .number()
      .min(0, "Las unidades finales no pueden ser negativas."),
    sellado_cumple: z.enum(["true", "false"]),
    lote_marcado: z.enum(["C", "NC"]),
    peso_1: z.coerce.number().positive().optional(),
    peso_2: z.coerce.number().positive().optional(),
    peso_3: z.coerce.number().positive().optional(),
    observaciones: z.string().trim().optional(),
  })
  .refine((data) => data.unidades_final >= data.unidades_inicio, {
    message: "Las unidades finales no pueden ser menores a las iniciales.",
    path: ["unidades_final"],
  });

export async function addCorteTurno(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const operario2 = formData.get("operario_2_id");
  const parsed = CorteTurnoSchema.safeParse({
    envasado_id: formData.get("envasado_id"),
    turno_id: formData.get("turno_id"),
    operario_id: formData.get("operario_id"),
    operario_2_id: operario2 && operario2 !== NO_ORDER_VALUE ? operario2 : null,
    unidades_inicio: formData.get("unidades_inicio"),
    unidades_final: formData.get("unidades_final"),
    sellado_cumple: formData.get("sellado_cumple"),
    lote_marcado: formData.get("lote_marcado"),
    peso_1: formData.get("peso_1") || undefined,
    peso_2: formData.get("peso_2") || undefined,
    peso_3: formData.get("peso_3") || undefined,
    observaciones: formData.get("observaciones"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("envasado_cortes").insert({
    envasado_id: parsed.data.envasado_id,
    turno_id: parsed.data.turno_id,
    operario_id: parsed.data.operario_id,
    operario_2_id: parsed.data.operario_2_id,
    unidades_inicio: parsed.data.unidades_inicio,
    unidades_final: parsed.data.unidades_final,
    sellado_cumple: parsed.data.sellado_cumple === "true",
    lote_marcado: parsed.data.lote_marcado,
    peso_1: parsed.data.peso_1 ?? null,
    peso_2: parsed.data.peso_2 ?? null,
    peso_3: parsed.data.peso_3 ?? null,
    observaciones: parsed.data.observaciones || null,
    created_by: profile.id,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya se registró un corte para ese turno hoy."
          : "No se pudo guardar el corte.",
    };
  }

  revalidatePath("/envasado");
  return { success: true };
}
