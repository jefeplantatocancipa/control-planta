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

  const [{ data: envasados }, { data: baches }, { data: products }, { data: operarios }] =
    await Promise.all([
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
    ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const bacheOptions = (baches ?? []).map((bache) => ({
    id: bache.id,
    label: `${bache.batch_code} — ${productNames.get(bache.product_id) ?? "—"}`,
  }));
  const bacheLabels = new Map(bacheOptions.map((b) => [b.id, b.label]));
  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));

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
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
