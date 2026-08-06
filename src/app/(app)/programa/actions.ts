"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, ProgramStatus } from "@/lib/supabase/types";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------------------
// Programa semanal
// ---------------------------------------------------------------------------
const ProgramSchema = z.object({
  week_start_date: z.string().min(1, "La semana es obligatoria."),
  notes: z.string().trim().optional(),
});

export async function createProgram(
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
  const { error } = await supabase.from("production_programs").insert({
    week_start_date: parsed.data.week_start_date,
    notes: parsed.data.notes || null,
    created_by: profile.id,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un programa para esa semana."
          : "No se pudo crear el programa.",
    };
  }

  revalidatePath("/programa");
  return { success: true };
}

const ProgramStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["borrador", "publicado", "cerrado"] satisfies ProgramStatus[]),
});

export async function updateProgramStatus(
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
    .from("production_programs")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo actualizar el estado del programa." };
  }

  revalidatePath("/programa");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Órdenes de producción
// ---------------------------------------------------------------------------
const OrderSchema = z.object({
  program_id: z.string().uuid(),
  product_id: z.string().uuid({ message: "Elegí un producto." }),
  scheduled_date: z.string().min(1, "La fecha es obligatoria."),
  planned_quantity: z.coerce
    .number()
    .positive("La cantidad debe ser mayor a 0."),
  unit: z.string().trim().min(1, "La unidad es obligatoria."),
});

export async function createOrder(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = OrderSchema.safeParse({
    program_id: formData.get("program_id"),
    product_id: formData.get("product_id"),
    scheduled_date: formData.get("scheduled_date"),
    planned_quantity: formData.get("planned_quantity"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("production_orders")
    .insert(parsed.data);

  if (error) {
    return { error: "No se pudo crear la orden." };
  }

  revalidatePath("/programa");
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

export async function updateOrderStatus(
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
    .from("production_orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo actualizar el estado de la orden." };
  }

  revalidatePath("/programa");
  return { success: true };
}
