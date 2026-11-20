"use server";

import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { puedeVerTransportes } from "@/lib/transportes-acceso";
import { isTransportesEnabled } from "@/lib/feature-flags";
import { enviarCorreoSolicitudTransporte } from "./correo-solicitud";
import { AREAS, URGENCIA, SI_NO } from "./constants";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const NUMERO_INVALIDO = "Por favor incluir únicamente datos numéricos.";

const SolicitudTransporteSchema = z
  .object({
    fecha_solicitud: z.string().min(1, "La fecha de solicitud es obligatoria."),
    hora_solicitud: z
      .string()
      .min(1, "La hora de solicitud es obligatoria.")
      .refine((h) => h >= "07:00" && h <= "17:00", {
        message: "La hora de solicitud debe estar entre 07:00 y 17:00.",
      }),
    area_solicitante: z.enum(AREAS, { message: "Elegí un área." }),
    descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
    cantidad: z.coerce.number().int(NUMERO_INVALIDO).min(1, NUMERO_INVALIDO),
    peso: z.coerce.number().int(NUMERO_INVALIDO).min(1, NUMERO_INVALIDO).optional(),
    requiere_refrigeracion: z.enum(SI_NO),
    origen: z.string().trim().min(1, "El origen es obligatorio."),
    destino: z.string().trim().min(1, "El destino es obligatorio."),
    fecha_requerida: z.string().min(1, "La fecha requerida es obligatoria."),
    hora_requerida: z.string().min(1, "La hora requerida es obligatoria."),
    quien_recibe: z.string().trim().min(1, "Quién recibe es obligatorio."),
    urgencia: z.enum(URGENCIA),
  })
  .refine((d) => d.origen.trim().toLowerCase() !== d.destino.trim().toLowerCase(), {
    message: "El destino tiene que ser distinto del origen.",
    path: ["destino"],
  })
  .refine((d) => d.fecha_requerida >= d.fecha_solicitud, {
    message: "La fecha requerida del traslado no puede ser anterior a la de hoy.",
    path: ["fecha_requerida"],
  });

export async function solicitarTransporte(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!isTransportesEnabled() || !puedeVerTransportes(profile.email)) {
    return { error: "No tenés acceso a este módulo." };
  }

  const peso = formData.get("peso");
  const parsed = SolicitudTransporteSchema.safeParse({
    fecha_solicitud: formData.get("fecha_solicitud"),
    hora_solicitud: formData.get("hora_solicitud"),
    area_solicitante: formData.get("area_solicitante"),
    descripcion: formData.get("descripcion"),
    cantidad: formData.get("cantidad"),
    peso: peso ? peso : undefined,
    requiere_refrigeracion: formData.get("requiere_refrigeracion"),
    origen: formData.get("origen"),
    destino: formData.get("destino"),
    fecha_requerida: formData.get("fecha_requerida"),
    hora_requerida: formData.get("hora_requerida"),
    quien_recibe: formData.get("quien_recibe"),
    urgencia: formData.get("urgencia"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("solicitudes_transporte").insert({
    fecha_solicitud: data.fecha_solicitud,
    hora_solicitud: data.hora_solicitud,
    solicitante_id: profile.id,
    solicitante_nombre: profile.full_name,
    area_solicitante: data.area_solicitante,
    descripcion_objeto: data.descripcion,
    cantidad: data.cantidad,
    peso_aprox_kg: data.peso ?? null,
    requiere_refrigeracion: data.requiere_refrigeracion === "Si",
    origen: data.origen,
    destino: data.destino,
    fecha_traslado: data.fecha_requerida,
    hora_traslado: data.hora_requerida,
    quien_recibe: data.quien_recibe,
    urgencia: data.urgencia,
  });
  if (insertError) {
    return { error: "No se pudo guardar la solicitud." };
  }

  try {
    await enviarCorreoSolicitudTransporte({
      solicitante_nombre: profile.full_name,
      area_solicitante: data.area_solicitante,
      descripcion_objeto: data.descripcion,
      cantidad: data.cantidad,
      peso_aprox_kg: data.peso ?? null,
      requiere_refrigeracion: data.requiere_refrigeracion === "Si",
      origen: data.origen,
      destino: data.destino,
      fecha_solicitud: data.fecha_solicitud,
      hora_solicitud: data.hora_solicitud,
      fecha_traslado: data.fecha_requerida,
      hora_traslado: data.hora_requerida,
      quien_recibe: data.quien_recibe,
      urgencia: data.urgencia,
    });
  } catch {
    return { error: "La solicitud quedó guardada, pero no se pudo enviar el correo. Avisá por otro medio." };
  }

  return { success: true };
}

const ReenviarSolicitudSchema = z.object({ id: z.string().uuid() });

export async function reenviarSolicitudTransporte(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!isTransportesEnabled() || !puedeVerTransportes(profile.email)) {
    return { error: "No tenés acceso a este módulo." };
  }

  const parsed = ReenviarSolicitudSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("solicitudes_transporte")
    .select("*")
    .eq("id", parsed.data.id)
    .single();
  if (!s) {
    return { error: "No se encontró la solicitud." };
  }

  try {
    await enviarCorreoSolicitudTransporte(s);
  } catch {
    return { error: "No se pudo reenviar el correo." };
  }

  return { success: true };
}
