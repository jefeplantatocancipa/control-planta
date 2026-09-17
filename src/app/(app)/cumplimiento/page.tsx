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
    supabase.from("envasado_referencias").select("id, sku, name"),
    supabase.from("envasados").select("referencia_id, presentacion, cantidad_unidades, started_at"),
  ]);

  const bachesRows: CumplimientoRow[] = (bachesData ?? []).map((r) => ({
    id: r.product_id,
    name: r.product_name,
    scheduled_date: r.scheduled_date,
    planned: r.planned_quantity,
    executed: r.executed_quantity,
    unit: r.unit,
  }));

  // El "ejecutado" de envasado se cuenta por la fecha real en que se hizo
  // (started_at), no por la fecha programada de la orden -- una orden
  // programada para un día puede terminar ejecutándose otro, y muchos
  // envasados ni siquiera tienen una orden asociada (se puede envasar sin
  // elegir una). Programado y ejecutado se calculan por separado y se
  // combinan al agregarlos (mismo id de referencia + misma fecha), así que
  // no hace falta que cada envasado individual tenga una orden.
  const referenciaNameById = new Map((envasadoReferenciasData ?? []).map((r) => [r.id, r.name]));
  const referenciaIdByLabel = new Map(
    (envasadoReferenciasData ?? []).map((r) => [`${r.sku} — ${r.name}`, r.id]),
  );
  const referenciaIdByName = new Map((envasadoReferenciasData ?? []).map((r) => [r.name, r.id]));
  function resolveReferencia(e: { referencia_id: string | null; presentacion: string }) {
    if (e.referencia_id && referenciaNameById.has(e.referencia_id)) {
      return { id: e.referencia_id, name: referenciaNameById.get(e.referencia_id)! };
    }
    const byLabel = referenciaIdByLabel.get(e.presentacion);
    if (byLabel) return { id: byLabel, name: referenciaNameById.get(byLabel)! };
    const parts = e.presentacion.split(" — ");
    const nameGuess = (parts.length > 1 ? parts.slice(1).join(" — ") : e.presentacion).trim();
    const byName = referenciaIdByName.get(nameGuess);
    return byName ? { id: byName, name: referenciaNameById.get(byName)! } : null;
  }

  const envasadoPlanRows: CumplimientoRow[] = (envasadoOrdersData ?? []).map((o) => ({
    id: o.referencia_id,
    name: referenciaNameById.get(o.referencia_id) ?? "Referencia eliminada",
    scheduled_date: o.scheduled_date,
    planned: o.planned_quantity,
    executed: 0,
    unit: "und",
  }));

  const envasadoExecutedRows: CumplimientoRow[] = (envasadosData ?? [])
    .map((e) => {
      const referencia = resolveReferencia(e);
      if (!referencia) return null;
      return {
        id: referencia.id,
        name: referencia.name,
        scheduled_date: e.started_at.slice(0, 10),
        planned: 0,
        executed: e.cantidad_unidades,
        unit: "und",
      } satisfies CumplimientoRow;
    })
    .filter((r): r is CumplimientoRow => r !== null);

  const envasadoRows: CumplimientoRow[] = [...envasadoPlanRows, ...envasadoExecutedRows];

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
