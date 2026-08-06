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
import { ProgramStatusSelect } from "./program-status-select";
import { OrderStatusSelect } from "./order-status-select";
import { NewOrderDialog } from "./new-order-dialog";
import type { Database, ProgramStatus } from "@/lib/supabase/types";

type Program = Database["public"]["Tables"]["production_programs"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

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

export function ProgramCard({
  program,
  orders,
  products,
  canWrite,
}: {
  program: Program;
  orders: Order[];
  products: Product[];
  canWrite: boolean;
}) {
  const productNames = new Map(products.map((p) => [p.id, p.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatWeek(program.week_start_date)}</CardTitle>
        {program.notes && (
          <p className="text-sm text-muted-foreground">{program.notes}</p>
        )}
        <CardAction>
          {canWrite ? (
            <ProgramStatusSelect programId={program.id} status={program.status} />
          ) : (
            <Badge variant="outline">{PROGRAM_STATUS_LABELS[program.status]}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Planeado</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  {productNames.get(order.product_id) ?? "—"}
                </TableCell>
                <TableCell>
                  {format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  {order.planned_quantity} {order.unit}
                </TableCell>
                <TableCell>
                  {canWrite ? (
                    <OrderStatusSelect orderId={order.id} status={order.status} />
                  ) : (
                    <Badge variant="outline">{order.status}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin órdenes todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {canWrite && (
          <div className="flex justify-end">
            <NewOrderDialog
              programId={program.id}
              products={products.filter((p) => p.active)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
