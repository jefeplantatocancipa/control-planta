"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  type: z.enum(["number", "text", "time"]),
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
  const captures_insumos = formData.get("captures_insumos") === "on";
  const captures_readings = formData.get("captures_readings") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase
        .from("process_stage_templates")
        .update({ ...values, active, captures_insumos, captures_readings })
        .eq("id", id)
    : await supabase
        .from("process_stage_templates")
        .insert({ ...values, active, captures_insumos, captures_readings });

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

const CloneStagesSchema = z.object({
  product_id: z.string().uuid({ message: "Elegí un producto." }),
});

export async function cloneDefaultStagesForProduct(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = CloneStagesSchema.safeParse({
    product_id: formData.get("product_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("process_stage_templates")
    .select("id")
    .eq("product_id", parsed.data.product_id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { error: "Este producto ya tiene etapas propias." };
  }

  const { data: defaults } = await supabase
    .from("process_stage_templates")
    .select("*")
    .is("product_id", null)
    .order("sequence_order");
  if (!defaults || defaults.length === 0) {
    return { error: "No hay etapas por defecto para copiar." };
  }

  const { error } = await supabase.from("process_stage_templates").insert(
    defaults.map((stage) => ({
      product_id: parsed.data.product_id,
      process_type: stage.process_type,
      name: stage.name,
      sequence_order: stage.sequence_order,
      parameter_schema: stage.parameter_schema,
      captures_insumos: stage.captures_insumos,
      captures_readings: stage.captures_readings,
      active: stage.active,
    })),
  );

  if (error) {
    return { error: "No se pudieron copiar las etapas." };
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

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

const CreateUserSchema = z
  .object({
    full_name: z.string().trim().min(1, "El nombre es obligatorio."),
    email: z
      .string()
      .trim()
      .email({ message: "Ingresá un correo válido." })
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres.")
      .optional()
      .or(z.literal("")),
    role: z.enum(["jefe_planta", "supervisor", "operario"] satisfies UserRole[]),
  })
  .refine((data) => data.role === "operario" || (data.email && data.password), {
    message: "Correo y contraseña son obligatorios para ese rol.",
    path: ["email"],
  });

export async function createUser(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = CreateUserSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email") || undefined,
    password: formData.get("password") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  // Los operarios no inician sesión: alcanza con que existan como perfil
  // para aparecer en los selectores de captura, así que se les genera un
  // correo y contraseña internos que nunca van a usar.
  const email =
    parsed.data.email || `${slugify(parsed.data.full_name)}-${randomToken()}@planta.local`;
  const password = parsed.data.password || `${randomToken()}${randomToken()}`;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });

  if (error) {
    return {
      error: error.message.toLowerCase().includes("already been registered")
        ? "Ya existe un usuario con ese correo."
        : "No se pudo crear el usuario.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Insumos y receta por producto
// ---------------------------------------------------------------------------
const InsumoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
});

export async function upsertInsumo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = InsumoSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("insumos").update({ ...values, active }).eq("id", id)
    : await supabase.from("insumos").insert({ ...values, active });

  if (error) {
    return { error: "No se pudo guardar el insumo." };
  }

  revalidatePath("/admin");
  return { success: true };
}

const RecipeSchema = z.object({
  product_id: z.string().uuid({ message: "Elegí un producto." }),
  insumo_ids: z.array(z.string().uuid()),
});

export async function saveProductRecipe(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = RecipeSchema.safeParse({
    product_id: formData.get("product_id"),
    insumo_ids: formData.getAll("insumo_ids"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("product_insumos")
    .delete()
    .eq("product_id", parsed.data.product_id);
  if (deleteError) {
    return { error: "No se pudo guardar la receta." };
  }

  if (parsed.data.insumo_ids.length > 0) {
    const { error: insertError } = await supabase.from("product_insumos").insert(
      parsed.data.insumo_ids.map((insumo_id) => ({
        product_id: parsed.data.product_id,
        insumo_id,
      })),
    );
    if (insertError) {
      return { error: "No se pudo guardar la receta." };
    }
  }

  revalidatePath("/admin");
  return { success: true };
}
