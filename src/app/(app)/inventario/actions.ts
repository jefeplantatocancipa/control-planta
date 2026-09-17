"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const INSUMO_TIPOS = ["materia_prima", "empaque", "vaso_blanco"] as const;

const EntradaSchema = z.object({
  insumo_tipo: z.enum(INSUMO_TIPOS),
  insumo_id: z.string().uuid({ message: "Elegí un insumo." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  proveedor: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export async function registrarEntrada(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = EntradaSchema.safeParse({
    insumo_tipo: formData.get("insumo_tipo"),
    insumo_id: formData.get("insumo_id"),
    cantidad: formData.get("cantidad"),
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
