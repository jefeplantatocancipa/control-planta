"use server";

import ExcelJS from "exceljs";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { puedeVerTransportes } from "@/lib/transportes-acceso";
import { sendMailWithAttachment } from "@/lib/email/send-mail";
import { formatDate, formatTime } from "@/lib/format-date";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Fijo por ahora: un solo destinatario para todas las solicitudes. Si en el
// futuro hace falta variarlo, se vuelve una variable de entorno.
const DESTINATARIO = "coordinador.logistica2@fasalact.com";

const HEADERS = [
  "Fecha de Solicitud",
  "Hora de Solicitud",
  "Quién lo Solicita",
  "Área Solicitante",
  "Descripción del Objeto a Transportar",
  "Cantidad",
  "Peso(Aprox)",
  "Requiere Refrigeración",
  "Origen",
  "Destino",
  "Fecha Requerida del Traslado",
  "Hora Requerida del Traslado",
  "Quién Recibe",
  "Urgencia (Si o No)",
];

const SolicitudTransporteSchema = z.object({
  area_solicitante: z.string().trim().min(1, "El área solicitante es obligatoria."),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  peso: z.coerce.number().positive("El peso debe ser mayor a 0."),
  requiere_refrigeracion: z.enum(["Si", "No"]),
  origen: z.string().trim().min(1, "El origen es obligatorio."),
  destino: z.string().trim().min(1, "El destino es obligatorio."),
  fecha_requerida: z.string().min(1, "La fecha requerida es obligatoria."),
  hora_requerida: z.string().min(1, "La hora requerida es obligatoria."),
  quien_recibe: z.string().trim().min(1, "Quién recibe es obligatorio."),
  urgencia: z.enum(["Si", "No"]),
});

export async function solicitarTransporte(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  if (!puedeVerTransportes(profile.email)) {
    return { error: "No tenés acceso a este módulo." };
  }

  const parsed = SolicitudTransporteSchema.safeParse({
    area_solicitante: formData.get("area_solicitante"),
    descripcion: formData.get("descripcion"),
    cantidad: formData.get("cantidad"),
    peso: formData.get("peso"),
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

  const ahora = new Date().toISOString();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Solicitud de transporte");
  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6FC5" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  sheet.addRow([
    formatDate(ahora),
    formatTime(ahora),
    profile.full_name,
    data.area_solicitante,
    data.descripcion,
    data.cantidad,
    data.peso,
    data.requiere_refrigeracion,
    data.origen,
    data.destino,
    data.fecha_requerida,
    data.hora_requerida,
    data.quien_recibe,
    data.urgencia,
  ]);
  sheet.columns = [
    { width: 16 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 36 },
    { width: 10 },
    { width: 12 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 20 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  try {
    await sendMailWithAttachment({
      to: DESTINATARIO,
      subject: `Solicitud de transporte — ${data.origen} → ${data.destino}`,
      text:
        `Nueva solicitud de transporte de ${profile.full_name}.\n\n` +
        `Área solicitante: ${data.area_solicitante}\n` +
        `Objeto: ${data.descripcion}\n` +
        `Cantidad: ${data.cantidad} · Peso aprox: ${data.peso} kg\n` +
        `Requiere refrigeración: ${data.requiere_refrigeracion}\n` +
        `Origen: ${data.origen} → Destino: ${data.destino}\n` +
        `Fecha/hora requerida: ${data.fecha_requerida} ${data.hora_requerida}\n` +
        `Quién recibe: ${data.quien_recibe}\n` +
        `Urgencia: ${data.urgencia}\n\n` +
        "Se adjunta el detalle en Excel.",
      attachment: {
        filename: `solicitud-transporte-${data.fecha_requerida}.xlsx`,
        content: Buffer.from(buffer),
      },
    });
  } catch {
    return { error: "No se pudo enviar el correo. Intentá de nuevo en un momento." };
  }

  return { success: true };
}
