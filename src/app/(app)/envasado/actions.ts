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

const FinalizarEnvasadoSchema = z.object({
  record_id: z.string().uuid(),
});

export async function finalizarEnvasado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = FinalizarEnvasadoSchema.safeParse({
    record_id: formData.get("record_id"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: activo } = await supabase
    .from("envasado_cortes")
    .select("id")
    .eq("envasado_id", parsed.data.record_id)
    .is("ended_at", null)
    .limit(1);
  if (activo && activo.length > 0) {
    return { error: "Finalizá el turno activo antes de cerrar el envasado." };
  }

  // Las unidades totales son la suma de lo que dio cada estiba (dato real,
  // contado), no la resta de los contadores de inicio/final del turno. Las
  // mermas sí son la suma del desperdicio que dejó cada turno.
  const { data: cortes } = await supabase
    .from("envasado_cortes")
    .select("id, desperdicio")
    .eq("envasado_id", parsed.data.record_id)
    .not("ended_at", "is", null);

  const corteIds = (cortes ?? []).map((c) => c.id);
  const { data: estibas } =
    corteIds.length > 0
      ? await supabase
          .from("envasado_estibas")
          .select("unidades_por_estiba")
          .in("corte_id", corteIds)
      : { data: [] };

  const cantidad_unidades = (estibas ?? []).reduce(
    (sum, e) => sum + (e.unidades_por_estiba ?? 0),
    0,
  );
  const cantidad_mermas = (cortes ?? []).reduce((sum, c) => sum + (c.desperdicio ?? 0), 0);

  const { error } = await supabase
    .from("envasados")
    .update({
      cantidad_unidades,
      cantidad_mermas,
      ended_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.record_id);

  if (error) {
    return { error: "No se pudo finalizar el envasado." };
  }

  revalidatePath("/envasado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Turno: inicio y fin (como iniciar/finalizar una etapa). Mientras está
// activo (sin ended_at) se le van agregando lecturas de calidad y ciclos
// de estiba por separado.
// ---------------------------------------------------------------------------
const IniciarTurnoSchema = z.object({
  envasado_id: z.string().uuid(),
  turno_id: z.string().uuid({ message: "Elegí un turno." }),
  operario_id: z.string().uuid({ message: "Elegí el operario responsable." }),
  operario_2_id: z.string().uuid().nullable(),
  unidades_inicio: z.coerce
    .number()
    .min(0, "Las unidades de inicio no pueden ser negativas."),
});

export async function iniciarCorteTurno(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const operario2 = formData.get("operario_2_id");
  const parsed = IniciarTurnoSchema.safeParse({
    envasado_id: formData.get("envasado_id"),
    turno_id: formData.get("turno_id"),
    operario_id: formData.get("operario_id"),
    operario_2_id: operario2 && operario2 !== NO_ORDER_VALUE ? operario2 : null,
    unidades_inicio: formData.get("unidades_inicio"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: activo } = await supabase
    .from("envasado_cortes")
    .select("id")
    .eq("envasado_id", parsed.data.envasado_id)
    .is("ended_at", null)
    .limit(1);
  if (activo && activo.length > 0) {
    return { error: "Ya hay un turno activo. Finalizalo antes de iniciar otro." };
  }

  const { error } = await supabase.from("envasado_cortes").insert({
    envasado_id: parsed.data.envasado_id,
    turno_id: parsed.data.turno_id,
    operario_id: parsed.data.operario_id,
    operario_2_id: parsed.data.operario_2_id,
    unidades_inicio: parsed.data.unidades_inicio,
    created_by: profile.id,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya se registró un turno de esa franja horaria hoy."
          : "No se pudo iniciar el turno.",
    };
  }

  revalidatePath("/envasado");
  return { success: true };
}

const FinalizarTurnoSchema = z
  .object({
    corte_id: z.string().uuid(),
    unidades_inicio: z.coerce.number(),
    unidades_final: z.coerce
      .number()
      .min(0, "Las unidades finales no pueden ser negativas."),
    desperdicio: z.coerce.number().min(0).optional(),
    observaciones: z.string().trim().optional(),
  })
  .refine((data) => data.unidades_final >= data.unidades_inicio, {
    message: "Las unidades finales no pueden ser menores a las iniciales.",
    path: ["unidades_final"],
  });

export async function finalizarCorteTurno(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = FinalizarTurnoSchema.safeParse({
    corte_id: formData.get("corte_id"),
    unidades_inicio: formData.get("unidades_inicio"),
    unidades_final: formData.get("unidades_final"),
    desperdicio: formData.get("desperdicio") || undefined,
    observaciones: formData.get("observaciones"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("envasado_cortes")
    .update({
      ended_at: new Date().toISOString(),
      unidades_final: parsed.data.unidades_final,
      desperdicio: parsed.data.desperdicio ?? null,
      observaciones: parsed.data.observaciones || null,
    })
    .eq("id", parsed.data.corte_id);

  if (error) {
    return { error: "No se pudo finalizar el turno." };
  }

  revalidatePath("/envasado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Lecturas de calidad (peso neto de 3 unidades, sellado, fechado): se van
// agregando cada hora mientras el turno está activo.
// ---------------------------------------------------------------------------
const CalidadLecturaSchema = z.object({
  corte_id: z.string().uuid(),
  peso_1: z.coerce.number().positive().optional(),
  peso_2: z.coerce.number().positive().optional(),
  peso_3: z.coerce.number().positive().optional(),
  sellado_cumple: z.enum(["true", "false"]),
  fechado_cumple: z.enum(["true", "false"]),
  observaciones: z.string().trim().optional(),
});

export async function addCalidadLectura(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = CalidadLecturaSchema.safeParse({
    corte_id: formData.get("corte_id"),
    peso_1: formData.get("peso_1") || undefined,
    peso_2: formData.get("peso_2") || undefined,
    peso_3: formData.get("peso_3") || undefined,
    sellado_cumple: formData.get("sellado_cumple"),
    fechado_cumple: formData.get("fechado_cumple"),
    observaciones: formData.get("observaciones"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("envasado_calidad_lecturas").insert({
    corte_id: parsed.data.corte_id,
    peso_1: parsed.data.peso_1 ?? null,
    peso_2: parsed.data.peso_2 ?? null,
    peso_3: parsed.data.peso_3 ?? null,
    sellado_cumple: parsed.data.sellado_cumple === "true",
    fechado_cumple: parsed.data.fechado_cumple === "true",
    observaciones: parsed.data.observaciones || null,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo guardar la lectura." };
  }

  revalidatePath("/envasado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Estibas: cuánto se demora armando cada estiba, con sus unidades. Solo
// puede haber una estiba abierta a la vez por turno.
// ---------------------------------------------------------------------------
const IniciarEstibaSchema = z.object({
  corte_id: z.string().uuid(),
});

export async function iniciarEstiba(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = IniciarEstibaSchema.safeParse({
    corte_id: formData.get("corte_id"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: abierta } = await supabase
    .from("envasado_estibas")
    .select("id")
    .eq("corte_id", parsed.data.corte_id)
    .is("final_estiba", null)
    .limit(1);
  if (abierta && abierta.length > 0) {
    return { error: "Ya hay una estiba en curso. Finalizala antes de iniciar otra." };
  }

  const { error } = await supabase.from("envasado_estibas").insert({
    corte_id: parsed.data.corte_id,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo iniciar la estiba." };
  }

  revalidatePath("/envasado");
  return { success: true };
}

const FinalizarEstibaSchema = z.object({
  estiba_id: z.string().uuid(),
  unidades_por_estiba: z.coerce
    .number()
    .positive("Las unidades de la estiba deben ser mayores a 0."),
});

export async function finalizarEstiba(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = FinalizarEstibaSchema.safeParse({
    estiba_id: formData.get("estiba_id"),
    unidades_por_estiba: formData.get("unidades_por_estiba"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("envasado_estibas")
    .update({
      final_estiba: new Date().toISOString(),
      unidades_por_estiba: parsed.data.unidades_por_estiba,
    })
    .eq("id", parsed.data.estiba_id);

  if (error) {
    return { error: "No se pudo finalizar la estiba." };
  }

  revalidatePath("/envasado");
  return { success: true };
}
