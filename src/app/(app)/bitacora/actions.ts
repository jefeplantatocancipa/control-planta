"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NONE_VALUE } from "./constants";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const CrearEntradaSchema = z.object({
  tipo: z.enum(["lavado", "novedad"]),
  turno_id: z.string().uuid().nullable(),
  equipo_id: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Escribí una descripción."),
});

export async function crearEntradaBitacora(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const turnoId = formData.get("turno_id");
  const equipoId = formData.get("equipo_id");
  const parsed = CrearEntradaSchema.safeParse({
    tipo: formData.get("tipo"),
    turno_id: turnoId && turnoId !== NONE_VALUE ? turnoId : null,
    equipo_id: equipoId && equipoId !== NONE_VALUE ? equipoId : null,
    texto: formData.get("texto"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bitacora_entradas").insert({
    tipo: parsed.data.tipo,
    turno_id: parsed.data.turno_id,
    equipo_id: parsed.data.tipo === "lavado" ? parsed.data.equipo_id : null,
    texto: parsed.data.texto,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo guardar la entrada." };
  }

  revalidatePath("/bitacora");
  return { success: true };
}

const DeleteSchema = z.object({ id: z.string().uuid() });

export async function deleteEntradaBitacora(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = DeleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bitacora_entradas")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo eliminar la entrada." };
  }

  revalidatePath("/bitacora");
  return { success: true };
}
