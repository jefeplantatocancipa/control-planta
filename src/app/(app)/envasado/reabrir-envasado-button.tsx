"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reabrirEnvasado, type ActionState } from "./actions";

function ReabrirForm({ id, onSuccess }: { id: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reabrirEnvasado,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Reabriendo..." : "Reabrir envasado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReabrirEnvasadoButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        title="Reabrir envasado"
      >
        <RotateCcw className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir envasado</DialogTitle>
            <DialogDescription>
              Vuelve a dejarlo en curso para seguir cargando turnos/estibas. Se deshace el
              consumo de material de empaque que había generado el cierre (se vuelve a calcular
              al finalizarlo de nuevo). No cambia la hora de inicio.
            </DialogDescription>
          </DialogHeader>
          <ReabrirForm id={id} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
