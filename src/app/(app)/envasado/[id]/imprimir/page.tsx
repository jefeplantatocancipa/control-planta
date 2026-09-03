import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FasalactWordmark } from "@/components/fasalact-wordmark";
import { formatTime, formatDate, formatDateTime } from "@/lib/format-date";
import { PrintButton } from "./print-button";

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-primary">{value}</p>
    </div>
  );
}

export default async function EnvasadoReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["jefe_planta", "supervisor"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: envasado } = await supabase
    .from("envasados")
    .select("*")
    .eq("id", id)
    .single();
  if (!envasado) notFound();

  const { data: bache } = await supabase
    .from("baches")
    .select("*")
    .eq("id", envasado.bache_id)
    .single();
  if (!bache) notFound();

  const [
    { data: product },
    { data: operarios },
    { data: insumosUso },
    { data: envasadoInsumos },
    { data: cortes },
    { data: turnos },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", bache.product_id).single(),
    supabase.from("profiles").select("*"),
    supabase.from("envasado_insumos_uso").select("*").eq("envasado_id", envasado.id),
    supabase.from("envasado_insumos").select("*"),
    supabase
      .from("envasado_cortes")
      .select("*")
      .eq("envasado_id", envasado.id)
      .order("started_at"),
    supabase.from("turnos").select("*"),
  ]);

  const corteIds = (cortes ?? []).map((c) => c.id);
  const [{ data: lecturas }, { data: estibas }] = await Promise.all([
    corteIds.length > 0
      ? supabase
          .from("envasado_calidad_lecturas")
          .select("*")
          .in("corte_id", corteIds)
          .order("created_at")
      : Promise.resolve({ data: [] as never[] }),
    corteIds.length > 0
      ? supabase
          .from("envasado_estibas")
          .select("*")
          .in("corte_id", corteIds)
          .order("inicio_estiba")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));
  const insumoNames = new Map((envasadoInsumos ?? []).map((i) => [i.id, i.name]));
  const turnoNames = new Map((turnos ?? []).map((t) => [t.id, t.name]));
  const lecturasByCorte = new Map<string, typeof lecturas>();
  for (const l of lecturas ?? []) {
    const list = lecturasByCorte.get(l.corte_id) ?? [];
    list.push(l);
    lecturasByCorte.set(l.corte_id, list);
  }
  const estibasByCorte = new Map<string, typeof estibas>();
  for (const e of estibas ?? []) {
    const list = estibasByCorte.get(e.corte_id) ?? [];
    list.push(e);
    estibasByCorte.set(e.corte_id, list);
  }

  const cortesCerrados = (cortes ?? []).filter((c) => c.ended_at);
  // Las unidades envasadas son la suma de lo que dio cada estiba (dato
  // real, contado), no la resta de los contadores de inicio/final del
  // turno.
  const totalUnidades = (estibas ?? []).reduce(
    (sum, e) => sum + (e.unidades_por_estiba ?? 0),
    0,
  );
  const totalDesperdicio = cortesCerrados.reduce((sum, c) => sum + (c.desperdicio ?? 0), 0);
  const tasaMermas =
    totalUnidades + totalDesperdicio > 0
      ? Math.round((totalDesperdicio / (totalUnidades + totalDesperdicio)) * 1000) / 10
      : 0;
  const totalTimeLabel = envasado.ended_at
    ? durationLabel(envasado.started_at, envasado.ended_at)
    : "En curso";

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
          <p className="text-sm font-bold text-primary">INFORME DE ENVASADO</p>
          <p className="text-[10px] text-muted-foreground">
            Generado el {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 rounded-md border p-2">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Lote</p>
          <p className="font-semibold">{bache.batch_code}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Producto / Presentación
          </p>
          <p className="font-semibold">
            {product?.name ?? "—"} — {envasado.presentacion}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Fecha</p>
          <p className="font-semibold">{formatDate(envasado.started_at)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Operario responsable
          </p>
          <p className="font-semibold">
            {operarioNames.get(envasado.operario_id) ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Tiempo total" value={totalTimeLabel} />
        <StatTile label="Unidades envasadas" value={String(totalUnidades)} />
        <StatTile label="Desperdicio" value={String(totalDesperdicio)} />
        <StatTile label="Tasa de mermas" value={`${tasaMermas}%`} />
      </div>

      {insumosUso && insumosUso.length > 0 && (
        <div className="text-[10px]">
          <p className="-mx-1.5 mb-1 rounded bg-primary/10 px-1.5 py-1 text-xs font-bold tracking-wide text-primary">
            Insumos de envasado
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-0.5 pr-2 font-normal">Insumo</th>
                <th className="py-0.5 pr-2 font-normal">Lote</th>
                <th className="py-0.5 pr-2 font-normal">Vencimiento</th>
                <th className="py-0.5 pr-2 font-normal">Proveedor</th>
                <th className="py-0.5 font-normal">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {insumosUso.map((i) => (
                <tr key={i.id} className="border-b border-dashed">
                  <td className="py-0.5 pr-2 font-medium">
                    {insumoNames.get(i.envasado_insumo_id) ?? "—"}
                  </td>
                  <td className="py-0.5 pr-2">{i.lote ?? "—"}</td>
                  <td className="py-0.5 pr-2">
                    {i.fecha_vencimiento ? formatDate(`${i.fecha_vencimiento}T00:00:00`) : "—"}
                  </td>
                  <td className="py-0.5 pr-2">{i.proveedor ?? "—"}</td>
                  <td className="py-0.5">{i.cantidad_usada ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {envasado.insumos_observacion && (
            <p className="mt-1 text-muted-foreground">
              Observación: {envasado.insumos_observacion}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {(cortes ?? []).map((corte) => {
          const corteLecturas = lecturasByCorte.get(corte.id) ?? [];
          const corteEstibas = estibasByCorte.get(corte.id) ?? [];
          const operariosLabel = [
            operarioNames.get(corte.operario_id),
            corte.operario_2_id ? operarioNames.get(corte.operario_2_id) : null,
          ]
            .filter(Boolean)
            .join(" y ");

          return (
            <div
              key={corte.id}
              className="break-inside-avoid-page border-b pb-1.5 text-[10px]"
            >
              <div className="-mx-1.5 mb-1 flex items-center justify-between rounded bg-primary/10 px-1.5 py-1">
                <p className="text-xs font-bold tracking-wide text-primary">
                  {turnoNames.get(corte.turno_id) ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  {operariosLabel || "—"} · {formatTime(corte.started_at)}
                  {corte.ended_at ? `–${formatTime(corte.ended_at)}` : " (en curso)"}
                </p>
              </div>

              <table className="mt-1 w-full border-collapse">
                <tbody>
                  <tr className="border-b border-dashed">
                    <td className="w-1/3 py-0.5 pr-2 text-muted-foreground">
                      Unidades (inicio → final)
                    </td>
                    <td className="py-0.5 font-medium">
                      {corte.unidades_inicio} → {corte.unidades_final ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-0.5 pr-2 text-muted-foreground">Desperdicio</td>
                    <td className="py-0.5 font-medium">{corte.desperdicio ?? "—"}</td>
                  </tr>
                </tbody>
              </table>

              {corteLecturas.length > 0 && (
                <table className="mt-1 w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-0.5 pr-2 font-normal">Hora</th>
                      <th className="py-0.5 pr-2 font-normal">Peso prom. (g)</th>
                      <th className="py-0.5 pr-2 font-normal">Sellado</th>
                      <th className="py-0.5 font-normal">Fechado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corteLecturas.map((l) => {
                      const pesos = [l.peso_1, l.peso_2, l.peso_3].filter(
                        (p): p is number => p !== null,
                      );
                      const promedio =
                        pesos.length === 3 ? (pesos[0] + pesos[1] + pesos[2]) / 3 : null;
                      return (
                        <tr key={l.id} className="border-b border-dashed">
                          <td className="py-0.5 pr-2 font-medium">
                            {formatTime(l.created_at)}
                          </td>
                          <td className="py-0.5 pr-2">
                            {promedio !== null ? promedio.toFixed(2) : "—"}
                          </td>
                          <td className="py-0.5 pr-2">
                            {l.sellado_cumple ? "Cumple" : "No cumple"}
                          </td>
                          <td className="py-0.5">{l.fechado_cumple ? "Cumple" : "No cumple"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {corteEstibas.length > 0 && (
                <table className="mt-1 w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-0.5 pr-2 font-normal">Estiba inicio</th>
                      <th className="py-0.5 pr-2 font-normal">Estiba final</th>
                      <th className="py-0.5 font-normal">Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corteEstibas.map((e) => (
                      <tr key={e.id} className="border-b border-dashed">
                        <td className="py-0.5 pr-2 font-medium">
                          {formatTime(e.inicio_estiba)}
                        </td>
                        <td className="py-0.5 pr-2">
                          {e.final_estiba ? formatTime(e.final_estiba) : "—"}
                        </td>
                        <td className="py-0.5">{e.unidades_por_estiba ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {corte.observaciones && (
                <p className="mt-1 text-muted-foreground">Obs: {corte.observaciones}</p>
              )}
            </div>
          );
        })}
        {(cortes ?? []).length === 0 && (
          <p className="text-muted-foreground">Sin turnos registrados.</p>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between border-t pt-2 text-[10px] text-muted-foreground">
        <p>Firma responsable: ______________________________</p>
        <p>fasalact food innovation</p>
      </div>
    </div>
  );
}
