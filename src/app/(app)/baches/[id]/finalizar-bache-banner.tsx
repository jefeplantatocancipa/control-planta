"use client";

import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateBacheStatus, type ActionState } from "../actions";

// Aparece solo cuando ya se cerró la última etapa: antes no era claro que
// hacía falta un paso manual aparte para cerrar el bache, así que el aviso
// tiene que ser imposible de pasar por alto (no un botón más entre otros).
export function FinalizarBacheBanner({ bacheId }: { bacheId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateBacheStatus,
    {},
  );

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-primary bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-primary">
            Todas las etapas están completas
          </p>
          <p className="text-sm text-muted-foreground">
            El bache no se cierra solo: hace falta finalizarlo acá para que
            quede registrado como completado.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <form action={action}>
          <input type="hidden" name="id" value={bacheId} />
          <input type="hidden" name="status" value="completado" />
          <Button type="submit" disabled={pending}>
            {pending ? "Finalizando..." : "Finalizar bache"}
          </Button>
        </form>
        {state.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
