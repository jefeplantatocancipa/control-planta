"use client";

import { useActionState, useState } from "react";
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
import { createBache, type ActionState } from "./actions";
import { NO_ORDER_VALUE } from "./constants";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];

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

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="product_id">Producto</Label>
        <Select name="product_id" required>
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
          placeholder="Opcional"
        />
      </div>

      {orders.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="production_order_id">Orden de producción</Label>
          <Select name="production_order_id" defaultValue={NO_ORDER_VALUE}>
            <SelectTrigger id="production_order_id" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORDER_VALUE}>Sin orden asociada</SelectItem>
              {orders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.scheduled_date} — {order.planned_quantity} {order.unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo bache</DialogTitle>
        </DialogHeader>
        <NewBacheForm products={products} orders={orders} />
      </DialogContent>
    </Dialog>
  );
}
