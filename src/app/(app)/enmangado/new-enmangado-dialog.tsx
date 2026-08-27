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
import { createVasoEnmangado, type ActionState } from "./actions";
import { NO_ORDER_VALUE } from "./constants";
import type { Database } from "@/lib/supabase/types";

type Referencia = Database["public"]["Tables"]["enmangado_referencias"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface OrderOption {
  id: string;
  label: string;
}

function NewEnmangadoForm({
  referencias,
  orders,
  operarios,
  onSuccess,
}: {
  referencias: Referencia[];
  orders: OrderOption[];
  operarios: Profile[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createVasoEnmangado,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="referencia_id">Referencia</Label>
        <Select name="referencia_id" required>
          <SelectTrigger id="referencia_id" className="w-full">
            <SelectValue placeholder="Elegí una referencia" />
          </SelectTrigger>
          <SelectContent>
            {referencias.map((referencia) => (
              <SelectItem key={referencia.id} value={referencia.id}>
                {referencia.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {orders.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="enmangado_order_id">Orden de enmangado</Label>
          <Select name="enmangado_order_id" defaultValue={NO_ORDER_VALUE}>
            <SelectTrigger id="enmangado_order_id" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORDER_VALUE}>Sin orden asociada</SelectItem>
              {orders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="operario_id">Operario responsable</Label>
        <Select name="operario_id" required>
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="lote_etiqueta">Lote / etiqueta</Label>
        <Input id="lote_etiqueta" name="lote_etiqueta" placeholder="Opcional" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cantidad_unidades">Unidades</Label>
          <Input
            id="cantidad_unidades"
            name="cantidad_unidades"
            type="number"
            step="1"
            min="0"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cantidad_mermas">Mermas</Label>
          <Input
            id="cantidad_mermas"
            name="cantidad_mermas"
            type="number"
            step="1"
            min="0"
            defaultValue={0}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" name="notes" placeholder="Opcional" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Registrar enmangado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewEnmangadoDialog({
  referencias,
  orders,
  operarios,
}: {
  referencias: Referencia[];
  orders: OrderOption[];
  operarios: Profile[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Nuevo enmangado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo enmangado</DialogTitle>
        </DialogHeader>
        <NewEnmangadoForm
          referencias={referencias}
          orders={orders}
          operarios={operarios}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
