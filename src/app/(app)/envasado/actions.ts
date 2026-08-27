"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const StartEnvasadoSchema = z.object({
  bache_id: z.string().uuid({ message: "Elegí un bache." }),
  operario_id: z.string().uuid({ message: "Elegí quién realiza el envasado." }),
  presentacion: z.string().trim().min(1, "La presentación es obligatoria."),
});

export async function startEnvasado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = StartEnvasadoSchema.safeParse({
    bache_id: formData.get("bache_id"),
    operario_id: formData.get("operario_id"),
    presentacion: formData.get("presentacion"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("envasados").insert({
    ...parsed.data,
    cantidad_unidades: 0,
    cantidad_mermas: 0,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo iniciar el envasado." };
  }

  revalidatePath("/envasado");
  return { success: true };
}

const SaveEnvasadoSchema = z.object({
  record_id: z.string().uuid(),
  cantidad_unidades: z.coerce
    .number()
    .min(0, "La cantidad no puede ser negativa."),
  cantidad_mermas: z.coerce.number().min(0, "Las mermas no pueden ser negativas."),
  notes: z.string().trim().optional(),
  finalize: z.enum(["true", "false"]),
});

export async function saveEnvasado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = SaveEnvasadoSchema.safeParse({
    record_id: formData.get("record_id"),
    cantidad_unidades: formData.get("cantidad_unidades"),
    cantidad_mermas: formData.get("cantidad_mermas") || 0,
    notes: formData.get("notes"),
    finalize: formData.get("finalize"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("envasados")
    .update({
      cantidad_unidades: parsed.data.cantidad_unidades,
      cantidad_mermas: parsed.data.cantidad_mermas,
      notes: parsed.data.notes || null,
      ended_at: parsed.data.finalize === "true" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.record_id);

  if (error) {
    return { error: "No se pudo guardar el envasado." };
  }

  revalidatePath("/envasado");
  return { success: true };
}
