"use client";

import { useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionPicker, type OptionPickerItem } from "@/components/option-picker";
import { createBache, type ActionState } from "./actions";
import { NO_ORDER_VALUE } from "./constants";
import { formatTime } from "@/lib/format-date";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];

// Cada tarjeta muestra el producto como dato principal y el resto (línea
// de fecha/hora/cantidad, y el código de orden aparte) como detalle, en
// vez de un solo texto largo que terminaba truncado en el <Select>.
function orderToItem(order: Order, productName: string): OptionPickerItem {
  const cantidad = order.baches_planeados
    ? `${order.baches_planeados} baches`
    : order.planned_quantity
      ? `${order.planned_quantity} ${order.unit}`
      : null;
  const fecha = format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy");
  const horaInicio = order.hora_inicio_planeada ? formatTime(order.hora_inicio_planeada) : null;
  return {
    value: order.id,
    title: productName,
    meta: [[fecha, horaInicio].filter(Boolean).join(" "), cantidad, order.orden_codigo],
  };
}

function NewBacheForm({
  products,
  orders,
}: {
  products: Product[];
  orders: Order[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createBache,
    {},
  );
  const productsById = new Map(products.map((p) => [p.id, p]));
  const [orderId, setOrderId] = useState(NO_ORDER_VALUE);
  const [productId, setProductId] = useState("");
  const [volumen, setVolumen] = useState("");

  function selectOrder(value: string) {
    setOrderId(value);
    const order = orders.find((o) => o.id === value);
    if (!order) return;
    setProductId(order.product_id);
    const product = productsById.get(order.product_id);
    if (product?.volumen_por_bache) {
      const cantidadBaches = order.baches_planeados ?? 1;
      setVolumen(String(product.volumen_por_bache * cantidadBaches));
    }
  }

  // Si se cambia el producto a mano después de elegir una orden, esa orden
  // ya no corresponde -- se limpia en vez de dejar armada una combinación
  // cruzada (producto A, orden de producto B).
  function selectProduct(value: string) {
    setProductId(value);
    const order = orders.find((o) => o.id === orderId);
    if (order && order.product_id !== value) {
      setOrderId(NO_ORDER_VALUE);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {orders.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Orden de producción</Label>
          <input type="hidden" name="production_order_id" value={orderId} />
          <OptionPicker
            value={orderId}
            onChange={selectOrder}
            items={[
              { value: NO_ORDER_VALUE, title: "Sin orden asociada" },
              ...orders.map((order) =>
                orderToItem(order, productsById.get(order.product_id)?.name ?? "—"),
              ),
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Al elegir una orden se completan el producto y el volumen
            sugerido (podés cambiarlos).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="product_id">Producto</Label>
        <Select
          name="product_id"
          value={productId}
          onValueChange={(value) => selectProduct(value ?? "")}
          items={products.map((product) => ({
            value: product.id,
            label: product.name,
          }))}
          required
        >
          <SelectTrigger id="product_id" className="w-full">
            <SelectValue placeholder="Elegí un producto" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="batch_code">Código de lote</Label>
        <Input id="batch_code" name="batch_code" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="volumen_total_litros">Volumen total (L)</Label>
        <Input
          id="volumen_total_litros"
          name="volumen_total_litros"
          type="number"
          step="0.01"
          min="0"
          value={volumen}
          onChange={(e) => setVolumen(e.target.value)}
          placeholder="Opcional"
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear bache"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewBacheDialog({
  products,
  orders,
}: {
  products: Product[];
  orders: Order[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Nuevo bache</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo bache</DialogTitle>
        </DialogHeader>
        <NewBacheForm products={products} orders={orders} />
      </DialogContent>
    </Dialog>
  );
}
