"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startEnvasado, type ActionState } from "./actions";
import { NO_ORDER_VALUE } from "./constants";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface BacheOption {
  id: string;
  label: string;
}

interface EnvasadoOrderOption {
  id: string;
  label: string;
  presentacion: string;
}

function StartEnvasadoForm({
  baches,
  operarios,
  envasadoOrders,
  onSuccess,
}: {
  baches: BacheOption[];
  operarios: Profile[];
  envasadoOrders: EnvasadoOrderOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startEnvasado,
    {},
  );
  const [orderId, setOrderId] = useState(NO_ORDER_VALUE);
  const [presentacion, setPresentacion] = useState("");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  function selectOrder(value: string) {
    setOrderId(value);
    const order = envasadoOrders.find((o) => o.id === value);
    if (order) setPresentacion(order.presentacion);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {envasadoOrders.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="envasado_order_id">Orden de envasado</Label>
          <Select
            name="envasado_order_id"
            value={orderId}
            onValueChange={(value) => selectOrder(value ?? NO_ORDER_VALUE)}
            items={[
              { value: NO_ORDER_VALUE, label: "Sin orden asociada" },
              ...envasadoOrders.map((order) => ({
                value: order.id,
                label: order.label,
              })),
            ]}
          >
            <SelectTrigger id="envasado_order_id" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORDER_VALUE}>Sin orden asociada</SelectItem>
              {envasadoOrders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Al elegir una orden se completa la presentación (podés
            cambiarla).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="bache_id">Bache</Label>
        <Select
          name="bache_id"
          required
          items={baches.map((bache) => ({ value: bache.id, label: bache.label }))}
        >
          <SelectTrigger id="bache_id" className="w-full">
            <SelectValue placeholder="Elegí un bache" />
          </SelectTrigger>
          <SelectContent>
            {baches.map((bache) => (
              <SelectItem key={bache.id} value={bache.id}>
                {bache.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="presentacion">Presentación</Label>
        <Input
          id="presentacion"
          name="presentacion"
          placeholder="Ej: Sachet 1L"
          value={presentacion}
          onChange={(e) => setPresentacion(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="operario_id">Operario responsable</Label>
        <Select
          name="operario_id"
          required
          items={operarios.map((operario) => ({
            value: operario.id,
            label: operario.full_name,
          }))}
        >
          <SelectTrigger id="operario_id" className="w-full">
            <SelectValue placeholder="Elegí un operario" />
          </SelectTrigger>
          <SelectContent>
            {operarios.map((operario) => (
              <SelectItem key={operario.id} value={operario.id}>
                {operario.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Iniciando..." : "Iniciar envasado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StartEnvasadoDialog({
  baches,
  operarios,
  envasadoOrders,
}: {
  baches: BacheOption[];
  operarios: Profile[];
  envasadoOrders: EnvasadoOrderOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Iniciar envasado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar envasado</DialogTitle>
        </DialogHeader>
        <StartEnvasadoForm
          baches={baches}
          operarios={operarios}
          envasadoOrders={envasadoOrders}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
