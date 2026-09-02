import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";
import type { BacheStatus } from "@/lib/supabase/types";

const STATUS_LABELS: Record<BacheStatus, string> = {
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

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
  return `${minutes} min`;
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

  const [{ data: product }, ownTemplates, { data: records }, { data: operarios }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", bache.product_id).single(),
      supabase
        .from("process_stage_templates")
        .select("*")
        .eq("product_id", bache.product_id)
        .order("sequence_order"),
      supabase.from("bache_stage_records").select("*").eq("bache_id", bache.id),
      supabase.from("profiles").select("*"),
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 print:p-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          Vista de impresión — usá el botón para imprimir o guardar como PDF.
        </p>
        <PrintButton />
      </div>

      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Informe de proceso — {bache.batch_code}</h1>
          <p className="text-muted-foreground">
            {product?.name ?? "—"}
            {bache.volumen_total_litros ? ` · ${bache.volumen_total_litros} L` : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{STATUS_LABELS[bache.status]}</p>
          <p className="text-muted-foreground">
            Inicio: {format(new Date(bache.started_at), "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
          {bache.completed_at && (
            <p className="text-muted-foreground">
              Cierre: {format(new Date(bache.completed_at), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {stages.map((stage) => {
          const record = recordsByStage.get(stage.id);
          const paramEntries = record
            ? (Object.entries(record.parameters).filter(
                ([key]) => key !== "insumos",
              ) as [string, string | number][])
            : [];
          const insumos =
            record && Array.isArray(record.parameters.insumos)
              ? record.parameters.insumos
              : null;

          return (
            <div
              key={stage.id}
              className="break-inside-avoid-page rounded-lg border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {stage.sequence_order}. {stage.name}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {record?.ended_at
                    ? "Completada"
                    : record
                      ? "En curso"
                      : "Sin iniciar"}
                </span>
              </div>

              {record ? (
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <p className="text-muted-foreground">
                    {operarioNames.get(record.operario_id) ?? "—"} ·{" "}
                    {timeLabel(record.started_at)}
                    {record.ended_at
                      ? `–${timeLabel(record.ended_at)} (${durationLabel(record.started_at, record.ended_at)})`
                      : ""}
                  </p>
                  {paramEntries.length > 0 && (
                    <ul className="list-inside list-disc">
                      {paramEntries.map(([key, value]) => (
                        <li key={key}>
                          {stage.parameter_schema.find((p) => p.key === key)?.label ??
                            key}
                          : {value}
                        </li>
                      ))}
                    </ul>
                  )}
                  {insumos && (
                    <ul className="list-inside list-disc">
                      {insumos.map((insumo, idx) => (
                        <li key={idx}>
                          {insumo.nombre}: Lote {insumo.lote} · {insumo.peso} kg ·{" "}
                          {insumo.marca}
                        </li>
                      ))}
                    </ul>
                  )}
                  {record.notes && <p>Notas: {record.notes}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Esta etapa no se llegó a iniciar.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Generado el {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
      </p>
    </div>
  );
}
