"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
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
import { upsertInventarioFinalMensual, type ActionState } from "./actions";

function InventarioFinalForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertInventarioFinalMensual,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="mes">Mes</Label>
        <Input id="mes" name="mes" type="month" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="kilos">Inventario final (kg sin empacar)</Label>
        <Input id="kilos" name="kilos" type="number" step="0.1" min="0" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Input id="notas" name="notas" placeholder="Opcional" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function InventarioFinalDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Cargar inventario final de un mes</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inventario final de producto terminado</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Lo que quedó hecho pero sin empacar al cierre de ese mes (conteo
          físico). Si ya existe un valor para ese mes, lo reemplaza.
        </p>
        <InventarioFinalForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
