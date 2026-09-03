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
import { addCorteTurno, type ActionState } from "./actions";
import { NO_ORDER_VALUE } from "./constants";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

function CorteTurnoForm({
  envasadoId,
  turnos,
  operarios,
  unidadesInicioSugeridas,
  onSuccess,
}: {
  envasadoId: string;
  turnos: Turno[];
  operarios: Profile[];
  unidadesInicioSugeridas: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addCorteTurno,
    {},
  );
  const [peso1, setPeso1] = useState("");
  const [peso2, setPeso2] = useState("");
  const [peso3, setPeso3] = useState("");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  const pesos = [peso1, peso2, peso3].map(Number).filter((n) => n > 0);
  const promedio =
    pesos.length === 3 ? (pesos[0] + pesos[1] + pesos[2]) / 3 : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="envasado_id" value={envasadoId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="turno_id">Turno</Label>
        <Select
          name="turno_id"
          required
          items={turnos.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.hora_inicio}–${t.hora_fin})`,
          }))}
        >
          <SelectTrigger id="turno_id" className="w-full">
            <SelectValue placeholder="Elegí un turno" />
          </SelectTrigger>
          <SelectContent>
            {turnos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.hora_inicio}–{t.hora_fin})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="operario_id">Operario 1</Label>
          <Select
            name="operario_id"
            required
            items={operarios.map((o) => ({ value: o.id, label: o.full_name }))}
          >
            <SelectTrigger id="operario_id" className="w-full">
              <SelectValue placeholder="Elegí" />
            </SelectTrigger>
            <SelectContent>
              {operarios.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="operario_2_id">Operario 2</Label>
          <Select
            name="operario_2_id"
            defaultValue={NO_ORDER_VALUE}
            items={[
              { value: NO_ORDER_VALUE, label: "—" },
              ...operarios.map((o) => ({ value: o.id, label: o.full_name })),
            ]}
          >
            <SelectTrigger id="operario_2_id" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORDER_VALUE}>—</SelectItem>
              {operarios.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="unidades_inicio">Unidades al inicio</Label>
          <Input
            id="unidades_inicio"
            name="unidades_inicio"
            type="number"
            step="1"
            min="0"
            defaultValue={unidadesInicioSugeridas}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="unidades_final">Unidades al final</Label>
          <Input
            id="unidades_final"
            name="unidades_final"
            type="number"
            step="1"
            min="0"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sellado_cumple">Sellado</Label>
          <select
            id="sellado_cumple"
            name="sellado_cumple"
            defaultValue="true"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="true">Cumple</option>
            <option value="false">No cumple</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lote_marcado">Lote marcado</Label>
          <select
            id="lote_marcado"
            name="lote_marcado"
            defaultValue="C"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="C">Conforme (C)</option>
            <option value="NC">No conforme (NC)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Peso de 3 unidades (g)</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            name="peso_1"
            type="number"
            step="0.01"
            min="0"
            placeholder="1"
            value={peso1}
            onChange={(e) => setPeso1(e.target.value)}
          />
          <Input
            name="peso_2"
            type="number"
            step="0.01"
            min="0"
            placeholder="2"
            value={peso2}
            onChange={(e) => setPeso2(e.target.value)}
          />
          <Input
            name="peso_3"
            type="number"
            step="0.01"
            min="0"
            placeholder="3"
            value={peso3}
            onChange={(e) => setPeso3(e.target.value)}
          />
        </div>
        {promedio !== null && (
          <p className="text-sm font-medium">Promedio: {promedio.toFixed(2)} g</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Input id="observaciones" name="observaciones" placeholder="Opcional" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar corte"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CorteTurnoDialog({
  envasadoId,
  turnos,
  operarios,
  unidadesInicioSugeridas,
}: {
  envasadoId: string;
  turnos: Turno[];
  operarios: Profile[];
  unidadesInicioSugeridas: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Corte de turno</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corte de turno</DialogTitle>
        </DialogHeader>
        <CorteTurnoForm
          envasadoId={envasadoId}
          turnos={turnos}
          operarios={operarios}
          unidadesInicioSugeridas={unidadesInicioSugeridas}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
