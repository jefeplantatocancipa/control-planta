"use server";

import { z } from "zod";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { puedeVerTransportes } from "@/lib/transportes-acceso";
import { isTransportesEnabled } from "@/lib/feature-flags";
import { sendMailWithAttachment } from "@/lib/email/send-mail";
import { llenarFormatoTransporte, serialFecha, serialHora } from "@/lib/transportes/llenar-formato";
import { AREAS, URGENCIA, SI_NO } from "./constants";

// fecha_solicitud/fecha_requerida son columnas "date" planas (sin hora), no
// timestamptz -- formatDate() de @/lib/format-date asume timestamptz y las
// corre un día para atrás (America/Bogota es UTC-5). Mismo fix que ya se usa
// en programa/program-card.tsx y servicios/page.tsx.
function formatFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "dd/MM/yyyy");
}

export interface ActionState {
  error?: string;
  success?: boolean;
}

// TEMPORAL para la prueba del nuevo formato de Excel -- volver a
// "coordinador.logistica2@fasalact.com" antes del cierre definitivo.
const DESTINATARIO = "ser66nn51@gmail.com";

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
  const refrigeracionLabel = data.requiere_refrigeracion === "Si" ? "Sí" : "No";

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

  const xlsxBuffer = await llenarFormatoTransporte({
    A: serialFecha(data.fecha_solicitud),
    B: serialHora(data.hora_solicitud),
    C: profile.full_name,
    D: data.area_solicitante,
    E: data.descripcion,
    F: data.cantidad,
    G: data.peso ?? null,
    H: refrigeracionLabel,
    I: data.origen,
    J: data.destino,
    K: serialFecha(data.fecha_requerida),
    L: serialHora(data.hora_requerida),
    M: data.quien_recibe,
    N: data.urgencia,
  });

  try {
    await sendMailWithAttachment({
      to: DESTINATARIO,
      subject: `Solicitud de transporte — ${data.origen} → ${data.destino}`,
      text:
        `Nueva solicitud de transporte de ${profile.full_name}.\n\n` +
        `Área solicitante: ${data.area_solicitante}\n` +
        `Objeto: ${data.descripcion}\n` +
        `Cantidad: ${data.cantidad}` +
        (data.peso ? ` · Peso aprox: ${data.peso} kg\n` : "\n") +
        `Requiere refrigeración: ${refrigeracionLabel}\n` +
        `Origen: ${data.origen} → Destino: ${data.destino}\n` +
        `Fecha/hora requerida: ${formatFecha(data.fecha_requerida)} ${data.hora_requerida}\n` +
        `Quién recibe: ${data.quien_recibe}\n` +
        `Urgencia: ${data.urgencia}\n\n` +
        "Se adjunta el detalle en Excel.",
      attachment: {
        filename: "Formato_Solicitud_de_Transporte.xlsx",
        content: xlsxBuffer,
      },
    });
  } catch {
    return { error: "La solicitud quedó guardada, pero no se pudo enviar el correo. Avisá por otro medio." };
  }

  return { success: true };
}
