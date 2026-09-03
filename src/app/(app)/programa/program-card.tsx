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
import { formatDateTime } from "@/lib/format-date";
import type { Database, ProgramStatus } from "@/lib/supabase/types";

type Program = Database["public"]["Tables"]["production_programs"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type EnvasadoOrder = Database["public"]["Tables"]["envasado_orders"]["Row"];
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
  envasadoOrders,
  products,
  canWrite,
  realTimesByOrder,
}: {
  program: Program;
  orders: Order[];
  envasadoOrders: EnvasadoOrder[];
  products: Product[];
  canWrite: boolean;
  realTimesByOrder?: Map<string, { start: string; end: string | null }>;
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
        <h3 className="text-sm font-medium">Baches</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tanque</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Baches</TableHead>
              <TableHead>Planeado (inicio–final)</TableHead>
              <TableHead>Real (inicio–final)</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const real = realTimesByOrder?.get(order.id);
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.orden_codigo ?? "—"}
                  </TableCell>
                  <TableCell>{productNames.get(order.product_id) ?? "—"}</TableCell>
                  <TableCell>{order.tanque ?? "—"}</TableCell>
                  <TableCell>
                    {format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {order.baches_planeados ??
                      (order.planned_quantity
                        ? `${order.planned_quantity} ${order.unit}`
                        : "—")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {order.hora_inicio_planeada
                      ? formatDateTime(order.hora_inicio_planeada)
                      : "—"}
                    {order.hora_final_planeada
                      ? ` – ${formatDateTime(order.hora_final_planeada)}`
                      : ""}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {real ? formatDateTime(real.start) : "—"}
                    {real?.end ? ` – ${formatDateTime(real.end)}` : ""}
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <OrderStatusSelect orderId={order.id} status={order.status} />
                    ) : (
                      <Badge variant="outline">{order.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
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

        <h3 className="mt-3 text-sm font-medium">Envasado</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Und. programadas</TableHead>
              <TableHead>Gramaje x und.</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {envasadoOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  {productNames.get(order.product_id) ?? "—"}
                </TableCell>
                <TableCell>{order.linea ?? "—"}</TableCell>
                <TableCell>
                  {format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>{order.planned_quantity}</TableCell>
                <TableCell>
                  {order.gramaje_por_unidad ? `${order.gramaje_por_unidad} g` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{order.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {envasadoOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sin órdenes de envasado todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
