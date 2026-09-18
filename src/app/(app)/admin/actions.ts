"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalize, cellText } from "../programa/excel-utils";
import type { UserRole } from "@/lib/supabase/types";
import { ALL_PRODUCTS_VALUE } from "./constants";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export interface ImportActionState {
  error?: string;
  success?: boolean;
  imported?: number;
  warnings?: string[];
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
  volumen_por_bache: z.coerce
    .number()
    .positive("El volumen por bache debe ser mayor a 0.")
    .nullable(),
});

export async function upsertProduct(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const volumenPorBache = formData.get("volumen_por_bache");
  const parsed = ProductSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    name: formData.get("name"),
    unit: formData.get("unit"),
    volumen_por_bache: volumenPorBache || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const requiere_envasado = formData.get("requiere_envasado") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase
        .from("products")
        .update({ ...values, active, requiere_envasado })
        .eq("id", id)
    : await supabase.from("products").insert({ ...values, active, requiere_envasado });

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
  type: z.enum([
    "number",
    "text",
    "time",
    "tanque",
    "porcentaje",
    "positivo_negativo",
  ]),
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

// Corre una posición hacia adelante (sequence_order + 1) a cualquier etapa
// del mismo producto que ya esté en el orden pedido o más adelante, para
// que insertar/mover una etapa a un orden ocupado nunca falle: en vez de
// rechazar por choque de orden, las demás se desplazan. Se actualiza de la
// más alta a la más baja para no chocar contra la restricción unique
// mientras se corren.
async function makeRoomAtSequenceOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string | null,
  fromOrder: number,
  excludeId: string | undefined,
) {
  let query = supabase
    .from("process_stage_templates")
    .select("id, sequence_order")
    .eq("process_type", "bache")
    .gte("sequence_order", fromOrder)
    .order("sequence_order", { ascending: false });
  query = productId === null ? query.is("product_id", null) : query.eq("product_id", productId);
  if (excludeId) query = query.neq("id", excludeId);

  const { data: toShift } = await query;
  for (const row of toShift ?? []) {
    await supabase
      .from("process_stage_templates")
      .update({ sequence_order: row.sequence_order + 1 })
      .eq("id", row.id);
  }
}

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

  await makeRoomAtSequenceOrder(supabase, values.product_id, values.sequence_order, id);

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

const DeleteProductStagesSchema = z.object({
  product_id: z.string().uuid({ message: "Elegí un producto." }),
});

export async function deleteProductStages(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = DeleteProductStagesSchema.safeParse({
    product_id: formData.get("product_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("process_stage_templates")
    .delete()
    .eq("product_id", parsed.data.product_id);

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "No se puede: ya hay baches que registraron datos en estas etapas."
          : "No se pudieron eliminar las etapas.",
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
  role: z.enum([
    "jefe_planta",
    "supervisor",
    "operario",
    "planeacion",
    "calidad",
    "asistente_adm",
  ] satisfies UserRole[]),
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

const ResetPasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export async function resetUserPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = ResetPasswordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
  });

  if (error) {
    return { error: "No se pudo cambiar la contraseña." };
  }

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
    role: z.enum([
    "jefe_planta",
    "supervisor",
    "operario",
    "planeacion",
    "calidad",
    "asistente_adm",
  ] satisfies UserRole[]),
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
  unit: z.string().trim().min(1, "La unidad es obligatoria."),
  stock_minimo: z.coerce.number().min(0).nullable(),
});

export async function upsertInsumo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const stockMinimo = formData.get("stock_minimo");
  const parsed = InsumoSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    unit: formData.get("unit"),
    stock_minimo: stockMinimo || null,
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

const DeleteInsumoSchema = z.object({ id: z.string().uuid() });

export async function deleteInsumo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = DeleteInsumoSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("insumos").delete().eq("id", parsed.data.id);

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "No se puede: este insumo ya está usado en recetas o etapas registradas. Marcalo como inactivo en vez de borrarlo."
          : "No se pudo eliminar el insumo.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tanques
