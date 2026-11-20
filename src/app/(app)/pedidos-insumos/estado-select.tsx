"use client";

import { useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { setPedidoEstado, type ActionState } from "./actions";
import type { PedidoInsumosEstado } from "@/lib/supabase/types";

export const PEDIDO_ESTADO_LABELS: Record<PedidoInsumosEstado, string> = {
  enviado: "Enviado",
  recibido_parcial: "Recibido parcial",
  recibido: "Recibido",
};

const PEDIDO_ESTADO_CLASSES: Record<PedidoInsumosEstado, string> = {
  enviado: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  recibido_parcial: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  recibido: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

// Mismo patrón controlado que order-status-select.tsx: un <select> nativo
// con auto-submit, controlado para que no "rebote" al valor inicial cuando
// termina el form action.
export function PedidoEstadoSelect({
  pedidoId,
  estado,
}: {
  pedidoId: string;
  estado: PedidoInsumosEstado;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setPedidoEstado, {});
  const [value, setValue] = useState(estado);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={pedidoId} />
      <select
        name="estado"
        value={value}
        onChange={(e) => {
          setValue(e.target.value as PedidoInsumosEstado);
          e.currentTarget.form?.requestSubmit();
        }}
        className={`h-7 rounded-lg border px-2 text-xs font-medium ${PEDIDO_ESTADO_CLASSES[value]}`}
      >
        {Object.entries(PEDIDO_ESTADO_LABELS).map(([value, label]) => (
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
