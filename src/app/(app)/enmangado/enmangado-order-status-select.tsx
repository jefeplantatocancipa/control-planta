"use client";

import { useActionState } from "react";
import { updateEnmangadoOrderStatus, type ActionState } from "./actions";
import type { OrderStatus } from "@/lib/supabase/types";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export function EnmangadoOrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateEnmangadoOrderStatus,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={orderId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs"
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