// ---------------------------------------------------------------------------
const TanqueSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
});

export async function upsertTanque(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = TanqueSchema.safeParse({
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
    ? await supabase.from("tanques").update({ ...values, active }).eq("id", id)
    : await supabase.from("tanques").insert({ ...values, active });

  if (error) {
    return { error: "No se pudo guardar el tanque." };
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

// ---------------------------------------------------------------------------
// Referencias de envasado (presentaciones empacadas, por sku)
// ---------------------------------------------------------------------------
const EnvasadoReferenciaSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid({ message: "Elegí un producto." }),
  sku: z.string().trim().min(1, "La referencia (sku) es obligatoria."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  peso_unitario: z.coerce
    .number()
    .positive("El peso unitario debe ser mayor a 0."),
  multiempaque: z.coerce
    .number()
    .int()
    .positive("El multiempaque debe ser mayor a 0."),
});

export async function upsertEnvasadoReferencia(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = EnvasadoReferenciaSchema.safeParse({
    id: formData.get("id") || undefined,
    product_id: formData.get("product_id"),
    sku: formData.get("sku"),
    name: formData.get("name"),
    peso_unitario: formData.get("peso_unitario"),
    multiempaque: formData.get("multiempaque"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("envasado_referencias").update({ ...values, active }).eq("id", id)
    : await supabase.from("envasado_referencias").insert({ ...values, active });

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe una referencia con ese sku."
        : "No se pudo guardar la referencia.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Turnos (franjas horarias fijas para el control de envasado)
// ---------------------------------------------------------------------------
const TurnoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  hora_inicio: z.string().trim().min(1, "La hora de inicio es obligatoria."),
  hora_fin: z.string().trim().min(1, "La hora final es obligatoria."),
});

export async function upsertTurno(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = TurnoSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    hora_inicio: formData.get("hora_inicio"),
    hora_fin: formData.get("hora_fin"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("turnos").update({ ...values, active }).eq("id", id)
    : await supabase.from("turnos").insert({ ...values, active });

  if (error) {
    return { error: "No se pudo guardar el turno." };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Insumos de envasado (envases/empaques: vasos, tapas, etiquetas, cajas)
// ---------------------------------------------------------------------------
const EnvasadoInsumoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  unit: z.string().trim().min(1, "La unidad es obligatoria."),
  presentacion_caja: z.string().trim().optional(),
  marca: z.string().trim().optional(),
  stock_minimo: z.coerce.number().min(0).nullable(),
});

export async function upsertEnvasadoInsumo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const stockMinimo = formData.get("stock_minimo");
  const parsed = EnvasadoInsumoSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    unit: formData.get("unit"),
    presentacion_caja: formData.get("presentacion_caja") || undefined,
    marca: formData.get("marca") || undefined,
    stock_minimo: stockMinimo || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const active = formData.get("active") === "on";
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("envasado_insumos").update({ ...values, active }).eq("id", id)
    : await supabase.from("envasado_insumos").insert({ ...values, active });

  if (error) {
    return { error: "No se pudo guardar el insumo." };
  }

  revalidatePath("/admin");
  return { success: true };
}

const DeleteEnvasadoInsumoSchema = z.object({ id: z.string().uuid() });

export async function deleteEnvasadoInsumo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = DeleteEnvasadoInsumoSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("envasado_insumos").delete().eq("id", parsed.data.id);

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "No se puede: este insumo ya está usado en recetas o envasados registrados. Marcalo como inactivo en vez de borrarlo."
          : "No se pudo eliminar el insumo.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Importador de Excel: material de empaque (envasado_insumos)
// ---------------------------------------------------------------------------
const ENVASADO_INSUMOS_REQUIRED_HEADERS = ["nombre del insumo"];

export async function importEnvasadoInsumos(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireRole(["jefe_planta"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo de Excel (.xlsx)." };
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es un .xlsx válido?" };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "El archivo no tiene hojas." };

  let headerRowNumber = -1;
  let columns: Record<string, number> = {};
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r++) {
    const row = sheet.getRow(r);
    const map: Record<string, number> = {};
    row.eachCell((cell, colNumber) => {
      const key = normalize(cellText(cell));
      if (key) map[key] = colNumber;
    });
    if (ENVASADO_INSUMOS_REQUIRED_HEADERS.every((h) => h in map)) {
      headerRowNumber = r;
      columns = map;
      break;
    }
  }
  if (headerRowNumber === -1) {
    return {
      error:
        "No se encontró la columna \"Nombre del insumo\". Usá la plantilla.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("envasado_insumos")
    .select("id, name");
  const existingByName = new Map(
    (existing ?? []).map((i) => [normalize(i.name), i.id]),
  );

  const warnings: string[] = [];
  let imported = 0;

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row.getCell(columns["nombre del insumo"]));
    if (!name) continue; // fila vacía: fin de la tabla

    const presentacionCaja = columns["presentacion por caja"]
      ? cellText(row.getCell(columns["presentacion por caja"])) || null
      : null;
    const marca = columns["marca o marcas"]
      ? cellText(row.getCell(columns["marca o marcas"])) || null
      : null;

    const existingId = existingByName.get(normalize(name));
    const { error } = existingId
      ? await supabase
          .from("envasado_insumos")
          .update({ name, presentacion_caja: presentacionCaja, marca })
          .eq("id", existingId)
      : await supabase
          .from("envasado_insumos")
          .insert({ name, presentacion_caja: presentacionCaja, marca });

    if (error) {
      warnings.push(`Fila ${r} (${name}): no se pudo guardar.`);
      continue;
    }
    imported++;
  }

  if (imported === 0) {
    return {
      error: warnings[0] ?? "No se encontraron filas para importar.",
      warnings,
    };
  }

  revalidatePath("/admin");
  return { success: true, imported, warnings };
}

// ---------------------------------------------------------------------------
// Receta de material de empaque por referencia
// ---------------------------------------------------------------------------
const EnvasadoRecipeSchema = z.object({
  referencia_id: z.string().uuid({ message: "Elegí una referencia." }),
  envasado_insumo_ids: z.array(z.string().uuid()),
});

export async function saveEnvasadoReferenciaRecipe(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = EnvasadoRecipeSchema.safeParse({
    referencia_id: formData.get("referencia_id"),
    envasado_insumo_ids: formData.getAll("envasado_insumo_ids"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("envasado_referencia_insumos")
    .delete()
    .eq("referencia_id", parsed.data.referencia_id);
  if (deleteError) {
    return { error: "No se pudo guardar la receta." };
  }

  if (parsed.data.envasado_insumo_ids.length > 0) {
    const { error: insertError } = await supabase
      .from("envasado_referencia_insumos")
      .insert(
        parsed.data.envasado_insumo_ids.map((envasado_insumo_id) => ({
          referencia_id: parsed.data.referencia_id,
          envasado_insumo_id,
        })),
      );
    if (insertError) {
      return { error: "No se pudo guardar la receta." };
    }
  }

  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Categorías de inventario (abiertas): cada una dice a qué catálogo
// alimenta (materia prima, empaque, vaso blanco, o solo stock genérico).
// ---------------------------------------------------------------------------
const InventarioCategoriaSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  tabla_destino: z.enum(["materia_prima", "empaque", "vaso_blanco", "generico"]),
});

// Cuando una categoría deja de ser "solo stock" (genérico) y pasa a
// alimentar materia prima, empaque o vaso blanco, los ítems que ya se
// habían importado bajo esa categoría quedaron guardados en el catálogo
// genérico (inventario_items) -- hay que moverlos al catálogo correcto
// para que aparezcan en recetas, sin perder su historial de movimientos.
async function migrarItemsGenericos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoriaId: string,
  tablaDestino: "materia_prima" | "empaque" | "vaso_blanco",
) {
  const { data: items } = await supabase
    .from("inventario_items")
    .select("*")
    .eq("categoria_id", categoriaId);
  if (!items || items.length === 0) return;

  for (const item of items) {
    let nuevoId: string | null = null;

    if (tablaDestino === "materia_prima") {
      const existing = item.codigo
        ? await supabase.from("insumos").select("id").eq("codigo", item.codigo).maybeSingle()
        : { data: null };
      if (existing.data) {
        nuevoId = existing.data.id;
      } else {
        const { data: created } = await supabase
          .from("insumos")
          .insert({
            name: item.name,
            unit: item.unit,
            codigo: item.codigo,
            categoria_id: categoriaId,
            stock_minimo: item.stock_minimo,
            active: item.active,
          })
          .select("id")
          .single();
        nuevoId = created?.id ?? null;
      }
    } else if (tablaDestino === "empaque") {
      const existing = item.codigo
        ? await supabase
            .from("envasado_insumos")
            .select("id")
            .eq("codigo", item.codigo)
            .maybeSingle()
        : { data: null };
      if (existing.data) {
        nuevoId = existing.data.id;
      } else {
        const { data: created } = await supabase
          .from("envasado_insumos")
          .insert({
            name: item.name,
            unit: item.unit,
            codigo: item.codigo,
            categoria_id: categoriaId,
            stock_minimo: item.stock_minimo,
            active: item.active,
          })
          .select("id")
          .single();
        nuevoId = created?.id ?? null;
      }
    } else {
      const existing = item.codigo
        ? await supabase
            .from("vasos_blancos")
            .select("id")
            .eq("codigo", item.codigo)
            .maybeSingle()
        : { data: null };
      if (existing.data) {
        nuevoId = existing.data.id;
      } else {
        const { data: created } = await supabase
          .from("vasos_blancos")
          .insert({
            name: item.name,
            unit: item.unit,
            codigo: item.codigo,
            categoria_id: categoriaId,
            stock_minimo: item.stock_minimo,
            active: item.active,
          })
          .select("id")
          .single();
        nuevoId = created?.id ?? null;
      }
    }

    if (!nuevoId) continue;

    await supabase
      .from("inventario_movimientos")
      .update({ insumo_tipo: tablaDestino, insumo_id: nuevoId })
      .eq("insumo_tipo", "generico")
      .eq("insumo_id", item.id);

    await supabase.from("inventario_items").delete().eq("id", item.id);
  }
}

export async function upsertInventarioCategoria(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = InventarioCategoriaSchema.safeParse({
    id: formData.get("id") || undefined,
    nombre: formData.get("nombre"),
    tabla_destino: formData.get("tabla_destino"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  let tablaAnterior: string | null = null;
  if (id) {
    const { data: actual } = await supabase
      .from("inventario_categorias")
      .select("tabla_destino")
      .eq("id", id)
      .single();
    tablaAnterior = actual?.tabla_destino ?? null;
  }

  const { error } = id
    ? await supabase.from("inventario_categorias").update(values).eq("id", id)
    : await supabase.from("inventario_categorias").insert(values);

  if (error) {
    return {
      error: isUniqueViolation(error)
        ? "Ya existe una categoría con ese nombre."
        : "No se pudo guardar la categoría.",
    };
  }

  if (
    id &&
    tablaAnterior === "generico" &&
    values.tabla_destino !== "generico"
  ) {
    await migrarItemsGenericos(supabase, id, values.tabla_destino);
  }

  revalidatePath("/admin");
  revalidatePath("/inventario");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Importador del catálogo de inventario: un solo Excel con Código,
// Descripción, Unidad y Categoría -- cada fila va al catálogo que
// corresponda según la categoría (materia prima / empaque / vaso blanco /
// genérico), creando la categoría si todavía no existe.
// ---------------------------------------------------------------------------
const INVENTARIO_CATALOGO_REQUIRED_HEADERS = ["codigo", "descripcion"];

function findColumn(map: Record<string, number>, patterns: string[]): number | undefined {
  for (const p of patterns) {
    if (map[p] !== undefined) return map[p];
  }
  const keys = Object.keys(map);
  for (const p of patterns) {
    const found = keys.find((k) => k.includes(p) || p.includes(k));
    if (found) return map[found];
  }
  return undefined;
}

export async function importInventarioCatalogo(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireRole(["jefe_planta"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo de Excel (.xlsx)." };
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es un .xlsx válido?" };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "El archivo no tiene hojas." };

  let headerRowNumber = -1;
  let columns: Record<string, number> = {};
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r++) {
    const row = sheet.getRow(r);
    const map: Record<string, number> = {};
    row.eachCell((cell, colNumber) => {
      const key = normalize(cellText(cell));
      if (key) map[key] = colNumber;
    });
    if (INVENTARIO_CATALOGO_REQUIRED_HEADERS.every((h) => h in map)) {
      headerRowNumber = r;
      columns = map;
      break;
    }
  }
  if (headerRowNumber === -1) {
    return {
      error: "No se encontraron las columnas \"Codigo\" y \"Descripción\". Revisá el archivo.",
    };
  }

  const colUnidad = findColumn(columns, ["u. medida", "unidad", "u medida", "und"]);
  const colCategoria = findColumn(columns, ["categoria", "categor"]);

  const supabase = await createClient();

  const [
    { data: categorias },
    { data: insumos },
    { data: envasadoInsumos },
    { data: vasosBlancos },
    { data: items },
  ] = await Promise.all([
    supabase.from("inventario_categorias").select("id, nombre, tabla_destino"),
    supabase.from("insumos").select("id, codigo"),
    supabase.from("envasado_insumos").select("id, codigo"),
    supabase.from("vasos_blancos").select("id, codigo"),
    supabase.from("inventario_items").select("id, codigo"),
  ]);

  const categoriaByNombre = new Map(
    (categorias ?? []).map((c) => [normalize(c.nombre), c]),
  );
  const insumoByCodigo = new Map(
    (insumos ?? []).filter((i) => i.codigo).map((i) => [i.codigo as string, i.id]),
  );
  const empaqueByCodigo = new Map(
    (envasadoInsumos ?? []).filter((i) => i.codigo).map((i) => [i.codigo as string, i.id]),
  );
  const vasoByCodigo = new Map(
    (vasosBlancos ?? []).filter((i) => i.codigo).map((i) => [i.codigo as string, i.id]),
  );
  const itemByCodigo = new Map(
    (items ?? []).filter((i) => i.codigo).map((i) => [i.codigo as string, i.id]),
  );

  const warnings: string[] = [];
  let imported = 0;

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = cellText(row.getCell(columns["codigo"]));
    const name = cellText(row.getCell(columns["descripcion"]));
    if (!codigo && !name) continue; // fila vacía: fin de la tabla
    if (!codigo || !name) {
      warnings.push(`Fila ${r}: falta código o descripción.`);
      continue;
    }

    const unit = colUnidad ? cellText(row.getCell(colUnidad)) || "unidades" : "unidades";
    const categoriaNombre = colCategoria ? cellText(row.getCell(colCategoria)) : "";

    let categoria = categoriaNombre
      ? categoriaByNombre.get(normalize(categoriaNombre))
      : undefined;
    if (categoriaNombre && !categoria) {
      // Categoría nueva: se crea sola, apuntando a "genérico" -- el jefe de
      // planta puede después cambiarle el destino desde Administración si
      // corresponde que alimente materia prima, empaque o vaso blanco.
      const { data: created, error: catError } = await supabase
        .from("inventario_categorias")
        .insert({ nombre: categoriaNombre, tabla_destino: "generico" })
        .select("id, nombre, tabla_destino")
        .single();
      if (catError || !created) {
        warnings.push(`Fila ${r} (${codigo}): no se pudo crear la categoría "${categoriaNombre}".`);
        continue;
      }
      categoria = created;
      categoriaByNombre.set(normalize(categoriaNombre), created);
    }

    // Si la fila no trae categoría (ej. un Excel reducido solo para
    // actualizar unidades) y el código ya existe en algún catálogo, se
    // actualiza ESE catálogo sin tocar su categoría -- así no hace falta
    // repetir la categoría de cada insumo solo para cambiarle la unidad.
    const existingElsewhere = !categoriaNombre
      ? insumoByCodigo.has(codigo)
        ? "materia_prima"
        : empaqueByCodigo.has(codigo)
          ? "empaque"
          : vasoByCodigo.has(codigo)
            ? "vaso_blanco"
            : itemByCodigo.has(codigo)
              ? "generico"
              : null
      : null;

    const tablaDestino = categoria?.tabla_destino ?? existingElsewhere ?? "generico";
    const categoriaId = categoria ? categoria.id : existingElsewhere ? undefined : null;

    let error: { message: string } | null = null;
    if (tablaDestino === "materia_prima") {
      const existingId = insumoByCodigo.get(codigo);
      const res = existingId
        ? await supabase
            .from("insumos")
            .update({ name, unit, categoria_id: categoriaId })
            .eq("id", existingId)
        : await supabase
            .from("insumos")
            .insert({ name, unit, codigo, categoria_id: categoriaId })
            .select("id")
            .single();
      error = res.error;
      if (!existingId && !res.error && "data" in res && res.data) {
        insumoByCodigo.set(codigo, (res.data as { id: string }).id);
      }
    } else if (tablaDestino === "empaque") {
      const existingId = empaqueByCodigo.get(codigo);
      const res = existingId
        ? await supabase
            .from("envasado_insumos")
            .update({ name, unit, categoria_id: categoriaId })
            .eq("id", existingId)
        : await supabase
            .from("envasado_insumos")
            .insert({ name, unit, codigo, categoria_id: categoriaId })
            .select("id")
            .single();
      error = res.error;
      if (!existingId && !res.error && "data" in res && res.data) {
        empaqueByCodigo.set(codigo, (res.data as { id: string }).id);
      }
    } else if (tablaDestino === "vaso_blanco") {
      const existingId = vasoByCodigo.get(codigo);
      const res = existingId
        ? await supabase
            .from("vasos_blancos")
            .update({ name, unit, categoria_id: categoriaId })
            .eq("id", existingId)
        : await supabase
            .from("vasos_blancos")
            .insert({ name, unit, codigo, categoria_id: categoriaId })
            .select("id")
            .single();
      error = res.error;
      if (!existingId && !res.error && "data" in res && res.data) {
        vasoByCodigo.set(codigo, (res.data as { id: string }).id);
      }
    } else {
      const existingId = itemByCodigo.get(codigo);
      const res = existingId
        ? await supabase
            .from("inventario_items")
            .update({ name, unit, categoria_id: categoriaId })
            .eq("id", existingId)
        : await supabase
            .from("inventario_items")
            .insert({ name, unit, codigo, categoria_id: categoriaId })
            .select("id")
            .single();
      error = res.error;
      if (!existingId && !res.error && "data" in res && res.data) {
        itemByCodigo.set(codigo, (res.data as { id: string }).id);
      }
    }

    if (error) {
      warnings.push(`Fila ${r} (${codigo}): no se pudo guardar.`);
      continue;
    }
    imported++;
  }

  if (imported === 0) {
    return {
      error: warnings[0] ?? "No se encontraron filas para importar.",
      warnings,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/inventario");
  return { success: true, imported, warnings };
}
