import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ConsolidadoCumplimiento, type CumplimientoRow } from "./consolidado";

export default async function CumplimientoPage() {
  await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);
  const supabase = await createClient();

  const [
    { data: productionOrdersData },
    { data: productsData },
    { data: bachesData },
    { data: envasadoOrdersData },
    { data: envasadoReferenciasData },
    { data: envasadosData },
  ] = await Promise.all([
    supabase
      .from("production_orders")
      .select("product_id, scheduled_date, baches_planeados, planned_quantity"),
    supabase.from("products").select("id, name"),
    supabase.from("baches").select("product_id, started_at, status"),
    supabase
      .from("envasado_orders")
      .select("id, referencia_id, scheduled_date, planned_quantity")
      .order("scheduled_date", { ascending: false }),
    supabase.from("envasado_referencias").select("id, sku, name"),
    supabase.from("envasados").select("referencia_id, presentacion, cantidad_unidades, started_at"),
  ]);

  // "Bases (baches)": la vista v_cumplimiento_programa medía lo ejecutado
  // por unidades ENVASADAS (por eso un producto que no se envasa, como
  // Cremado, siempre daba 0) y lo programado casi nunca se llenaba porque
  // el importador de Excel de baches guarda el plan en "baches_planeados",
  // no en "planned_quantity" (ese campo es el que usa la orden de
  // envasado). Acá se mide directamente en baches: programados
  // (baches_planeados, con planned_quantity como respaldo si no está) vs.
  // baches reales creados, contados por su propia fecha de inicio.
  const productNameById = new Map((productsData ?? []).map((p) => [p.id, p.name]));

  const bachesPlanRows: CumplimientoRow[] = (productionOrdersData ?? [])
    .map((o) => {
      const planned = o.baches_planeados ?? o.planned_quantity ?? 0;
      if (planned <= 0) return null;
      return {
        id: o.product_id,
        name: productNameById.get(o.product_id) ?? "Producto eliminado",
        scheduled_date: o.scheduled_date,
        planned,
        executed: 0,
        unit: "baches",
      } satisfies CumplimientoRow;
    })
    .filter((r): r is CumplimientoRow => r !== null);

  const bachesExecutedRows: CumplimientoRow[] = (bachesData ?? [])
    .filter((b) => b.status !== "cancelado")
    .map((b) => ({
      id: b.product_id,
      name: productNameById.get(b.product_id) ?? "Producto eliminado",
      scheduled_date: b.started_at.slice(0, 10),
      planned: 0,
      executed: 1,
      unit: "baches",
    }));

  const bachesRows: CumplimientoRow[] = [...bachesPlanRows, ...bachesExecutedRows];

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
