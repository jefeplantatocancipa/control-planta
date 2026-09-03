"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  normalize,
  cellText,
  excelDateOnlyToISO,
  excelDateTimeToBogotaISO,
  mondayOfWeek,
} from "./excel-utils";
import type { Database, OrderStatus, ProgramStatus } from "@/lib/supabase/types";

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

// ---------------------------------------------------------------------------
// Importador de Excel: programa de Baches
// ---------------------------------------------------------------------------
const REQUIRED_HEADERS = ["orden de produccion", "sku", "fecha"];

interface OrderDraft {
  week: string;
  order: Database["public"]["Tables"]["production_orders"]["Insert"];
}

export async function importBachesProgram(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const profile = await requireRole(["jefe_planta"]);

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
    if (REQUIRED_HEADERS.every((h) => h in map)) {
      headerRowNumber = r;
      columns = map;
      break;
    }
  }
  if (headerRowNumber === -1) {
    return {
      error:
        "No se encontraron los encabezados esperados (Orden de Producción, sku, FECHA). Usá la plantilla.",
    };
  }

  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id, code");
  const productByCode = new Map(
    (products ?? []).map((p) => [normalize(p.code), p.id]),
  );

  const { data: existingPrograms } = await supabase
    .from("production_programs")
    .select("id, week_start_date");
  const programByWeek = new Map(
    (existingPrograms ?? []).map((p) => [p.week_start_date, p.id]),
  );

  const warnings: string[] = [];
  const drafts: OrderDraft[] = [];

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const ordenCodigo = cellText(row.getCell(columns["orden de produccion"]));
    if (!ordenCodigo) continue; // fila vacía: fin de la tabla

    const sku = cellText(row.getCell(columns["sku"]));
    const nombre = columns["nombres"]
      ? cellText(row.getCell(columns["nombres"]))
      : "";

    const fechaValue = row.getCell(columns["fecha"]).value;
    const scheduledDate = excelDateOnlyToISO(fechaValue);
    if (!scheduledDate) {
      warnings.push(`Fila ${r} (${ordenCodigo}): FECHA inválida, se omitió.`);
      continue;
    }

    const productId = productByCode.get(normalize(sku));
    if (!productId) {
      warnings.push(
        `Fila ${r} (${ordenCodigo}): no se encontró un producto con sku "${sku}"${
          nombre ? ` (${nombre})` : ""
        }.`,
      );
      continue;
    }

    const tanque = columns["tanque"]
      ? cellText(row.getCell(columns["tanque"])) || null
      : null;
    const bachesRaw = columns["baches"] ? row.getCell(columns["baches"]).value : null;
    const bachesPlaneados =
      typeof bachesRaw === "number" ? bachesRaw : Number(bachesRaw) || null;
    const horaInicio = columns["hora inicio"]
      ? excelDateTimeToBogotaISO(row.getCell(columns["hora inicio"]).value)
      : null;
    const horaFinal = columns["hora final"]
      ? excelDateTimeToBogotaISO(row.getCell(columns["hora final"]).value)
      : null;

    const week = mondayOfWeek(scheduledDate);
    drafts.push({
      week,
      order: {
        program_id: "",
        product_id: productId,
        scheduled_date: scheduledDate,
        unit: "baches",
        orden_codigo: ordenCodigo,
        tanque,
        baches_planeados: bachesPlaneados,
        hora_inicio_planeada: horaInicio,
        hora_final_planeada: horaFinal,
      },
    });
  }

  if (drafts.length === 0) {
    return {
      error: warnings[0] ?? "No se encontraron filas para importar.",
      warnings,
    };
  }

  const weeksNeeded = new Set(drafts.map((d) => d.week));
  for (const week of weeksNeeded) {
    if (programByWeek.has(week)) continue;
    const { data: created, error } = await supabase
      .from("production_programs")
      .insert({ week_start_date: week, created_by: profile.id })
      .select("id")
      .single();
    if (error || !created) {
      return { error: `No se pudo crear el programa de la semana del ${week}.` };
    }
    programByWeek.set(week, created.id);
  }

  const rows = drafts.map((d) => ({
    ...d.order,
    program_id: programByWeek.get(d.week)!,
  }));

  const { error: upsertError } = await supabase
    .from("production_orders")
    .upsert(rows, { onConflict: "orden_codigo" });

  if (upsertError) {
    return { error: "No se pudieron guardar las órdenes importadas." };
  }

  revalidatePath("/programa");
  return { success: true, imported: rows.length, warnings };
}

