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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { associateBacheOrder, type ActionState } from "./actions";

interface OrderOption {
  id: string;
  label: string;
}

function AssociateOrderForm({
  bacheId,
  orders,
  onSuccess,
}: {
  bacheId: string;
  orders: OrderOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    associateBacheOrder,
    {},
  );
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="bache_id" value={bacheId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="production_order_id">Orden de trabajo</Label>
        <Select
          name="production_order_id"
          value={orderId}
          onValueChange={(value) => setOrderId(value ?? "")}
          items={orders.map((o) => ({ value: o.id, label: o.label }))}
        >
          <SelectTrigger id="production_order_id" className="w-full">
            <SelectValue placeholder="Elegí una orden" />
          </SelectTrigger>
          <SelectContent>
            {orders.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending || !orderId}>
          {pending ? "Asociando..." : "Asociar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AssociateOrderDialog({
  bacheId,
  orders,
}: {
  bacheId: string;
  orders: OrderOption[];
}) {
  const [open, setOpen] = useState(false);

  if (orders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Asociar orden</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asociar orden de trabajo</DialogTitle>
        </DialogHeader>
        <AssociateOrderForm
          bacheId={bacheId}
          orders={orders}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
