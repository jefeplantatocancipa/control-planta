import { format } from "date-fns";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StartEnvasadoDialog } from "./start-envasado-dialog";
import { EnvasadoCard } from "./envasado-card";
import { formatDateTime } from "@/lib/format-date";

export default async function EnvasadoPage() {
  await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const [
    { data: envasados },
    { data: baches },
    { data: products },
    { data: operarios },
    { data: insumosStages },
    { data: stageRecords },
    { data: envasadoOrders },
    { data: envasadoReferencias },
  ] = await Promise.all([
    supabase
      .from("envasados")
      .select("*")
      .order("started_at", { ascending: false }),
    supabase
      .from("baches")
      .select("*")
      .neq("status", "cancelado")
      .order("started_at", { ascending: false }),
    supabase.from("products").select("*"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
    supabase
      .from("process_stage_templates")
      .select("id, sequence_order")
      .eq("captures_insumos", true),
    supabase
      .from("bache_stage_records")
      .select("bache_id, stage_template_id, parameters"),
    supabase
      .from("envasado_orders")
      .select("*")
      .in("status", ["pendiente", "en_proceso"])
      .order("scheduled_date"),
    supabase.from("envasado_referencias").select("*"),
  ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const bacheOptions = (baches ?? []).map((bache) => ({
    id: bache.id,
    label: `${bache.batch_code} — ${productNames.get(bache.product_id) ?? "—"}`,
  }));
  const bacheLabels = new Map(bacheOptions.map((b) => [b.id, b.label]));
  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));

  const referenciasById = new Map((envasadoReferencias ?? []).map((r) => [r.id, r]));
  const envasadoOrderOptions = (envasadoOrders ?? []).map((order) => {
    const referencia = referenciasById.get(order.referencia_id);
    const fecha = format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy");
    const presentacion = referencia ? `${referencia.sku} — ${referencia.name}` : "—";
    const label = [
      presentacion,
      order.linea,
      fecha,
      `${order.planned_quantity} und.`,
    ]
      .filter(Boolean)
      .join(" — ");
    return { id: order.id, label, presentacion };
  });

  // Balance de masa por bache: se toma la última etapa con checklist de
  // insumos (ej. Mezcla) en vez de Alistamiento, porque ahí queda
  // confirmado lo que realmente se agregó al proceso (no todo lo
  // prealistado necesariamente termina en la mezcla).
  const insumosStageOrder = new Map(
    (insumosStages ?? []).map((s) => [s.id, s.sequence_order]),
  );
  const massBalanceByBache = new Map<string, { order: number; kg: number }>();
  for (const record of stageRecords ?? []) {
    const order = insumosStageOrder.get(record.stage_template_id);
    if (order === undefined) continue;
    const insumos = Array.isArray(record.parameters?.insumos)
      ? record.parameters.insumos
      : [];
    const kg = insumos.reduce((sum, i) => sum + (Number(i.peso) || 0), 0);
    const current = massBalanceByBache.get(record.bache_id);
    if (!current || order > current.order) {
      massBalanceByBache.set(record.bache_id, { order, kg });
    }
  }

  const open = (envasados ?? []).filter((e) => !e.ended_at);
  const closed = (envasados ?? []).filter((e) => e.ended_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Envasado del bache</h1>
          <p className="text-muted-foreground">
            Iniciar el envasado de un bache y actualizar el avance durante el
            día.
          </p>
        </div>
        <StartEnvasadoDialog
          baches={bacheOptions}
          operarios={operarios ?? []}
          envasadoOrders={envasadoOrderOptions}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">En curso</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((envasado) => (
            <EnvasadoCard
              key={envasado.id}
              recordId={envasado.id}
              bacheLabel={bacheLabels.get(envasado.bache_id) ?? "—"}
              presentacion={envasado.presentacion}
              operarioName={operarioNames.get(envasado.operario_id) ?? "—"}
              cantidadUnidades={envasado.cantidad_unidades}
              cantidadMermas={envasado.cantidad_mermas}
              notes={envasado.notes}
              massBalanceKg={massBalanceByBache.get(envasado.bache_id)?.kg}
            />
          ))}
          {open.length === 0 && (
            <p className="text-muted-foreground">Sin envasados en curso.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Finalizados</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bache</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead>Insumos (kg)</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead>Mermas</TableHead>
              <TableHead>Operario</TableHead>
              <TableHead>Finalizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closed.map((envasado) => (
              <TableRow key={envasado.id}>
                <TableCell className="font-medium">
                  {bacheLabels.get(envasado.bache_id) ?? "—"}
                </TableCell>
                <TableCell>{envasado.presentacion}</TableCell>
                <TableCell>
                  {massBalanceByBache.get(envasado.bache_id)?.kg ?? "—"}
                </TableCell>
                <TableCell>{envasado.cantidad_unidades}</TableCell>
                <TableCell>{envasado.cantidad_mermas}</TableCell>
                <TableCell>{operarioNames.get(envasado.operario_id) ?? "—"}</TableCell>
                <TableCell>
                  {envasado.ended_at && formatDateTime(envasado.ended_at)}
                </TableCell>
              </TableRow>
            ))}
            {closed.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin envasados finalizados todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
