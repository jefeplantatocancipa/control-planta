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

export default async function ProcesoPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: proceso }, { data: templates }] = await Promise.all([
    supabase
      .from("v_proceso_actual")
      .select("*")
      .order("bache_started_at", { ascending: false }),
    supabase
      .from("process_stage_templates")
      .select("*")
      .eq("active", true)
      .order("sequence_order"),
  ]);

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
          Tablero en vivo de los baches en proceso y sus 8 etapas.
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
    </div>
  );
}
