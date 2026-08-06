"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateBacheStatus, type ActionState } from "../actions";

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

export function BacheStatusActions({
  bacheId,
  allStagesDone,
}: {
  bacheId: string;
  allStagesDone: boolean;
}) {
  return (
    <div className="flex gap-2">
      <StatusButton
        bacheId={bacheId}
        status="cancelado"
        label="Cancelar bache"
        pendingLabel="Cancelando..."
        variant="destructive"
      />
      <StatusButton
        bacheId={bacheId}
        status="completado"
        label="Completar bache"
        pendingLabel="Completando..."
        variant="default"
        disabled={!allStagesDone}
      />
    </div>
  );
}
