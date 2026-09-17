"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
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
import { registrarEntrada, registrarAjuste, type ActionState } from "./actions";
import type { InventarioInsumoTipo } from "@/lib/supabase/types";

interface InsumoOption {
  id: string;
  name: string;
}

const TIPO_LABELS: Record<InventarioInsumoTipo, string> = {
  materia_prima: "Materia prima",
  empaque: "Material de empaque",
  vaso_blanco: "Vaso blanco",
  generico: "Otro (aseo, etc.)",
};

function MovimientoForm({
  mode,
  catalogos,
  onSuccess,
}: {
  mode: "entrada" | "ajuste";
  catalogos: Record<InventarioInsumoTipo, InsumoOption[]>;
  onSuccess: () => void;
}) {
  const action = mode === "entrada" ? registrarEntrada : registrarAjuste;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [insumoTipo, setInsumoTipo] = useState<InventarioInsumoTipo>("materia_prima");
  const [insumoId, setInsumoId] = useState("");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  function selectTipo(value: string) {
    setInsumoTipo(value as InventarioInsumoTipo);
    setInsumoId("");
  }

  const opciones = catalogos[insumoTipo] ?? [];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="insumo_tipo" value={insumoTipo} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="insumo_tipo_select">Categoría</Label>
        <Select
          value={insumoTipo}
          onValueChange={(value) => selectTipo(value ?? "materia_prima")}
          items={Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label }))}
        >
          <SelectTrigger id="insumo_tipo_select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="insumo_id">Insumo</Label>
        <Select
          name="insumo_id"
          value={insumoId}
          onValueChange={(value) => setInsumoId(value ?? "")}
          items={opciones.map((o) => ({ value: o.id, label: o.name }))}
        >
          <SelectTrigger id="insumo_id" className="w-full">
            <SelectValue placeholder="Elegí un insumo" />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {opciones.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sin insumos activos en esta categoría.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cantidad">
          {mode === "entrada" ? "Cantidad ingresada" : "Ajuste (+ o -)"}
        </Label>
        <Input
          id="cantidad"
          name="cantidad"
          type="number"
          step="0.01"
          min={mode === "entrada" ? "0" : undefined}
          required
        />
        {mode === "ajuste" && (
          <p className="text-xs text-muted-foreground">
            Positivo si el conteo físico dio más de lo que muestra el
            sistema, negativo si dio menos.
          </p>
        )}
      </div>

      {mode === "entrada" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lote">Lote</Label>
            <Input id="lote" name="lote" placeholder="Opcional" />
            <p className="text-xs text-muted-foreground">
              El mismo insumo puede tener varios lotes con saldo propio al
              mismo tiempo.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="proveedor">Proveedor</Label>
            <Input id="proveedor" name="proveedor" placeholder="Opcional" />
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">{mode === "ajuste" ? "Motivo del ajuste" : "Notas"}</Label>
        <Input
          id="notas"
          name="notas"
          placeholder={mode === "ajuste" ? "Ej: conteo físico mensual" : "Opcional"}
          required={mode === "ajuste"}
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending || !insumoId}>
          {pending
            ? "Guardando..."
            : mode === "entrada"
              ? "Registrar entrada"
              : "Registrar ajuste"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MovimientoDialog({
  mode,
  catalogos,
}: {
  mode: "entrada" | "ajuste";
  catalogos: Record<InventarioInsumoTipo, InsumoOption[]>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={mode === "entrada" ? "default" : "outline"}>
            {mode === "entrada" ? "Nueva entrada" : "Registrar ajuste"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "entrada" ? "Nueva entrada de stock" : "Ajuste de inventario"}
          </DialogTitle>
        </DialogHeader>
        <MovimientoForm mode={mode} catalogos={catalogos} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
