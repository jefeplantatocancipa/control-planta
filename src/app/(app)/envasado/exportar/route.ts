import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { StageRecordParameters } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/format-date";

const HEADERS = [
  "Bache",
  "Presentación",
  "Lote",
  "Insumos (kg)",
  "Unidades",
  "Mermas",
  "Registrado por",
  "Finalizado",
];

// Mismos datos y mismo cálculo de balance de masa que la tabla
// "Finalizados" de /envasado -- un archivo listo para analizar o
// compartir, sin tener que copiar la tabla a mano.
export async function GET() {
  await requireRole(["jefe_planta", "supervisor", "calidad", "asistente_adm"]);
  const supabase = await createClient();

  const [
    [
      { data: envasados },
      { data: baches },
      { data: products },
      { data: operarios },
      { data: insumosStages },
    ],
    stageRecords,
  ] = await Promise.all([
    Promise.all([
      supabase
        .from("envasados")
        .select("*")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false }),
      supabase.from("baches").select("id, batch_code, product_id"),
      supabase.from("products").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
      supabase
        .from("process_stage_templates")
        .select("id, sequence_order")
        .eq("captures_insumos", true),
    ]),
    // bache_stage_records ya pasa de 1000 filas (el tope por pedido de
    // Supabase) -- sin paginar, se trunca solo y deja afuera los baches
    // más recientes.
    fetchAll<{ bache_id: string; stage_template_id: string; parameters: StageRecordParameters }>(
      (from, to) =>
        supabase
          .from("bache_stage_records")
          .select("bache_id, stage_template_id, parameters")
          .range(from, to),
    ),
  ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const bacheLabels = new Map(
    (baches ?? []).map((b) => [
      b.id,
      `${b.batch_code} — ${productNames.get(b.product_id) ?? "—"}`,
    ]),
  );
  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));

  // Balance de masa por bache: misma lógica que la página (última etapa
  // con checklist de insumos, sumando también "base de otro bache").
  const insumosStageOrder = new Map(
    (insumosStages ?? []).map((s) => [s.id, s.sequence_order]),
  );
  const massBalanceByBache = new Map<string, { order: number; kg: number }>();
  for (const record of stageRecords ?? []) {
    const order = insumosStageOrder.get(record.stage_template_id);
    if (order === undefined) continue;
    const insumos = Array.isArray(record.parameters?.insumos)
      ? record.parameters.insumos
      : [];
    const baseOtroBache = Array.isArray(record.parameters?.base_otro_bache)
      ? record.parameters.base_otro_bache
      : [];
    const kg =
      insumos.reduce((sum, i) => sum + (Number(i.peso) || 0), 0) +
      baseOtroBache.reduce((sum, b) => sum + (Number(b.cantidad) || 0), 0);
    const current = massBalanceByBache.get(record.bache_id);
    if (!current || order > current.order) {
      massBalanceByBache.set(record.bache_id, { order, kg });
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Envasados finalizados");

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

  for (const e of envasados ?? []) {
    sheet.addRow([
      bacheLabels.get(e.bache_id) ?? "—",
      e.presentacion,
      e.lote ?? "—",
      massBalanceByBache.get(e.bache_id)?.kg ?? null,
      e.cantidad_unidades,
      e.cantidad_mermas,
      operarioNames.get(e.operario_id) ?? "—",
      e.ended_at ? formatDateTime(e.ended_at) : "",
    ]);
  }

  sheet.columns = [
    { width: 28 },
    { width: 48 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 20 },
    { width: 20 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="envasados-finalizados.xlsx"',
    },
  });
}
