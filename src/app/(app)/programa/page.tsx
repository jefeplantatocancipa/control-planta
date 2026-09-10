import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NewProgramDialog } from "./new-program-dialog";
import { ImportBachesDialog } from "./import-baches-dialog";
import { ImportEnvasadoDialog } from "./import-envasado-dialog";
import { ProgramCard } from "./program-card";

export default async function ProgramaPage() {
  const profile = await requireRole(["jefe_planta", "supervisor", "planeacion"]);
  const supabase = await createClient();

  const [
    { data: programs },
    { data: orders },
    { data: envasadoOrders },
    { data: products },
    { data: envasadoReferencias },
    { data: baches },
    { data: envasadosReales },
  ] = await Promise.all([
    supabase
      .from("production_programs")
      .select("*")
      .order("week_start_date", { ascending: false }),
    supabase
      .from("production_orders")
      .select("*")
      .order("scheduled_date"),
    supabase
      .from("envasado_orders")
      .select("*")
      .order("scheduled_date"),
    supabase.from("products").select("*").order("name"),
    supabase.from("envasado_referencias").select("*"),
    supabase
      .from("baches")
      .select("production_order_id, started_at, completed_at")
      .not("production_order_id", "is", null),
    supabase
      .from("envasados")
      .select("envasado_order_id, cantidad_unidades, started_at, ended_at")
      .not("envasado_order_id", "is", null),
  ]);

  // Planeación arma/edita el programa igual que el jefe de planta, pero
  // borrar (órdenes o el programa entero) queda exclusivo del jefe de planta.
  const canWrite = profile.role === "jefe_planta" || profile.role === "planeacion";
  const canDelete = profile.role === "jefe_planta";

  // Horas reales por orden: primer bache que arrancó / último que terminó,
  // de los baches ya vinculados a esa orden (production_order_id).
  const realTimesByOrder = new Map<string, { start: string; end: string | null }>();
  for (const bache of baches ?? []) {
    if (!bache.production_order_id) continue;
    const current = realTimesByOrder.get(bache.production_order_id);
    const start =
      !current || bache.started_at < current.start ? bache.started_at : current.start;
    const end =
      !current?.end || (bache.completed_at && bache.completed_at > current.end)
        ? bache.completed_at
        : current.end;
    realTimesByOrder.set(bache.production_order_id, { start, end });
  }

  // Cumplimiento real por orden de envasado: unidades envasadas (suma, por
  // si más de un envasado terminó ligado a la misma orden) y el rango de
  // inicio/final de los envasados ya vinculados a esa orden.
  const envasadoRealByOrder = new Map<
    string,
    { start: string; end: string | null; unidades: number }
  >();
  for (const envasado of envasadosReales ?? []) {
    if (!envasado.envasado_order_id) continue;
    const current = envasadoRealByOrder.get(envasado.envasado_order_id);
    const start =
      !current || envasado.started_at < current.start
        ? envasado.started_at
        : current.start;
    const end =
      !current?.end || (envasado.ended_at && envasado.ended_at > current.end)
        ? envasado.ended_at
        : current.end;
    const unidades = (current?.unidades ?? 0) + (envasado.cantidad_unidades ?? 0);
    envasadoRealByOrder.set(envasado.envasado_order_id, { start, end, unidades });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Programa de producción</h1>
          <p className="text-muted-foreground">
            El jefe de planta y Planeación generan el programa semanal por
            producto.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <ImportBachesDialog />
            <ImportEnvasadoDialog />
            <NewProgramDialog />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {(programs ?? []).map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            orders={(orders ?? []).filter((o) => o.program_id === program.id)}
            envasadoOrders={(envasadoOrders ?? []).filter(
              (o) => o.program_id === program.id,
            )}
            products={products ?? []}
            envasadoReferencias={envasadoReferencias ?? []}
            canWrite={canWrite}
            canDelete={canDelete}
            realTimesByOrder={realTimesByOrder}
            envasadoRealByOrder={envasadoRealByOrder}
          />
        ))}
        {(programs ?? []).length === 0 && (
          <p className="text-center text-muted-foreground">
            Sin programas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
