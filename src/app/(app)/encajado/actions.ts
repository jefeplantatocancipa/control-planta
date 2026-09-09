"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const IniciarEncajadoSchema = z.object({
  id: z.string().uuid(),
  lote: z.string().trim().min(1, "El lote es obligatorio."),
});

export async function iniciarEncajado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = IniciarEncajadoSchema.safeParse({
    id: formData.get("id"),
    lote: formData.get("lote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("encajados")
    .update({
      lote: parsed.data.lote,
      started_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo iniciar el encajado." };
  }

  revalidatePath("/encajado");
  return { success: true };
}

export async function deleteEncajado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);

  const parsed = IniciarEncajadoSchema.pick({ id: true }).safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("encajados")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo eliminar el encajado." };
  }

  revalidatePath("/encajado");
  return { success: true };
}

const IdSchema = z.object({ id: z.string().uuid() });

export async function iniciarEstibaEncajado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor"]);

  const parsed = IdSchema.safeParse({ id: formData.get("encajado_id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();

  // Solo puede haber una estiba abierta a la vez por encajado.
  const { data: abierta } = await supabase
    .from("encajado_estibas")
    .select("id")
    .eq("encajado_id", parsed.data.id)
    .is("final_estiba", null)
    .limit(1);
  if (abierta && abierta.length > 0) {
    return { error: "Ya hay una estiba en curso. Finalizala antes de iniciar otra." };
  }

  const { error } = await supabase.from("encajado_estibas").insert({
    encajado_id: parsed.data.id,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo iniciar la estiba." };
  }

  revalidatePath("/encajado");
  return { success: true };
}

export async function finalizarEstibaEncajado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = IdSchema.safeParse({ id: formData.get("estiba_id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("encajado_estibas")
    .update({ final_estiba: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo finalizar la estiba." };
  }

  revalidatePath("/encajado");
  return { success: true };
}

export async function finalizarEncajado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta", "supervisor"]);

  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: abierta } = await supabase
    .from("encajado_estibas")
    .select("id")
    .eq("encajado_id", parsed.data.id)
    .is("final_estiba", null)
    .limit(1);
  if (abierta && abierta.length > 0) {
    return { error: "Finalizá la estiba en curso antes de cerrar el encajado." };
  }

  const { error } = await supabase
    .from("encajados")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "No se pudo finalizar el encajado." };
  }

  revalidatePath("/encajado");
  return { success: true };
}
