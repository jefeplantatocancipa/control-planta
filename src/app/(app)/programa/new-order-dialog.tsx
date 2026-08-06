"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
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
import { createOrder, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

function NewOrderForm({
  programId,
  products,
  onSuccess,
}: {
  programId: string;
  products: Product[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createOrder,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="program_id" value={programId} />

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
        <Label htmlFor="scheduled_date">Fecha programada</Label>
        <Input id="scheduled_date" name="scheduled_date" type="date" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="planned_quantity">Cantidad planeada</Label>
        <Input
          id="planned_quantity"
          name="planned_quantity"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="unit">Unidad</Label>
        <Input id="unit" name="unit" defaultValue="litros" required />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear orden"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewOrderDialog({
  programId,
  products,
}: {
  programId: string;
  products: Product[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Agregar orden
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva orden de producción</DialogTitle>
        </DialogHeader>
        <NewOrderForm
          programId={programId}
          products={products}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
