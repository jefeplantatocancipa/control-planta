"use client";

import { useActionState, useState } from "react";
import { updateProgramStatus, type ActionState } from "./actions";
import type { ProgramStatus } from "@/lib/supabase/types";

const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  cerrado: "Cerrado",
};

// Controlado a propósito: ver el comentario en order-status-select.tsx. El
// padre le pasa key={status} para reiniciar el estado local si cambia.
export function ProgramStatusSelect({
  programId,
  status,
}: {
  programId: string;
  status: ProgramStatus;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateProgramStatus,
    {},
  );
  const [value, setValue] = useState(status);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={programId} />
      <select
        name="status"
        value={value}
        onChange={(e) => {
          setValue(e.target.value as ProgramStatus);
          e.currentTarget.form?.requestSubmit();
        }}
        className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs"
      >
        {Object.entries(PROGRAM_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {state.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
