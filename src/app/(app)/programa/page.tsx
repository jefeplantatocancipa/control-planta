import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NewProgramDialog } from "./new-program-dialog";
import { ProgramCard } from "./program-card";

export default async function ProgramaPage() {
  const profile = await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const [{ data: programs }, { data: orders }, { data: products }] =
    await Promise.all([
      supabase
        .from("production_programs")
        .select("*")
        .order("week_start_date", { ascending: false }),
      supabase
        .from("production_orders")
        .select("*")
        .order("scheduled_date"),
      supabase.from("products").select("*").order("name"),
    ]);

  const canWrite = profile.role === "jefe_planta";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Programa de producción</h1>
          <p className="text-muted-foreground">
            El jefe de planta genera el programa semanal por producto.
          </p>
        </div>
        {canWrite && <NewProgramDialog />}
      </div>

      <div className="flex flex-col gap-4">
        {(programs ?? []).map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            orders={(orders ?? []).filter((o) => o.program_id === program.id)}
            products={products ?? []}
            canWrite={canWrite}
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
