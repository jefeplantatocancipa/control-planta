"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { normalize, cellText } from "../programa/excel-utils";

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

const INSUMO_TIPOS = ["materia_prima", "empaque", "vaso_blanco", "generico"] as const;

export const BODEGAS_DESPACHO = ["Funza", "Chía", "Bodega Luis", "Guasca"] as const;

const EntradaSchema = z.object({
  insumo_tipo: z.enum(INSUMO_TIPOS),
  insumo_id: z.string().uuid({ message: "Elegí un insumo." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  lote: z.string().trim().optional(),
  proveedor: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export async function registrarEntrada(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);

  const parsed = EntradaSchema.safeParse({
    insumo_tipo: formData.get("insumo_tipo"),
    insumo_id: formData.get("insumo_id"),
    cantidad: formData.get("cantidad"),
    lote: formData.get("lote") || undefined,
    proveedor: formData.get("proveedor") || undefined,
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventario_movimientos").insert({
    insumo_tipo: parsed.data.insumo_tipo,
    insumo_id: parsed.data.insumo_id,
    tipo: "entrada",
    cantidad: parsed.data.cantidad,
    lote: parsed.data.lote || null,
    origen_tipo: "manual",
    proveedor: parsed.data.proveedor || null,
    notas: parsed.data.notas || null,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar la entrada." };
  }

  revalidatePath("/inventario");
  revalidatePath("/enmangado");
  return { success: true };
}

const AjusteSchema = z.object({
  insumo_tipo: z.enum(INSUMO_TIPOS),
  insumo_id: z.string().uuid({ message: "Elegí un insumo." }),
  cantidad: z.coerce.number().refine((n) => n !== 0, {
    message: "La cantidad no puede ser 0.",
  }),
  notas: z.string().trim().min(1, "Contá por qué es necesario el ajuste."),
});

export async function registrarAjuste(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = AjusteSchema.safeParse({
    insumo_tipo: formData.get("insumo_tipo"),
    insumo_id: formData.get("insumo_id"),
    cantidad: formData.get("cantidad"),
    notas: formData.get("notas"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventario_movimientos").insert({
    insumo_tipo: parsed.data.insumo_tipo,
    insumo_id: parsed.data.insumo_id,
    tipo: "ajuste",
    cantidad: parsed.data.cantidad,
    origen_tipo: "manual",
    notas: parsed.data.notas,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar el ajuste." };
  }

  revalidatePath("/inventario");
  revalidatePath("/enmangado");
  return { success: true };
}

const DespachoSchema = z.object({
  insumo_tipo: z.enum(INSUMO_TIPOS),
  insumo_id: z.string().uuid({ message: "Elegí un insumo." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  destino: z.enum(BODEGAS_DESPACHO, { message: "Elegí la bodega destino." }),
  lote: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export async function registrarDespacho(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = DespachoSchema.safeParse({
    insumo_tipo: formData.get("insumo_tipo"),
    insumo_id: formData.get("insumo_id"),
    cantidad: formData.get("cantidad"),
    destino: formData.get("destino"),
    lote: formData.get("lote") || undefined,
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventario_movimientos").insert({
    insumo_tipo: parsed.data.insumo_tipo,
    insumo_id: parsed.data.insumo_id,
    tipo: "despacho",
    cantidad: -parsed.data.cantidad,
    lote: parsed.data.lote || null,
    destino: parsed.data.destino,
    origen_tipo: "manual",
    notas: parsed.data.notas || null,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar el despacho." };
  }

  revalidatePath("/inventario");
  revalidatePath("/enmangado");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Importador de entradas (ingreso de material) por Excel: Código, Cantidad,
// Lote, Proveedor. El código se busca en cualquiera de los cuatro
// catálogos (materia prima, empaque, vaso blanco, genérico) -- no hace
// falta saber a mano en cuál vive.
// ---------------------------------------------------------------------------
const ENTRADAS_REQUIRED_HEADERS = ["codigo", "cantidad"];

export async function importInventarioEntradas(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);

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
    if (ENTRADAS_REQUIRED_HEADERS.every((h) => h in map)) {
      headerRowNumber = r;
      columns = map;
      break;
    }
  }
  if (headerRowNumber === -1) {
    return {
      error: "No se encontraron las columnas \"Codigo\" y \"Cantidad\". Revisá el archivo.",
    };
  }

  const supabase = await createClient();
  const { data: catalogo } = await supabase.from("v_inventario_catalogo").select("*");
  const byCodigo = new Map((catalogo ?? []).map((c) => [c.codigo as string, c]));

  const warnings: string[] = [];
  let imported = 0;

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = cellText(row.getCell(columns["codigo"]));
    if (!codigo) continue; // fila vacía: fin de la tabla

    const cantidadText = cellText(row.getCell(columns["cantidad"]));
    const cantidad = Number(cantidadText.replace(",", "."));
    if (!cantidadText || Number.isNaN(cantidad) || cantidad <= 0) {
      warnings.push(`Fila ${r} (${codigo}): cantidad inválida.`);
      continue;
    }

    const item = byCodigo.get(codigo);
    if (!item) {
      warnings.push(`Fila ${r} (${codigo}): no existe en el catálogo. Importá el catálogo primero.`);
      continue;
    }

    const lote = columns["lote"] ? cellText(row.getCell(columns["lote"])) || null : null;
    const proveedor = columns["proveedor"]
      ? cellText(row.getCell(columns["proveedor"])) || null
      : null;

    const { error } = await supabase.from("inventario_movimientos").insert({
      insumo_tipo: item.insumo_tipo,
      insumo_id: item.insumo_id,
      tipo: "entrada",
      cantidad,
      lote,
      proveedor,
      origen_tipo: "manual",
      created_by: profile.id,
    });

    if (error) {
      warnings.push(`Fila ${r} (${codigo}): no se pudo registrar.`);
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

  revalidatePath("/inventario");
  revalidatePath("/enmangado");
  return { success: true, imported, warnings };
}
