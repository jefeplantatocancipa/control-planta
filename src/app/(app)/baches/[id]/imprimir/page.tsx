import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FasalactWordmark } from "@/components/fasalact-wordmark";
import { formatTime, formatDate, formatDateTime } from "@/lib/format-date";
import { PrintButton } from "./print-button";
import type { BacheStatus, Database, StageReading } from "@/lib/supabase/types";

const STATUS_LABELS: Record<BacheStatus, string> = {
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

type StageTemplate =
  Database["public"]["Tables"]["process_stage_templates"]["Row"];
type StageRecord = Database["public"]["Tables"]["bache_stage_records"]["Row"];

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function stageParameterEntries(stage: StageTemplate, record: StageRecord | undefined) {
  if (!record) return [];
  return Object.entries(record.parameters)
    .filter(([key]) => key !== "insumos" && key !== "lecturas")
    .map(([key, value]) => [
      stage.parameter_schema.find((p) => p.key === key)?.label ?? key,
      value,
    ]) as [string, string | number][];
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-primary">{value}</p>
    </div>
  );
}

const CHART_COLORS = ["#005240", "#a3b18a"];

// Curva de las lecturas periódicas (ej. temperatura en pasteurización, pH
// en fermentación): solo grafica los parámetros numéricos, una línea por
// parámetro, para dar de un vistazo la tendencia que ya está en la tabla.
function LecturasChart({
  stage,
  lecturas,
}: {
  stage: StageTemplate;
  lecturas: StageReading[];
}) {
  const numericParams = stage.parameter_schema.filter((p) => p.type === "number");
  const series = numericParams
    .map((param) => ({
      key: param.key,
      label: param.label,
      points: lecturas
        .map((reading, i) => ({ i, v: Number(reading[param.key]) }))
        .filter((p) => !Number.isNaN(p.v)),
    }))
    .filter((s) => s.points.length >= 2);

  if (series.length === 0) return null;

  const width = 560;
  const height = 108;
  const padL = 30;
  const padR = 14;
  const padT = 10;
  const padB = 8;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = series.flatMap((s) => s.points.map((p) => p.v));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const yMin = min - range * 0.15;
  const yMax = max + range * 0.15;

  const n = lecturas.length;
  const xFor = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1 w-full"
      style={{ maxWidth: `${width}px`, height: "auto" }}
    >
      {[0, 0.5, 1].map((frac) => {
        const y = padT + plotH * frac;
        return (
          <line
            key={frac}
            x1={padL}
            x2={width - padR}
            y1={y}
            y2={y}
            stroke="#ddd6c6"
            strokeWidth="0.75"
            strokeDasharray="2,2"
          />
        );
      })}
      <text x={padL - 4} y={padT + 3} textAnchor="end" fontSize="7" fill="#8a8578">
        {yMax.toFixed(1)}
      </text>
      <text x={padL - 4} y={padT + plotH + 3} textAnchor="end" fontSize="7" fill="#8a8578">
        {yMin.toFixed(1)}
      </text>

      {series.map((s, si) => {
        const color = CHART_COLORS[si % CHART_COLORS.length];
        const d = s.points
          .map((p, idx) => `${idx === 0 ? "M" : "L"}${xFor(p.i).toFixed(1)},${yFor(p.v).toFixed(1)}`)
          .join(" ");
        const last = s.points[s.points.length - 1];
        return (
          <g key={s.key}>
            <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
            {s.points.map((p) => (
              <circle key={p.i} cx={xFor(p.i)} cy={yFor(p.v)} r="1.6" fill={color} />
            ))}
            {/* Etiqueta de la serie con el último valor, en una posición fija
                arriba a la derecha (no pegada al último punto) para que no
                se superponga entre series ni se salga del gráfico. */}
            <text
              x={width - padR}
              y={padT + 7 + si * 9}
              textAnchor="end"
              fontSize="7"
              fontWeight="600"
              fill={color}
            >
              {s.label} {last.v}
            </text>
          </g>
        );
      })}
    </svg>
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
    <div className="mx-auto flex max-w-3xl flex-col gap-3 bg-white p-4 text-xs print:p-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body {
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
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
            Generado el {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 rounded-md border p-2">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Lote</p>
          <p className="font-semibold">{bache.batch_code}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Fecha de elaboración
          </p>
          <p className="font-semibold">{formatDate(bache.started_at)}</p>
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

      <div className="flex flex-col gap-1.5">
        {stages.map((stage) => {
          const record = recordsByStage.get(stage.id);
          const paramEntries = stageParameterEntries(stage, record);
          const insumos =
            record && Array.isArray(record.parameters.insumos)
              ? record.parameters.insumos
              : null;
          const lecturas =
            record && Array.isArray(record.parameters.lecturas)
              ? record.parameters.lecturas
              : null;

          return (
            <div
              key={stage.id}
              className="break-inside-avoid-page border-b pb-1.5 text-[10px]"
            >
              <p className="-mx-1.5 mb-1 rounded bg-primary/10 px-1.5 py-1 text-xs font-bold tracking-wide text-primary">
                {stage.sequence_order}. {stage.name}
              </p>

              {record ? (
                <table className="mt-1 w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-0.5 pr-2 font-normal">Operario</th>
                      <th className="py-0.5 pr-2 font-normal">Inicio</th>
                      <th className="py-0.5 pr-2 font-normal">Final</th>
                      <th className="py-0.5 font-normal">Tiempo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-dashed">
                      <td className="py-0.5 pr-2 font-medium">
                        {operarioNames.get(record.operario_id) ?? "—"}
                      </td>
                      <td className="py-0.5 pr-2">{formatTime(record.started_at)}</td>
                      <td className="py-0.5 pr-2">
                        {record.ended_at ? formatTime(record.ended_at) : "—"}
                      </td>
                      <td className="py-0.5">
                        {record.ended_at
                          ? durationLabel(record.started_at, record.ended_at)
                          : "En curso"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="mt-1 text-muted-foreground">Sin iniciar</p>
              )}

              {paramEntries.length > 0 && (
                <table className="mt-1 w-full border-collapse">
                  <tbody>
                    {paramEntries.map(([label, value]) => (
                      <tr key={label} className="border-b border-dashed">
                        <td className="w-1/3 py-0.5 pr-2 text-muted-foreground">
                          {label}
                        </td>
                        <td className="py-0.5 font-medium">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {insumos && insumos.length > 0 && (
                <table className="mt-1 w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-0.5 pr-2 font-normal">Insumo</th>
                      <th className="py-0.5 pr-2 font-normal">Lote</th>
                      <th className="py-0.5 pr-2 font-normal">Marca</th>
                      <th className="py-0.5 font-normal">Cant. (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insumos.map((insumo, idx) => (
                      <tr key={idx} className="border-b border-dashed">
                        <td className="py-0.5 pr-2 font-medium">{insumo.nombre}</td>
                        <td className="py-0.5 pr-2">{insumo.lote}</td>
                        <td className="py-0.5 pr-2">{insumo.marca}</td>
                        <td className="py-0.5">{insumo.peso}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="py-0.5 pr-2 text-right font-semibold">
                        Balance de masa (insumos)
                      </td>
                      <td className="py-0.5 font-semibold">
                        {insumos.reduce((sum, i) => sum + (Number(i.peso) || 0), 0)} kg
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {lecturas && lecturas.length > 0 && (
                <table className="mt-1 w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-0.5 pr-2 font-normal">Hora</th>
                      {stage.parameter_schema.map((param) => (
                        <th key={param.key} className="py-0.5 pr-2 font-normal">
                          {param.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lecturas.map((reading, idx) => (
                      <tr key={idx} className="border-b border-dashed">
                        <td className="py-0.5 pr-2 font-medium">
                          {formatTime(reading.timestamp)}
                        </td>
                        {stage.parameter_schema.map((param) => (
                          <td key={param.key} className="py-0.5 pr-2">
                            {reading[param.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {lecturas && lecturas.length > 1 && (
                <LecturasChart stage={stage} lecturas={lecturas} />
              )}

              {record?.notes && (
                <p className="mt-1 text-muted-foreground">Notas: {record.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-end justify-between border-t pt-2 text-[10px] text-muted-foreground">
        <p>Firma responsable: ______________________________</p>
        <p>fasalact food innovation</p>
      </div>
    </div>
  );
}
