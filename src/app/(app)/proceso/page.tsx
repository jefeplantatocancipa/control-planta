import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function timeSince(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${rest} min`;
}

function durationLabel(startMs: number, endMs: number) {
  const minutes = Math.round((endMs - startMs) / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

export default async function ProcesoPage() {
  await requireProfile();
  const supabase = await createClient();

  const [
    { data: proceso },
    { data: templates },
    { data: envasadosAbiertos },
    { data: allBaches },
    { data: products },
    { data: cortes },
    { data: estibas },
    { data: paradas },
  ] = await Promise.all([
    supabase
      .from("v_proceso_actual")
      .select("*")
      .order("bache_started_at", { ascending: false }),
    supabase
      .from("process_stage_templates")
      .select("*")
      .eq("active", true)
      .order("sequence_order"),
    supabase.from("envasados").select("*").is("ended_at", null),
    supabase.from("baches").select("id, batch_code, product_id"),
    supabase.from("products").select("id, name"),
    supabase.from("envasado_cortes").select("id, envasado_id"),
    supabase.from("envasado_estibas").select("corte_id, unidades_por_estiba"),
    supabase.from("envasado_paradas").select("*"),
  ]);

  const bachesById = new Map((allBaches ?? []).map((b) => [b.id, b]));
  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const envasadoIdByCorte = new Map((cortes ?? []).map((c) => [c.id, c.envasado_id]));

  const unidadesByEnvasado = new Map<string, number>();
  for (const estiba of estibas ?? []) {
    const envasadoId = envasadoIdByCorte.get(estiba.corte_id);
    if (!envasadoId) continue;
    unidadesByEnvasado.set(
      envasadoId,
      (unidadesByEnvasado.get(envasadoId) ?? 0) + (estiba.unidades_por_estiba ?? 0),
    );
  }

  const paradasByEnvasado = new Map<string, { started_at: string; ended_at: string | null }[]>();
  for (const parada of paradas ?? []) {
    const list = paradasByEnvasado.get(parada.envasado_id) ?? [];
    list.push({ started_at: parada.started_at, ended_at: parada.ended_at });
    paradasByEnvasado.set(parada.envasado_id, list);
  }

  const envasadosEnCurso = (envasadosAbiertos ?? []).map((envasado) => {
    const bache = bachesById.get(envasado.bache_id);
    const tiempoParadasMs = (paradasByEnvasado.get(envasado.id) ?? []).reduce(
      (sum, p) =>
        sum +
        (new Date(p.ended_at ?? new Date().toISOString()).getTime() -
          new Date(p.started_at).getTime()),
      0,
    );
    return {
      id: envasado.id,
      bacheLabel: bache
        ? `${bache.batch_code} — ${productNames.get(bache.product_id) ?? "—"}`
        : "—",
      presentacion: envasado.presentacion,
      unidades: unidadesByEnvasado.get(envasado.id) ?? 0,
      startedAt: envasado.started_at,
      tiempoParadasMs,
      hayParadaAbierta: (paradasByEnvasado.get(envasado.id) ?? []).some((p) => !p.ended_at),
    };
  });

  const totalStagesByProduct = new Map<string, number>();
  const defaultStageCount = (templates ?? []).filter((t) => t.product_id === null).length;
  for (const template of templates ?? []) {
    if (!template.product_id) continue;
    totalStagesByProduct.set(
      template.product_id,
      (totalStagesByProduct.get(template.product_id) ?? 0) + 1,
    );
  }

  const baches = proceso ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Proceso actual</h1>
        <p className="text-muted-foreground">
          Tablero en vivo de los procesos de producción en curso, etapa por etapa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {baches.map((bache) => {
          const totalStages =
            totalStagesByProduct.get(bache.product_id) || defaultStageCount || 8;
          const current = bache.sequence_order ?? 0;
          const inProgress = current > 0 && !bache.stage_ended_at;
          const allDone = current === totalStages && Boolean(bache.stage_ended_at);

          return (
            <Card key={bache.bache_id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{bache.batch_code}</span>
                  {allDone ? (
                    <Badge>Listo para cerrar</Badge>
                  ) : inProgress ? (
                    <Badge variant="secondary">En curso</Badge>
                  ) : (
                    <Badge variant="outline">Sin iniciar</Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {bache.product_name} · hace {timeSince(bache.bache_started_at)}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-1">
                  {Array.from({ length: totalStages }, (_, i) => i + 1).map((n) => (
                    <div
                      key={n}
                      className={cn(
                        "h-2 flex-1 rounded-full",
                        n < current || (n === current && bache.stage_ended_at)
                          ? "bg-primary"
                          : n === current
                            ? "bg-primary/40"
                            : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                {bache.stage_name ? (
                  <div className="text-sm">
                    <p className="font-medium">
                      Etapa {current}/{totalStages}: {bache.stage_name}
                    </p>
                    <p className="text-muted-foreground">
                      {bache.operario_name ?? "—"}
                      {inProgress && bache.stage_started_at
                        ? ` · hace ${timeSince(bache.stage_started_at)}`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía no se inició ninguna etapa.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {baches.length === 0 && (
          <p className="text-muted-foreground">No hay baches en proceso.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Envasado en curso</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {envasadosEnCurso.map((envasado) => (
            <Card key={envasado.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{envasado.bacheLabel}</span>
                  {envasado.hayParadaAbierta && (
                    <Badge variant="outline">Parado</Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{envasado.presentacion}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <p>
                  Unidades envasadas:{" "}
                  <span className="font-semibold">{envasado.unidades}</span>
                </p>
                <p className="text-muted-foreground">
                  Inicio: hace {timeSince(envasado.startedAt)}
                </p>
                <p className="text-muted-foreground">
                  Tiempo de paradas:{" "}
                  {envasado.tiempoParadasMs > 0
                    ? durationLabel(0, envasado.tiempoParadasMs)
                    : "0 min"}
                </p>
              </CardContent>
            </Card>
          ))}
          {envasadosEnCurso.length === 0 && (
            <p className="text-muted-foreground">Sin envasados en curso.</p>
          )}
        </div>
      </div>
    </div>
  );
}
