"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OptionPicker } from "@/components/option-picker";
import { associateBacheOrder, type ActionState } from "./actions";
import { NO_ORDER_VALUE } from "./constants";

interface OrderOption {
  id: string;
  title: string;
  meta: (string | null | undefined)[];
}

function AssociateOrderForm({
  bacheId,
  orders,
  currentOrderId,
  onSuccess,
}: {
  bacheId: string;
  orders: OrderOption[];
  currentOrderId: string | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    associateBacheOrder,
    {},
  );
  const [orderId, setOrderId] = useState(currentOrderId ?? NO_ORDER_VALUE);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="bache_id" value={bacheId} />
      <div className="flex flex-col gap-2">
        <Label>Orden de trabajo</Label>
        <input type="hidden" name="production_order_id" value={orderId} />
        <OptionPicker
          value={orderId}
          onChange={setOrderId}
          items={[
            { value: NO_ORDER_VALUE, title: "Sin orden asociada" },
            ...orders.map((o) => ({ value: o.id, title: o.title, meta: o.meta })),
          ]}
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending || orderId === currentOrderId}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AssociateOrderDialog({
  bacheId,
  orders,
  currentOrderId = null,
}: {
  bacheId: string;
  orders: OrderOption[];
  currentOrderId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (orders.length === 0 && !currentOrderId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {currentOrderId ? "Cambiar orden" : "Asociar orden"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentOrderId ? "Cambiar orden de trabajo" : "Asociar orden de trabajo"}
          </DialogTitle>
        </DialogHeader>
        <AssociateOrderForm
          bacheId={bacheId}
          orders={orders}
          currentOrderId={currentOrderId}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
