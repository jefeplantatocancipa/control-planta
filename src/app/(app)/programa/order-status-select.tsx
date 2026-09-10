"use client";

import { useActionState, useState } from "react";
import { updateOrderStatus, type ActionState } from "./actions";
import { ORDER_STATUS_LABELS, ORDER_STATUS_CLASSES } from "./order-status-styles";
import type { OrderStatus } from "@/lib/supabase/types";

// Controlado a propósito: un <select> no controlado con defaultValue se
// resetea a su valor inicial en cuanto termina el form action (React lo
// trata como un submit nativo), así que sin esto la selección "rebota" de
// vuelta apenas se guarda. El padre le pasa key={status} para reiniciar el
// estado local si el status cambia por otra vía (ej. otro usuario).
export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateOrderStatus,
    {},
  );
  const [value, setValue] = useState(status);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={orderId} />
      <select
        name="status"
        value={value}
        onChange={(e) => {
          setValue(e.target.value as OrderStatus);
          e.currentTarget.form?.requestSubmit();
        }}
        className={`h-7 rounded-lg border px-2 text-xs font-medium ${ORDER_STATUS_CLASSES[value]}`}
      >
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
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
