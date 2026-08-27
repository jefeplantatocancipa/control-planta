import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnmangadoProgramStatusSelect } from "./enmangado-program-status-select";
import { EnmangadoOrderStatusSelect } from "./enmangado-order-status-select";
import { NewEnmangadoOrderDialog } from "./new-enmangado-order-dialog";
import type { Database, ProgramStatus } from "@/lib/supabase/types";

type Program = Database["public"]["Tables"]["enmangado_programs"]["Row"];
type Order = Database["public"]["Tables"]["enmangado_orders"]["Row"];
type Referencia = Database["public"]["Tables"]["enmangado_referencias"]["Row"];
type Vaso = Database["public"]["Tables"]["vasos_enmangados"]["Row"];

const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  cerrado: "Cerrado",
};

function formatWeek(dateStr: string) {
  return format(new Date(`${dateStr}T00:00:00`), "'Semana del' d 'de' MMMM, yyyy", {
    locale: es,
  });
}

export function EnmangadoProgramCard({
  program,
  orders,
  vasos,
  referencias,
  canWrite,
}: {
  program: Program;
  orders: Order[];
  vasos: Vaso[];
  referencias: Referencia[];
  canWrite: boolean;
}) {
  const referenciaNames = new Map(referencias.map((r) => [r.id, r.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatWeek(program.week_start_date)}</CardTitle>
        {program.notes && (
          <p className="text-sm text-muted-foreground">{program.notes}</p>
        )}
        <CardAction>
          {canWrite ? (
            <EnmangadoProgramStatusSelect
              programId={program.id}
              status={program.status}
            />
          ) : (
            <Badge variant="outline">{PROGRAM_STATUS_LABELS[program.status]}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referencia</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Planeado</TableHead>
              <TableHead>Ejecutado</TableHead>
              <TableHead>Cumplimiento</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const executed = vasos
                .filter((v) => v.enmangado_order_id === order.id)
                .reduce((sum, v) => sum + v.cantidad_unidades, 0);
              const pct =
                order.planned_quantity > 0
                  ? Math.round((executed / order.planned_quantity) * 100)
                  : 0;

              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {referenciaNames.get(order.referencia_id) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {order.planned_quantity} {order.unit}
                  </TableCell>
                  <TableCell>
                    {executed} {order.unit}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pct >= 100 ? "default" : "outline"}>
                      {pct}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <EnmangadoOrderStatusSelect
                        orderId={order.id}
                        status={order.status}
                      />
                    ) : (
                      <Badge variant="outline">{order.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sin órdenes todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {canWrite && (
          <div className="flex justify-end">
            <NewEnmangadoOrderDialog
              programId={program.id}
              referencias={referencias.filter((r) => r.active)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
