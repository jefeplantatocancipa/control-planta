"use client";

import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { reenviarSolicitudTransporte, type ActionState } from "./actions";

export function ReenviarButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reenviarSolicitudTransporte,
    {},
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Enviando..." : state.success ? "Reenviado" : "Reenviar"}
      </Button>
      {state.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
