import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ConsolidadoCumplimiento, type CumplimientoRow } from "./consolidado";

export default async function CumplimientoPage() {
  await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);
  const supabase = await createClient();

  const [
    { data: bachesData },
    { data: envasadoOrdersData },
    { data: envasadoReferenciasData },
    { data: envasadosData },
  ] = await Promise.all([
    supabase
      .from("v_cumplimiento_programa")
      .select("*")
      .order("scheduled_date", { ascending: false }),
    supabase
      .from("envasado_orders")
      .select("id, referencia_id, scheduled_date, planned_quantity")
      .order("scheduled_date", { ascending: false }),
    supabase.from("envasado_referencias").select("id, name"),
    supabase.from("envasados").select("envasado_order_id, cantidad_unidades"),
  ]);

  const referenciaNameById = new Map(
    (envasadoReferenciasData ?? []).map((r) => [r.id, r.name]),
  );

  const bachesRows: CumplimientoRow[] = (bachesData ?? []).map((r) => ({
    id: r.product_id,
    name: r.product_name,
    scheduled_date: r.scheduled_date,
    planned: r.planned_quantity,
    executed: r.executed_quantity,
    unit: r.unit,
  }));

  const executedByOrder = new Map<string, number>();
  for (const e of envasadosData ?? []) {
    if (!e.envasado_order_id) continue;
    executedByOrder.set(
      e.envasado_order_id,
      (executedByOrder.get(e.envasado_order_id) ?? 0) + e.cantidad_unidades,
    );
  }

  const envasadoRows: CumplimientoRow[] = (envasadoOrdersData ?? []).map((o) => ({
    id: o.referencia_id,
    name: referenciaNameById.get(o.referencia_id) ?? "Referencia eliminada",
    scheduled_date: o.scheduled_date,
    planned: o.planned_quantity,
    executed: executedByOrder.get(o.id) ?? 0,
    unit: "und",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cumplimiento del programa</h1>
        <p className="text-muted-foreground">
          Planeado vs. ejecutado por producto — diario, semanal (viernes a
          jueves) y mensual.
        </p>
      </div>

      <ConsolidadoCumplimiento bachesRows={bachesRows} envasadoRows={envasadoRows} />
    </div>
  );
}
