import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PedidoEstadoSelect } from "./estado-select";

export default async function PedidosInsumosPage() {
  const profile = await requireRole(["jefe_planta", "asistente_adm", "planeacion"]);
  const supabase = await createClient();

  const [{ data: pedidos }, { data: programs }, { data: profiles }] = await Promise.all([
    supabase
      .from("pedidos_insumos")
      .select("id, folio, program_id, estado, enviado_por, enviado_at")
      .order("folio", { ascending: false }),
    supabase.from("production_programs").select("id, week_start_date"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const programsById = new Map((programs ?? []).map((p) => [p.id, p.week_start_date]));
  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const canChangeEstado = profile.role === "jefe_planta" || profile.role === "asistente_adm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos de insumos</h1>
          <p className="text-muted-foreground">
            Historial de pedidos enviados a partir del programa de producción.
          </p>
        </div>
        <Link href="/pedidos-insumos/nuevo" className={buttonVariants()}>
          Nuevo pedido
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N.º</TableHead>
            <TableHead>Semana</TableHead>
            <TableHead>Enviado por</TableHead>
            <TableHead>Fecha de envío</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(pedidos ?? []).map((pedido) => {
            const semana = programsById.get(pedido.program_id);
            return (
              <TableRow key={pedido.id}>
                <TableCell className="font-medium">{pedido.folio}</TableCell>
                <TableCell>
                  {semana
                    ? format(new Date(`${semana}T00:00:00`), "d 'de' MMMM, yyyy", { locale: es })
                    : "—"}
                </TableCell>
                <TableCell>{profileNames.get(pedido.enviado_por) ?? "—"}</TableCell>
                <TableCell>{format(new Date(pedido.enviado_at), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>
                  {canChangeEstado ? (
                    <PedidoEstadoSelect pedidoId={pedido.id} estado={pedido.estado} />
                  ) : (
                    pedido.estado
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/pedidos-insumos/${pedido.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Ver detalle
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
          {(pedidos ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin pedidos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
