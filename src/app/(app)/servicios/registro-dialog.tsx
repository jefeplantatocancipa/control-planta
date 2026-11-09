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
import { registrarConsumoServicio, type ActionState } from "./actions";

function hoy() {
  return new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd en hora local
}

function RegistroForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    registrarConsumoServicio,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fecha">Fecha</Label>
        <Input id="fecha" name="fecha" type="date" defaultValue={hoy()} required />
        <p className="text-xs text-muted-foreground">
          Si ya existe una lectura para esta fecha, se reemplaza.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gas_lectura_m3">Gas (m³, lectura del medidor)</Label>
        <Input
          id="gas_lectura_m3"
          name="gas_lectura_m3"
          type="number"
          step="0.01"
          min="0"
          placeholder="Opcional"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="agua_edificio_lectura_m3">Agua edificio (m³, lectura del medidor)</Label>
        <Input
          id="agua_edificio_lectura_m3"
          name="agua_edificio_lectura_m3"
          type="number"
          step="0.01"
          min="0"
          placeholder="Opcional"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="agua_produccion_lectura_m3">
          Agua producción (m³, lectura del medidor)
        </Label>
        <Input
          id="agua_produccion_lectura_m3"
          name="agua_produccion_lectura_m3"
          type="number"
          step="0.01"
          min="0"
          placeholder="Opcional"
        />
      </div>

      <Label className="flex items-center gap-2 text-sm font-normal">
        <input type="checkbox" name="estimado" className="size-4" />
        Lectura estimada (no se tomó directo del medidor)
      </Label>

      <div className="flex flex-col gap-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Input id="observaciones" name="observaciones" placeholder="Opcional" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar lectura"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RegistroConsumoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Registrar lectura del día</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lectura de servicios</DialogTitle>
        </DialogHeader>
        <RegistroForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
