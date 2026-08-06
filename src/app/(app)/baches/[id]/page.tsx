import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { StageCard } from "./stage-card";
import { BacheStatusActions } from "./bache-status-actions";
import type { BacheStatus } from "@/lib/supabase/types";

const STATUS_LABELS: Record<BacheStatus, string> = {
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export default async function BacheDetailPage({
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
        .eq("active", true)
        .order("sequence_order"),
      supabase.from("bache_stage_records").select("*").eq("bache_id", bache.id),
      supabase.from("profiles").select("*").eq("active", true).order("full_name"),
    ]);

  let stages = ownTemplates.data ?? [];
  if (stages.length === 0) {
    const { data: defaultTemplates } = await supabase
      .from("process_stage_templates")
      .select("*")
      .is("product_id", null)
      .eq("active", true)
      .order("sequence_order");
    stages = defaultTemplates ?? [];
  }

  const recordsByStage = new Map(
    (records ?? []).map((record) => [record.stage_template_id, record]),
  );

  const canAct = bache.status === "en_proceso";
  const allStagesDone =
    stages.length > 0 &&
    stages.every((stage) => recordsByStage.get(stage.id)?.ended_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{bache.batch_code}</h1>
          <p className="text-muted-foreground">
            {product?.name ?? "—"}
            {bache.volumen_total_litros
              ? ` · ${bache.volumen_total_litros} L`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant={
              bache.status === "en_proceso"
                ? "default"
                : bache.status === "completado"
                  ? "secondary"
                  : "outline"
            }
          >
            {STATUS_LABELS[bache.status]}
          </Badge>
          {canAct && (
            <BacheStatusActions bacheId={bache.id} allStagesDone={allStagesDone} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage, index) => {
          const record = recordsByStage.get(stage.id) ?? null;
          const previousStage = index > 0 ? stages[index - 1] : null;
          const unlocked =
            index === 0 || Boolean(recordsByStage.get(previousStage!.id)?.ended_at);

          return (
            <StageCard
              key={stage.id}
              bacheId={bache.id}
              stage={stage}
              record={record}
              operarios={operarios ?? []}
              canAct={canAct}
              unlocked={unlocked}
            />
          );
        })}
        {stages.length === 0 && (
          <p className="text-muted-foreground">
            Este producto no tiene etapas configuradas. Definilas en
            Administración.
          </p>
        )}
      </div>
    </div>
  );
}
