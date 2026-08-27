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
import { createEnmangadoProgram, type ActionState } from "./actions";

function NewEnmangadoProgramForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createEnmangadoProgram,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="week_start_date">Semana (lunes)</Label>
        <Input
          id="week_start_date"
          name="week_start_date"
          type="date"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" name="notes" placeholder="Opcional" />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear programa"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewEnmangadoProgramDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Nuevo programa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo programa de enmangado</DialogTitle>
        </DialogHeader>
        <NewEnmangadoProgramForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
