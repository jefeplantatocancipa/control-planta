"use client";

import { useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPedidoInsumosDestinatario, type ActionState } from "./actions";

export function PedidoInsumosConfigPanel({
  destinatarioEmail,
  canWrite,
}: {
  destinatarioEmail: string | null;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setPedidoInsumosDestinatario,
    {},
  );
  const [email, setEmail] = useState(destinatarioEmail ?? "");

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="font-medium">Pedido de insumos</h3>
        <p className="text-sm text-muted-foreground">
          Correo al que se envía el Pedido de insumos armado desde Programa.
        </p>
      </div>
      {canWrite ? (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="destinatario_email">Destinatario</Label>
            <Input
              id="destinatario_email"
              name="destinatario_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ej: alexander@fasalact.com"
              className="w-72"
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="text-sm text-muted-foreground">Guardado.</p>
          )}
        </form>
      ) : (
        <p className="text-sm">{destinatarioEmail ?? "Sin configurar"}</p>
      )}
    </div>
  );
}
