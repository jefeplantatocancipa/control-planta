import { format } from "date-fns";
import { sendMailWithAttachment } from "@/lib/email/send-mail";
import { llenarFormatoTransporte, serialFecha, serialHora } from "@/lib/transportes/llenar-formato";

// Fijo por ahora: un solo destinatario para todas las solicitudes. Si en el
// futuro hace falta variarlo, se vuelve una variable de entorno.
export const DESTINATARIO = "coordinador.logistica2@fasalact.com";

// fecha_solicitud/fecha_traslado son columnas "date" planas (sin hora), no
// timestamptz -- formatDate() de @/lib/format-date asume timestamptz y las
// corre un día para atrás (America/Bogota es UTC-5).
function formatFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "dd/MM/yyyy");
}

export interface SolicitudParaCorreo {
  solicitante_nombre: string;
  area_solicitante: string;
  descripcion_objeto: string;
  cantidad: number;
  peso_aprox_kg: number | null;
  requiere_refrigeracion: boolean;
  origen: string;
  destino: string;
  fecha_solicitud: string;
  hora_solicitud: string;
  fecha_traslado: string;
  hora_traslado: string;
  quien_recibe: string;
  urgencia: string;
}

// Compartido entre solicitarTransporte (al crear) y reenviarSolicitudTransporte
// (desde el listado) -- arma el mismo Excel (plantilla oficial llena, ver
// src/lib/transportes/llenar-formato.ts) y el mismo correo a partir de una
// solicitud ya validada, recién creada o leída de vuelta de la base.
export async function enviarCorreoSolicitudTransporte(s: SolicitudParaCorreo): Promise<void> {
  const refrigeracionLabel = s.requiere_refrigeracion ? "Sí" : "No";

  const xlsxBuffer = await llenarFormatoTransporte({
    A: serialFecha(s.fecha_solicitud),
    B: serialHora(s.hora_solicitud),
    C: s.solicitante_nombre,
    D: s.area_solicitante,
    E: s.descripcion_objeto,
    F: s.cantidad,
    G: s.peso_aprox_kg,
    H: refrigeracionLabel,
    I: s.origen,
    J: s.destino,
    K: serialFecha(s.fecha_traslado),
    L: serialHora(s.hora_traslado),
    M: s.quien_recibe,
    N: s.urgencia,
  });

  await sendMailWithAttachment({
    to: DESTINATARIO,
    subject: `Solicitud de transporte — ${s.origen} → ${s.destino}`,
    text:
      `Nueva solicitud de transporte de ${s.solicitante_nombre}.\n\n` +
      `Área solicitante: ${s.area_solicitante}\n` +
      `Objeto: ${s.descripcion_objeto}\n` +
      `Cantidad: ${s.cantidad}` +
      (s.peso_aprox_kg ? ` · Peso aprox: ${s.peso_aprox_kg} kg\n` : "\n") +
      `Requiere refrigeración: ${refrigeracionLabel}\n` +
      `Origen: ${s.origen} → Destino: ${s.destino}\n` +
      `Fecha/hora requerida: ${formatFecha(s.fecha_traslado)} ${s.hora_traslado.slice(0, 5)}\n` +
      `Quién recibe: ${s.quien_recibe}\n` +
      `Urgencia: ${s.urgencia}\n\n` +
      "Se adjunta el detalle en Excel.",
    attachment: {
      filename: "Formato_Solicitud_de_Transporte.xlsx",
      content: xlsxBuffer,
    },
  });
}
