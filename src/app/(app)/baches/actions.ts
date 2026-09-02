"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NO_ORDER_VALUE } from "./constants";
import type { StageRecordParameters, StageReading } from "@/lib/supabase/types";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

// ---------------------------------------------------------------------------
// Bache
// ---------------------------------------------------------------------------
const BacheSchema = z.object({
  product_id: z.string().uuid({ message: "Elegí un producto." }),
  batch_code: z.string().trim().min(1, "El código de lote es obligatorio."),
  production_order_id: z.string().uuid().nullable(),
  volumen_total_litros: z.coerce.number().positive().nullable(),
});

export async function createBache(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const orderId = formData.get("production_order_id");
  const volumen = formData.get("volumen_total_litros");
  const parsed = BacheSchema.safeParse({
    product_id: formData.get("product_id"),
    batch_code: formData.get("batch_code"),
    production_order_id: orderId && orderId !== NO_ORDER_VALUE ? orderId : null,
    volumen_total_litros: volumen || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("baches")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe un bache con ese código de lote."
        : "No se pudo crear el bache.",
    };
  }

  revalidatePath("/baches");
  redirect(`/baches/${data.id}`);
}

const BacheStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["completado", "cancelado"]),
});

export async function updateBacheStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = BacheStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("baches")
    .update({
      status: parsed.data.status,
      completed_at:
        parsed.data.status === "completado" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo actualizar el bache." };
  }

  revalidatePath(`/baches/${parsed.data.id}`);
  revalidatePath("/baches");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Etapas del bache
// ---------------------------------------------------------------------------
const StartStageSchema = z.object({
  bache_id: z.string().uuid(),
  stage_template_id: z.string().uuid(),
  operario_id: z.string().uuid({ message: "Elegí quién realiza la etapa." }),
});

export async function startStage(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = StartStageSchema.safeParse({
    bache_id: formData.get("bache_id"),
    stage_template_id: formData.get("stage_template_id"),
    operario_id: formData.get("operario_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bache_stage_records").insert({
    ...parsed.data,
    created_by: profile.id,
  });

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Esta etapa ya fue iniciada."
        : "No se pudo iniciar la etapa.",
    };
  }

  revalidatePath(`/baches/${parsed.data.bache_id}`);
  return { success: true };
}

const FinishStageSchema = z.object({
  record_id: z.string().uuid(),
  bache_id: z.string().uuid(),
  stage_template_id: z.string().uuid(),
  notes: z.string().trim().optional(),
});

const InsumosSchema = z
  .array(
    z.object({
      insumo_id: z.string().uuid(),
      nombre: z.string().trim().min(1),
      lote: z.string().trim().min(1, "El lote es obligatorio."),
      peso: z.coerce.number().positive("El peso debe ser mayor a 0."),
      marca: z.string().trim().min(1, "La marca es obligatoria."),
    }),
  )
  .min(1, "Marcá al menos un insumo.");

export async function finishStage(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = FinishStageSchema.safeParse({
    record_id: formData.get("record_id"),
    bache_id: formData.get("bache_id"),
    stage_template_id: formData.get("stage_template_id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  // El esquema de parámetros (y si incluye checklist de insumos) es la
  // fuente de verdad server-side: evita confiar en datos arbitrarios
  // enviados desde el cliente.
  const [{ data: template }, { data: existingRecord }] = await Promise.all([
    supabase
      .from("process_stage_templates")
      .select("parameter_schema, captures_insumos")
      .eq("id", parsed.data.stage_template_id)
      .single(),
    supabase
      .from("bache_stage_records")
      .select("parameters")
      .eq("id", parsed.data.record_id)
      .single(),
  ]);

  // Se parte de lo que ya había (preserva "lecturas" si la etapa las usa,
  // ya que esas se van agregando aparte con addReading mientras está en
  // curso, no en este formulario).
  const parameters: StageRecordParameters = { ...(existingRecord?.parameters ?? {}) };

  for (const param of template?.parameter_schema ?? []) {
    const raw = formData.get(`param__${param.key}`);
    if (raw === null || raw === "") continue;
    parameters[param.key] = param.type === "number" ? Number(raw) : String(raw);
  }

  if (template?.captures_insumos) {
    const insumosParsed = InsumosSchema.safeParse(
      JSON.parse(String(formData.get("insumos") || "[]")),
    );
    if (!insumosParsed.success) {
      return {
        error: insumosParsed.error.issues[0]?.message ?? "Insumos inválidos.",
      };
    }
    parameters.insumos = insumosParsed.data;
  }

  const { error } = await supabase
    .from("bache_stage_records")
    .update({
      ended_at: new Date().toISOString(),
      parameters,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.record_id);

  if (error) {
    return { error: "No se pudo finalizar la etapa." };
  }

  revalidatePath(`/baches/${parsed.data.bache_id}`);
  return { success: true };
}

const AddReadingSchema = z.object({
  record_id: z.string().uuid(),
  bache_id: z.string().uuid(),
  stage_template_id: z.string().uuid(),
});

export async function addReading(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = AddReadingSchema.safeParse({
    record_id: formData.get("record_id"),
    bache_id: formData.get("bache_id"),
    stage_template_id: formData.get("stage_template_id"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();

  const [{ data: template }, { data: record }] = await Promise.all([
    supabase
      .from("process_stage_templates")
      .select("parameter_schema")
      .eq("id", parsed.data.stage_template_id)
      .single(),
    supabase
      .from("bache_stage_records")
      .select("parameters, ended_at")
      .eq("id", parsed.data.record_id)
      .single(),
  ]);

  if (!record || record.ended_at) {
    return { error: "Esta etapa ya fue finalizada." };
  }

  const reading: StageReading = {
    timestamp: new Date().toISOString(),
  };
  for (const param of template?.parameter_schema ?? []) {
    const raw = formData.get(`param__${param.key}`);
    if (raw === null || raw === "") continue;
    reading[param.key] = param.type === "number" ? Number(raw) : String(raw);
  }

  const existingReadings = Array.isArray(record.parameters.lecturas)
    ? record.parameters.lecturas
    : [];
  const parameters: StageRecordParameters = {
    ...record.parameters,
    lecturas: [...existingReadings, reading],
  };

  const { error: readingError } = await supabase
    .from("bache_stage_records")
    .update({ parameters })
    .eq("id", parsed.data.record_id);

  if (readingError) {
    return { error: "No se pudo guardar la lectura." };
  }

  revalidatePath(`/baches/${parsed.data.bache_id}`);
  return { success: true };
}
