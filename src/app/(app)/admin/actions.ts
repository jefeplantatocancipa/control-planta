"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";
import { ALL_PRODUCTS_VALUE } from "./constants";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1, "El código es obligatorio."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  unit: z.string().trim().min(1, "La unidad es obligatoria."),
});

export async function upsertProduct(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = ProductSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
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
    ? await supabase.from("products").update({ ...values, active }).eq("id", id)
    : await supabase.from("products").insert({ ...values, active });

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe un producto con ese código."
        : "No se pudo guardar el producto.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Etapas de proceso
// ---------------------------------------------------------------------------
const StageParameterSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["number", "text"]),
});

const StageTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  sequence_order: z.coerce
    .number()
    .int()
    .positive("El orden debe ser mayor a 0."),
  parameter_schema: z
    .string()
    .transform((raw, ctx) => {
      try {
        return z.array(StageParameterSchema).parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: "custom", message: "Parámetros inválidos." });
        return z.NEVER;
      }
    }),
});

export async function upsertStageTemplate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const productId = formData.get("product_id");
  const parsed = StageTemplateSchema.safeParse({
    id: formData.get("id") || undefined,
    product_id: productId && productId !== ALL_PRODUCTS_VALUE ? productId : null,
    name: formData.get("name"),
    sequence_order: formData.get("sequence_order"),
    parameter_schema: formData.get("parameter_schema") || "[]",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase
        .from("process_stage_templates")
        .update({ ...values, active })
        .eq("id", id)
    : await supabase
        .from("process_stage_templates")
        .insert({ ...values, active });

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe una etapa con ese orden para ese producto."
        : "No se pudo guardar la etapa.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Usuarios (perfiles)
// ---------------------------------------------------------------------------
const ProfileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1, "El nombre es obligatorio."),
  role: z.enum(["jefe_planta", "supervisor", "operario"] satisfies UserRole[]),
});

export async function updateProfile(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentProfile = await requireRole(["jefe_planta"]);

  const parsed = ProfileSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const active = formData.get("active") === "on";

  if (
    parsed.data.id === currentProfile.id &&
    (parsed.data.role !== "jefe_planta" || !active)
  ) {
    return { error: "No podés quitarte a vos mismo el rol de jefe de planta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, role: parsed.data.role, active })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo actualizar el usuario." };
  }

  revalidatePath("/admin");
  return { success: true };
}
