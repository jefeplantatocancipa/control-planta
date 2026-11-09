"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const RegistroSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  gas_lectura_m3: z.coerce.number().min(0).optional(),
  agua_edificio_lectura_m3: z.coerce.number().min(0).optional(),
  agua_produccion_lectura_m3: z.coerce.number().min(0).optional(),
  estimado: z.boolean(),
  observaciones: z.string().trim().optional(),
});

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Cada medidor puede tener huecos de varios días sin lectura, así que el
// consumo del día se calcula contra la última lectura real de ESE medidor
// (no contra el día calendario anterior).
async function gasAnterior(supabase: SupabaseServerClient, fecha: string) {
  const { data } = await supabase
    .from("consumos_servicios")
    .select("gas_lectura_m3")
    .lt("fecha", fecha)
    .not("gas_lectura_m3", "is", null)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.gas_lectura_m3 ?? null;
}

async function aguaEdificioAnterior(supabase: SupabaseServerClient, fecha: string) {
  const { data } = await supabase
    .from("consumos_servicios")
    .select("agua_edificio_lectura_m3")
    .lt("fecha", fecha)
    .not("agua_edificio_lectura_m3", "is", null)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.agua_edificio_lectura_m3 ?? null;
}

async function aguaProduccionAnterior(supabase: SupabaseServerClient, fecha: string) {
  const { data } = await supabase
    .from("consumos_servicios")
    .select("agua_produccion_lectura_m3")
    .lt("fecha", fecha)
    .not("agua_produccion_lectura_m3", "is", null)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.agua_produccion_lectura_m3 ?? null;
}

export async function registrarConsumoServicio(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);

  const parsed = RegistroSchema.safeParse({
    fecha: formData.get("fecha"),
    gas_lectura_m3: formData.get("gas_lectura_m3") || undefined,
    agua_edificio_lectura_m3: formData.get("agua_edificio_lectura_m3") || undefined,
    agua_produccion_lectura_m3: formData.get("agua_produccion_lectura_m3") || undefined,
    estimado: formData.get("estimado") === "on",
    observaciones: formData.get("observaciones") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { fecha, gas_lectura_m3, agua_edificio_lectura_m3, agua_produccion_lectura_m3 } =
    parsed.data;

  if (
    gas_lectura_m3 === undefined &&
    agua_edificio_lectura_m3 === undefined &&
    agua_produccion_lectura_m3 === undefined
  ) {
    return { error: "Anotá al menos una lectura." };
  }

  const supabase = await createClient();

  const [gasPrev, edificioPrev, produccionPrev] = await Promise.all([
    gas_lectura_m3 !== undefined ? gasAnterior(supabase, fecha) : Promise.resolve(null),
    agua_edificio_lectura_m3 !== undefined
      ? aguaEdificioAnterior(supabase, fecha)
      : Promise.resolve(null),
    agua_produccion_lectura_m3 !== undefined
      ? aguaProduccionAnterior(supabase, fecha)
      : Promise.resolve(null),
  ]);

  const { error } = await supabase.from("consumos_servicios").upsert(
    {
      fecha,
      gas_lectura_m3: gas_lectura_m3 ?? null,
      gas_consumo_m3:
        gas_lectura_m3 !== undefined ? gas_lectura_m3 - (gasPrev ?? gas_lectura_m3) : null,
      agua_edificio_lectura_m3: agua_edificio_lectura_m3 ?? null,
      agua_edificio_consumo_m3:
        agua_edificio_lectura_m3 !== undefined
          ? agua_edificio_lectura_m3 - (edificioPrev ?? agua_edificio_lectura_m3)
          : null,
      agua_produccion_lectura_m3: agua_produccion_lectura_m3 ?? null,
      agua_produccion_consumo_m3:
        agua_produccion_lectura_m3 !== undefined
          ? agua_produccion_lectura_m3 - (produccionPrev ?? agua_produccion_lectura_m3)
          : null,
      estimado: parsed.data.estimado,
      observaciones: parsed.data.observaciones || null,
      created_by: profile.id,
    },
    { onConflict: "fecha" },
  );

  if (error) {
    return { error: "No se pudo guardar la lectura." };
  }

  revalidatePath("/servicios");
  revalidatePath("/estadisticas");
  return { success: true };
}

export async function borrarConsumoServicio(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["jefe_planta"]);
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Falta el registro." };

  const supabase = await createClient();
  const { error } = await supabase.from("consumos_servicios").delete().eq("id", id);
  if (error) return { error: "No se pudo borrar el registro." };

  revalidatePath("/servicios");
  revalidatePath("/estadisticas");
  return { success: true };
}
