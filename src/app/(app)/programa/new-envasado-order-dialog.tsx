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
import { createEnvasadoOrder, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type EnvasadoReferencia =
  Database["public"]["Tables"]["envasado_referencias"]["Row"];

function NewEnvasadoOrderForm({
  programId,
  referencias,
  onSuccess,
}: {
  programId: string;
  referencias: EnvasadoReferencia[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createEnvasadoOrder,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="program_id" value={programId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="referencia_id">Referencia</Label>
        <Select
          name="referencia_id"
          required
          items={referencias.map((referencia) => ({
            value: referencia.id,
            label: `${referencia.sku} — ${referencia.name}`,
          }))}
        >
          <SelectTrigger id="referencia_id" className="w-full">
            <SelectValue placeholder="Elegí una referencia" />
          </SelectTrigger>
          <SelectContent>
            {referencias.map((referencia) => (
              <SelectItem key={referencia.id} value={referencia.id}>
                {referencia.sku} — {referencia.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="linea">Línea</Label>
          <Input id="linea" name="linea" placeholder="Opcional" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="planned_quantity">Und. programadas</Label>
          <Input
            id="planned_quantity"
            name="planned_quantity"
            type="number"
            step="1"
            min="1"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="scheduled_date">Fecha programada</Label>
        <Input id="scheduled_date" name="scheduled_date" type="date" required />
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

export function NewEnvasadoOrderDialog({
  programId,
  referencias,
}: {
  programId: string;
  referencias: EnvasadoReferencia[];
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva orden de envasado</DialogTitle>
        </DialogHeader>
        <NewEnvasadoOrderForm
          programId={programId}
          referencias={referencias}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
