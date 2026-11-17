import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth/dal";
import { puedeVerTransportes } from "@/lib/transportes-acceso";
import { createClient } from "@/lib/supabase/server";
import { URGENCIA } from "../constants";

// Mismas columnas (orden y texto exacto) que el Excel que se manda por
// correo al crear una solicitud -- ver actions.ts.
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
  "Urgencia(Si o No)",
];

function formatFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "dd/MM/yyyy");
}

export async function GET(request: NextRequest) {
  const profile = await requireProfile();
  if (!puedeVerTransportes(profile.email)) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const urgencia = searchParams.get("urgencia");
  const origen = searchParams.get("origen");
  const destino = searchParams.get("destino");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const supabase = await createClient();
  let query = supabase
    .from("solicitudes_transporte")
    .select("*")
    .order("fecha_traslado", { ascending: false })
    .order("hora_traslado", { ascending: false });
  if (area) query = query.eq("area_solicitante", area);
  if (urgencia && (URGENCIA as readonly string[]).includes(urgencia)) {
    query = query.eq("urgencia", urgencia as (typeof URGENCIA)[number]);
  }
  if (origen) query = query.ilike("origen", `%${origen}%`);
  if (destino) query = query.ilike("destino", `%${destino}%`);
  if (desde) query = query.gte("fecha_traslado", desde);
  if (hasta) query = query.lte("fecha_traslado", hasta);

  const { data: solicitudes } = await query;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hoja1");

  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F6FC5" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const s of solicitudes ?? []) {
    sheet.addRow([
      formatFecha(s.fecha_solicitud),
      s.hora_solicitud.slice(0, 5),
      s.solicitante_nombre,
      s.area_solicitante,
      s.descripcion_objeto,
      s.cantidad,
      s.peso_aprox_kg ?? "",
      s.requiere_refrigeracion ? "Sí" : "No",
      s.origen,
      s.destino,
      formatFecha(s.fecha_traslado),
      s.hora_traslado.slice(0, 5),
      s.quien_recibe,
      s.urgencia,
    ]);
  }

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

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="solicitudes-transporte.xlsx"',
    },
  });
}
