"use client";

import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { reenviarPedidoInsumos, type ActionState } from "./actions";

export function ReenviarButton({ pedidoId }: { pedidoId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reenviarPedidoInsumos,
    {},
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={pedidoId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Reenviando..." : "Reenviar correo"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && <p className="text-sm text-muted-foreground">Correo reenviado.</p>}
    </form>
  );
}
