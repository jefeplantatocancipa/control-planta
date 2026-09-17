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
    { data: consumoMateriaPrima },
    { data: envasadoOrdersData },
    { data: envasadoReferenciasData },
    { data: envasadosData },
  ] = await Promise.all([
    supabase.from("production_orders").select("product_id, scheduled_date, baches_planeados"),
    supabase.from("products").select("id, name, volumen_por_bache"),
    supabase.from("baches").select("id, product_id"),
    supabase
      .from("inventario_movimientos")
      .select("cantidad, created_at, origen_id")
      .eq("insumo_tipo", "materia_prima")
      .eq("tipo", "consumo")
      .eq("origen_tipo", "bache"),
    supabase
      .from("envasado_orders")
      .select("id, referencia_id, scheduled_date, planned_quantity")
      .order("scheduled_date", { ascending: false }),
    supabase.from("envasado_referencias").select("id, sku, name"),
    supabase.from("envasados").select("referencia_id, presentacion, cantidad_unidades, started_at"),
  ]);

  // "Bases (baches)" en kilos: la vista v_cumplimiento_programa medía lo
  // ejecutado por unidades ENVASADAS (por eso Cremado, que no se envasa,
  // siempre daba 0) y no había forma de verlo en kilos. Programado se
  // estima con baches_planeados x volumen por bache del producto (litros
  // ~ kg); ejecutado se toma del mismo consumo real de materia prima que
  // ya usa Estadísticas (registrado al cerrar la última etapa con
  // checklist de insumos de cada bache), por su fecha real.
  const productNameById = new Map((productsData ?? []).map((p) => [p.id, p.name]));
  const productVolumenById = new Map((productsData ?? []).map((p) => [p.id, p.volumen_por_bache]));
  const bacheProductById = new Map((bachesData ?? []).map((b) => [b.id, b.product_id]));

  const bachesPlanRows: CumplimientoRow[] = (productionOrdersData ?? [])
    .map((o) => {
      const volumenPorBache = productVolumenById.get(o.product_id);
      if (!o.baches_planeados || !volumenPorBache) return null;
      return {
        id: o.product_id,
        name: productNameById.get(o.product_id) ?? "Producto eliminado",
        scheduled_date: o.scheduled_date,
        planned: Math.round(o.baches_planeados * volumenPorBache * 10) / 10,
        executed: 0,
        unit: "kg",
      } satisfies CumplimientoRow;
    })
    .filter((r): r is CumplimientoRow => r !== null);

  const bachesExecutedRows: CumplimientoRow[] = (consumoMateriaPrima ?? [])
    .map((m) => {
      const productId = m.origen_id ? bacheProductById.get(m.origen_id) : undefined;
      if (!productId) return null;
      return {
        id: productId,
        name: productNameById.get(productId) ?? "Producto eliminado",
        scheduled_date: m.created_at.slice(0, 10),
        planned: 0,
        executed: Math.round(Math.abs(m.cantidad) * 10) / 10,
        unit: "kg",
      } satisfies CumplimientoRow;
    })
    .filter((r): r is CumplimientoRow => r !== null);

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