// ---------------------------------------------------------------------------
// Importador de Excel: programa de Envasado
// ---------------------------------------------------------------------------
const ENVASADO_REQUIRED_HEADERS = ["fecha", "sku", "und programadas"];

interface EnvasadoOrderDraft {
  week: string;
  order: Database["public"]["Tables"]["envasado_orders"]["Insert"];
}

export async function importEnvasadoProgram(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const profile = await requireRole(["jefe_planta"]);

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
    if (ENVASADO_REQUIRED_HEADERS.every((h) => h in map)) {
      headerRowNumber = r;
      columns = map;
      break;
    }
  }
  if (headerRowNumber === -1) {
    return {
      error:
        "No se encontraron los encabezados esperados (FECHA, SKU, Und Programadas). Usá la plantilla.",
    };
  }

  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id, code");
  const productByCode = new Map(
    (products ?? []).map((p) => [normalize(p.code), p.id]),
  );

  const { data: existingPrograms } = await supabase
    .from("production_programs")
    .select("id, week_start_date");
  const programByWeek = new Map(
    (existingPrograms ?? []).map((p) => [p.week_start_date, p.id]),
  );

  const warnings: string[] = [];
  const drafts: EnvasadoOrderDraft[] = [];

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const fechaValue = row.getCell(columns["fecha"]).value;
    const scheduledDate = excelDateOnlyToISO(fechaValue);
    const sku = cellText(row.getCell(columns["sku"]));
    if (!scheduledDate && !sku) continue; // fila vacía: fin de la tabla

    if (!scheduledDate) {
      warnings.push(`Fila ${r}: FECHA inválida, se omitió.`);
      continue;
    }

    const descripcion = columns["descripcion"]
      ? cellText(row.getCell(columns["descripcion"]))
      : "";
    const productId = productByCode.get(normalize(sku));
    if (!productId) {
      warnings.push(
        `Fila ${r}: no se encontró un producto con sku "${sku}"${
          descripcion ? ` (${descripcion})` : ""
        }.`,
      );
      continue;
    }

    const undRaw = row.getCell(columns["und programadas"]).value;
    const plannedQuantity = typeof undRaw === "number" ? undRaw : Number(undRaw);
    if (!plannedQuantity || plannedQuantity <= 0) {
      warnings.push(`Fila ${r}: "Und Programadas" inválida, se omitió.`);
      continue;
    }

    const linea = columns["linea"] ? cellText(row.getCell(columns["linea"])) || null : null;
    const gramajeRaw = columns["gramaje x und"]
      ? row.getCell(columns["gramaje x und"]).value
      : null;
    const gramaje =
      typeof gramajeRaw === "number" ? gramajeRaw : Number(gramajeRaw) || null;

    const week = mondayOfWeek(scheduledDate);
    drafts.push({
      week,
      order: {
        program_id: "",
        product_id: productId,
        linea,
        scheduled_date: scheduledDate,
        planned_quantity: plannedQuantity,
        gramaje_por_unidad: gramaje,
      },
    });
  }

  if (drafts.length === 0) {
    return {
      error: warnings[0] ?? "No se encontraron filas para importar.",
      warnings,
    };
  }

  const weeksNeeded = new Set(drafts.map((d) => d.week));
  for (const week of weeksNeeded) {
    if (programByWeek.has(week)) continue;
    const { data: created, error } = await supabase
      .from("production_programs")
      .insert({ week_start_date: week, created_by: profile.id })
      .select("id")
      .single();
    if (error || !created) {
      return { error: `No se pudo crear el programa de la semana del ${week}.` };
    }
    programByWeek.set(week, created.id);
  }

  const rows = drafts.map((d) => ({
    ...d.order,
    program_id: programByWeek.get(d.week)!,
  }));

  const { error: upsertError } = await supabase
    .from("envasado_orders")
    .upsert(rows, { onConflict: "scheduled_date,linea,product_id" });

  if (upsertError) {
    return { error: "No se pudieron guardar las órdenes de envasado importadas." };
  }

  revalidatePath("/programa");
  return { success: true, imported: rows.length, warnings };
}
