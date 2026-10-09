"use client";

import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { updateBacheStatus, reabrirBache, type ActionState } from "../actions";
import type { BacheStatus } from "@/lib/supabase/types";

function StatusButton({
  bacheId,
  status,
  label,
  pendingLabel,
  variant,
  disabled,
}: {
  bacheId: string;
  status: "completado" | "cancelado";
  label: string;
  pendingLabel: string;
  variant: "default" | "destructive";
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateBacheStatus,
    {},
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={bacheId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="sm" disabled={pending || disabled}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ReabrirButton({ bacheId }: { bacheId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reabrirBache,
    {},
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={bacheId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Reabriendo..." : "Reabrir bache"}
      </Button>
      {state.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function BacheStatusActions({
  bacheId,
  status,
}: {
  bacheId: string;
  status: BacheStatus;
}) {
  if (status !== "en_proceso") {
    return <ReabrirButton bacheId={bacheId} />;
  }

  return (
    <div className="flex gap-2">
      <StatusButton
        bacheId={bacheId}
        status="cancelado"
        label="Cancelar bache"
        pendingLabel="Cancelando..."
        variant="destructive"
      />
    </div>
  );
}
