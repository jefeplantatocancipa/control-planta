"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NO_ORDER_VALUE } from "./constants";
import type { OrderStatus, ProgramStatus } from "@/lib/supabase/types";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

// ---------------------------------------------------------------------------
// Vasos blancos (materia prima) y su stock
// ---------------------------------------------------------------------------
const VasoBlancoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  unit: z.string().trim().min(1, "La unidad es obligatoria."),
});

export async function upsertVasoBlanco(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = VasoBlancoSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("vasos_blancos").update({ ...values, active }).eq("id", id)
    : await supabase.from("vasos_blancos").insert({ ...values, active });

  if (error) {
    return { error: "No se pudo guardar el vaso blanco." };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

const VasoBlancoEntradaSchema = z.object({
  vaso_blanco_id: z.string().uuid({ message: "Elegí un vaso blanco." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  notes: z.string().trim().optional(),
});

export async function createVasoBlancoEntrada(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = VasoBlancoEntradaSchema.safeParse({
    vaso_blanco_id: formData.get("vaso_blanco_id"),
    cantidad: formData.get("cantidad"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vasos_blancos_entradas").insert({
    ...parsed.data,
    notes: parsed.data.notes || null,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar la entrada de stock." };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Referencias de enmangado (producto terminado: vaso fajillado)
// ---------------------------------------------------------------------------
const ReferenciaSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1, "El código es obligatorio."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  vaso_blanco_id: z.string().uuid({ message: "Elegí qué vaso blanco consume." }),
});

export async function upsertReferencia(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = ReferenciaSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    name: formData.get("name"),
    vaso_blanco_id: formData.get("vaso_blanco_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase
        .from("enmangado_referencias")
        .update({ ...values, active })
        .eq("id", id)
    : await supabase.from("enmangado_referencias").insert({ ...values, active });

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe una referencia con ese código."
        : "No se pudo guardar la referencia.",
    };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Programa de enmangado
// ---------------------------------------------------------------------------
const ProgramSchema = z.object({
  week_start_date: z.string().min(1, "La semana es obligatoria."),
  notes: z.string().trim().optional(),
});

export async function createEnmangadoProgram(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta"]);

  const parsed = ProgramSchema.safeParse({
    week_start_date: formData.get("week_start_date"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("enmangado_programs").insert({
    week_start_date: parsed.data.week_start_date,
    notes: parsed.data.notes || null,
    created_by: profile.id,
  });

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe un programa de enmangado para esa semana."
        : "No se pudo crear el programa.",
    };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

const ProgramStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["borrador", "publicado", "cerrado"] satisfies ProgramStatus[]),
});

export async function updateEnmangadoProgramStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = ProgramStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("enmangado_programs")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo actualizar el estado del programa." };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Órdenes de enmangado
// ---------------------------------------------------------------------------
const OrderSchema = z.object({
  program_id: z.string().uuid(),
  referencia_id: z.string().uuid({ message: "Elegí una referencia." }),
  scheduled_date: z.string().min(1, "La fecha es obligatoria."),
  planned_quantity: z.coerce
    .number()
    .positive("La cantidad debe ser mayor a 0."),
  unit: z.string().trim().min(1, "La unidad es obligatoria."),
});

export async function createEnmangadoOrder(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = OrderSchema.safeParse({
    program_id: formData.get("program_id"),
    referencia_id: formData.get("referencia_id"),
    scheduled_date: formData.get("scheduled_date"),
    planned_quantity: formData.get("planned_quantity"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("enmangado_orders").insert(parsed.data);

  if (error) {
    return { error: "No se pudo crear la orden de enmangado." };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

const OrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "pendiente",
    "en_proceso",
    "completado",
    "cancelado",
  ] satisfies OrderStatus[]),
});

export async function updateEnmangadoOrderStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = OrderStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("enmangado_orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo actualizar el estado de la orden." };
  }

  revalidatePath("/enmangado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Captura de vasos enmangados (descuenta stock de vasos blancos)
// ---------------------------------------------------------------------------
const VasoEnmangadoSchema = z.object({
  referencia_id: z.string().uuid({ message: "Elegí una referencia." }),
  enmangado_order_id: z.string().uuid().nullable(),
  operario_id: z.string().uuid({ message: "Elegí quién realizó el enmangado." }),
  lote_etiqueta: z.string().trim().optional(),
  cantidad_unidades: z.coerce
    .number()
    .min(0, "La cantidad no puede ser negativa."),
  cantidad_mermas: z.coerce.number().min(0, "Las mermas no pueden ser negativas."),
  notes: z.string().trim().optional(),
});

export async function createVasoEnmangado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const orderId = formData.get("enmangado_order_id");
  const parsed = VasoEnmangadoSchema.safeParse({
    referencia_id: formData.get("referencia_id"),
    enmangado_order_id: orderId && orderId !== NO_ORDER_VALUE ? orderId : null,
    operario_id: formData.get("operario_id"),
    lote_etiqueta: formData.get("lote_etiqueta"),
    cantidad_unidades: formData.get("cantidad_unidades"),
    cantidad_mermas: formData.get("cantidad_mermas") || 0,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("vasos_enmangados").insert({
    ...parsed.data,
    lote_etiqueta: parsed.data.lote_etiqueta || null,
    notes: parsed.data.notes || null,
    started_at: now,
    ended_at: now,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar el enmangado." };
  }

  // El stock de vasos blancos se calcula como entradas - lo consumido acá,
  // así que no hace falta un movimiento de "salida" aparte.
  revalidatePath("/enmangado");
  return { success: true };
}
