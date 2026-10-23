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
import { reabrirEtapaBache, type ActionState } from "../actions";

function ReabrirForm({ recordId, onSuccess }: { recordId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reabrirEtapaBache,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="record_id" value={recordId} />
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Reabriendo..." : "Reabrir etapa"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReabrirEtapaButton({ recordId }: { recordId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        title="Reabrir etapa"
      >
        <RotateCcw className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir etapa</DialogTitle>
            <DialogDescription>
              Vuelve a dejarla en curso para corregir la captura. Si tomó base de otro bache o
              generó consumo de insumos, se deshace. No cambia la hora de inicio. Se bloquea si ya
              hay una etapa posterior iniciada.
            </DialogDescription>
          </DialogHeader>
          <ReabrirForm recordId={recordId} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
