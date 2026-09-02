import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FasalactWordmark } from "@/components/fasalact-wordmark";
import { PrintButton } from "./print-button";
import type { BacheStatus, Database } from "@/lib/supabase/types";

const STATUS_LABELS: Record<BacheStatus, string> = {
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

type StageTemplate =
  Database["public"]["Tables"]["process_stage_templates"]["Row"];
type StageRecord = Database["public"]["Tables"]["bache_stage_records"]["Row"];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function stageDetailText(stage: StageTemplate, record: StageRecord | undefined) {
  if (!record) return "—";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record.parameters)) {
    if (key === "insumos") continue;
    const label = stage.parameter_schema.find((p) => p.key === key)?.label ?? key;
    parts.push(`${label}: ${value}`);
  }
  if (Array.isArray(record.parameters.insumos)) {
    for (const insumo of record.parameters.insumos) {
      parts.push(`${insumo.nombre} (lote ${insumo.lote}, ${insumo.peso}kg, ${insumo.marca})`);
    }
  }
  if (record.notes) parts.push(`Notas: ${record.notes}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-primary">{value}</p>
    </div>
  );
}

export default async function BacheReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["jefe_planta", "supervisor"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: bache } = await supabase
    .from("baches")
    .select("*")
    .eq("id", id)
    .single();

  if (!bache) notFound();

  const [
    { data: product },
    ownTemplates,
    { data: records },
    { data: operarios },
    { data: envasados },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", bache.product_id).single(),
    supabase
      .from("process_stage_templates")
      .select("*")
      .eq("product_id", bache.product_id)
      .order("sequence_order"),
    supabase.from("bache_stage_records").select("*").eq("bache_id", bache.id),
    supabase.from("profiles").select("*"),
    supabase.from("envasados").select("*").eq("bache_id", bache.id),
  ]);

  let stages = ownTemplates.data ?? [];
  if (stages.length === 0) {
    const { data: defaultTemplates } = await supabase
      .from("process_stage_templates")
      .select("*")
      .is("product_id", null)
      .order("sequence_order");
    stages = defaultTemplates ?? [];
  }

  const recordsByStage = new Map(
    (records ?? []).map((record) => [record.stage_template_id, record]),
  );
  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));

  const lastEndedAt = (records ?? []).reduce<string | null>((latest, r) => {
    if (!r.ended_at) return latest;
    return !latest || r.ended_at > latest ? r.ended_at : latest;
  }, null);
  const processEnd = bache.completed_at ?? lastEndedAt;
  const totalTimeLabel = processEnd
    ? durationLabel(bache.started_at, processEnd)
    : "En curso";

  const totalUnidades = (envasados ?? []).reduce(
    (sum, e) => sum + e.cantidad_unidades,
    0,
  );
  const totalMermas = (envasados ?? []).reduce((sum, e) => sum + e.cantidad_mermas, 0);
  const tasaMermas =
    totalUnidades + totalMermas > 0
      ? Math.round((totalMermas / (totalUnidades + totalMermas)) * 1000) / 10
      : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 text-xs print:p-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          Vista de impresión — usá el botón para imprimir o guardar como PDF.
        </p>
        <PrintButton />
      </div>

      <div className="flex items-center justify-between gap-4 border-b-2 border-primary pb-2">
        <FasalactWordmark size="sm" />
        <div className="text-right">
          <p className="text-sm font-bold text-primary">
            INFORME DE PROCESO DE PRODUCCIÓN
          </p>
          <p className="text-[10px] text-muted-foreground">
            Generado el {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 rounded-md bg-muted p-2">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Lote</p>
          <p className="font-semibold">{bache.batch_code}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Producto
          </p>
          <p className="font-semibold">{product?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Volumen
          </p>
          <p className="font-semibold">
            {bache.volumen_total_litros ? `${bache.volumen_total_litros} L` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Estado
          </p>
          <p className="font-semibold">{STATUS_LABELS[bache.status]}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Tiempo total del proceso" value={totalTimeLabel} />
        <StatTile label="Unidades envasadas" value={String(totalUnidades)} />
        <StatTile label="Mermas" value={String(totalMermas)} />
        <StatTile label="Tasa de mermas" value={`${tasaMermas}%`} />
      </div>

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-primary/40 text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Etapa</th>
            <th className="py-1 pr-2">Operario</th>
            <th className="py-1 pr-2">Inicio</th>
            <th className="py-1 pr-2">Fin</th>
            <th className="py-1 pr-2">Dur.</th>
            <th className="py-1">Detalle capturado</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage) => {
            const record = recordsByStage.get(stage.id);
            return (
              <tr key={stage.id} className="break-inside-avoid-page border-b">
                <td className="py-1 pr-2 align-top">{stage.sequence_order}</td>
                <td className="py-1 pr-2 align-top font-medium">{stage.name}</td>
                <td className="py-1 pr-2 align-top">
                  {record ? operarioNames.get(record.operario_id) ?? "—" : "—"}
                </td>
                <td className="py-1 pr-2 align-top">
                  {record ? timeLabel(record.started_at) : "—"}
                </td>
                <td className="py-1 pr-2 align-top">
                  {record?.ended_at ? timeLabel(record.ended_at) : "—"}
                </td>
                <td className="py-1 pr-2 align-top">
                  {record?.ended_at
                    ? durationLabel(record.started_at, record.ended_at)
                    : "—"}
                </td>
                <td className="py-1 align-top">{stageDetailText(stage, record)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex items-end justify-between border-t pt-2 text-[10px] text-muted-foreground">
        <p>Firma responsable: ______________________________</p>
        <p>fasalact food innovation</p>
      </div>
    </div>
  );
}
