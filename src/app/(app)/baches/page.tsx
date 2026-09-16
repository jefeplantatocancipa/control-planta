import Link from "next/link";
import { format } from "date-fns";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewBacheDialog } from "./new-bache-dialog";
import { AssociateOrderDialog } from "./associate-order-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteBache } from "./actions";
import { formatDate } from "@/lib/format-date";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_CLASSES,
} from "../programa/order-status-styles";
import type { BacheStatus } from "@/lib/supabase/types";

const STATUS_LABELS: Record<BacheStatus, string> = {
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

const STATUS_VARIANTS: Record<BacheStatus, "default" | "outline" | "secondary"> = {
  en_proceso: "default",
  completado: "secondary",
  cancelado: "outline",
};

export default async function BachesPage() {
  const profile = await requireRole(["jefe_planta", "supervisor", "calidad", "asistente_adm"]);
  const canDelete = profile.role === "jefe_planta";
  const canWrite = profile.role === "jefe_planta" || profile.role === "supervisor";
  // Asociar retroactivamente una orden a un bache que quedó suelto queda
  // exclusivo del jefe de planta -- es una corrección administrativa, no
  // parte del flujo normal de captura.
  const isJefe = profile.role === "jefe_planta";
  const supabase = await createClient();

  const [{ data: baches }, { data: products }, { data: orders }, { data: allOrders }] =
    await Promise.all([
      supabase
        .from("baches")
        .select("*")
        .order("started_at", { ascending: false }),
      supabase.from("products").select("*").order("name"),
      supabase
        .from("production_orders")
        .select("*")
        .in("status", ["pendiente", "en_proceso"])
        .order("scheduled_date"),
      // A diferencia de "orders" (solo pendiente/en_proceso, para el
      // desplegable de "Nuevo bache"), acá hace falta cualquier estado: un
      // bache puede estar ligado a una orden ya completada o cancelada, y
      // igual hay que poder verla para entender por qué el estado de esa
      // orden no coincide con lo que se ve en Programa.
      supabase
        .from("production_orders")
        .select("id, orden_codigo, status, scheduled_date"),
    ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const orderById = new Map((allOrders ?? []).map((o) => [o.id, o]));

  // Solo se ofrecen para asociar las órdenes pendientes/en proceso del
  // mismo producto que el bache, para no permitir un cruce por error.
  function orderOptionsFor(productId: string) {
    return (orders ?? [])
      .filter((order) => order.product_id === productId)
      .map((order) => {
        const fecha = format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy");
        const cantidad = order.baches_planeados
          ? `${order.baches_planeados} baches`
          : order.planned_quantity
            ? `${order.planned_quantity} ${order.unit}`
            : null;
        return {
          id: order.id,
          label: [fecha, cantidad, order.orden_codigo].filter(Boolean).join(" — "),
        };
      });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Preparación de baches</h1>
          <p className="text-muted-foreground">
            Crear baches y capturar cada etapa del proceso.
          </p>
        </div>
        {canWrite && (
          <NewBacheDialog products={(products ?? []).filter((p) => p.active)} orders={orders ?? []} />
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Volumen</TableHead>
            <TableHead>Orden de trabajo</TableHead>
            <TableHead>Iniciado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
            {canDelete && <TableHead className="sticky right-0 bg-background" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(baches ?? []).map((bache) => (
            <TableRow key={bache.id} className="group">
              <TableCell className="font-medium">{bache.batch_code}</TableCell>
              <TableCell>{productNames.get(bache.product_id) ?? "—"}</TableCell>
              <TableCell>
                {bache.volumen_total_litros
                  ? `${bache.volumen_total_litros} L`
                  : "—"}
              </TableCell>
              <TableCell>
                {bache.production_order_id ? (
                  (() => {
                    const order = orderById.get(bache.production_order_id);
                    return (
                      <div className="flex flex-col gap-1">
                        <span>{order?.orden_codigo || "Sin código"}</span>
                        {order && (
                          <Badge
                            variant="outline"
                            className={`w-fit text-xs ${ORDER_STATUS_CLASSES[order.status]}`}
                          >
                            {ORDER_STATUS_LABELS[order.status]}
                          </Badge>
                        )}
                      </div>
                    );
                  })()
                ) : isJefe && orderOptionsFor(bache.product_id).length > 0 ? (
                  <AssociateOrderDialog
                    bacheId={bache.id}
                    orders={orderOptionsFor(bache.product_id)}
                  />
                ) : (
                  <span className="text-muted-foreground">Sin orden asociada</span>
                )}
              </TableCell>
              <TableCell>
                {formatDate(bache.started_at)}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[bache.status]}>
                  {STATUS_LABELS[bache.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/baches/${bache.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver
                </Link>
              </TableCell>
              {canDelete && (
                <TableCell className="sticky right-0 bg-background text-right group-hover:bg-muted/50">
                  <DeleteButton
                    action={deleteBache}
                    id={bache.id}
                    title="Eliminar bache"
                    description={`Borra el bache ${bache.batch_code} y todas sus etapas registradas. Si ya tiene un envasado vinculado, no se va a poder eliminar hasta borrar ese envasado primero.`}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {(baches ?? []).length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canDelete ? 8 : 7}
                className="text-center text-muted-foreground"
              >
                Sin baches todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
