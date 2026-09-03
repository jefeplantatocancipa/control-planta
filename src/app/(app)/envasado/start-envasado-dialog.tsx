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
type EnvasadoInsumo = Database["public"]["Tables"]["envasado_insumos"]["Row"];

interface BacheOption {
  id: string;
  label: string;
}

interface EnvasadoOrderOption {
  id: string;
  label: string;
  presentacion: string;
  referenciaId: string;
}

interface InsumoUsoDraft {
  envasado_insumo_id: string;
  nombre: string;
  checked: boolean;
  lote: string;
  fecha_vencimiento: string;
  proveedor: string;
  cantidad_usada: string;
  unidad_medida: string;
  desperdicio: string;
}

function InsumosUsoChecklist({
  drafts,
  onChange,
}: {
  drafts: InsumoUsoDraft[];
  onChange: (drafts: InsumoUsoDraft[]) => void;
}) {
  function updateAt(index: number, patch: Partial<InsumoUsoDraft>) {
    onChange(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  return (
    <div className="flex flex-col gap-3">
      <Label>Insumos de envasado usados</Label>
      {drafts.map((draft, index) => (
        <div key={draft.envasado_insumo_id} className="flex flex-col gap-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.checked}
              onChange={(e) => updateAt(index, { checked: e.target.checked })}
            />
            {draft.nombre}
          </label>
          {draft.checked && (
            <div className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-normal text-muted-foreground">Lote</Label>
                <Input
                  value={draft.lote}
                  onChange={(e) => updateAt(index, { lote: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-normal text-muted-foreground">
                  Fecha de vencimiento
                </Label>
                <Input
                  type="date"
                  value={draft.fecha_vencimiento}
                  onChange={(e) => updateAt(index, { fecha_vencimiento: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-normal text-muted-foreground">Proveedor</Label>
                <Input
                  value={draft.proveedor}
                  onChange={(e) => updateAt(index, { proveedor: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-normal text-muted-foreground">
                  Cantidad usada
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.cantidad_usada}
                  onChange={(e) => updateAt(index, { cantidad_usada: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-normal text-muted-foreground">
                  Unidad de medida
                </Label>
                <Input
                  placeholder="kg, und, m..."
                  value={draft.unidad_medida}
                  onChange={(e) => updateAt(index, { unidad_medida: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-normal text-muted-foreground">
                  Desperdicio
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.desperdicio}
                  onChange={(e) => updateAt(index, { desperdicio: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      ))}
      {drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay insumos de envasado configurados en Administración →
          Envasado.
        </p>
      )}
    </div>
  );
}

function buildInsumoDrafts(list: EnvasadoInsumo[]): InsumoUsoDraft[] {
  return list.map((i) => ({
    envasado_insumo_id: i.id,
    nombre: i.name,
    checked: false,
    lote: "",
    fecha_vencimiento: "",
    proveedor: "",
    cantidad_usada: "",
    unidad_medida: "",
    desperdicio: "",
  }));
}

function StartEnvasadoForm({
  baches,
  operarios,
  envasadoOrders,
  envasadoInsumos,
  recipeByReferencia,
  onSuccess,
}: {
  baches: BacheOption[];
  operarios: Profile[];
  envasadoOrders: EnvasadoOrderOption[];
  envasadoInsumos: EnvasadoInsumo[];
  recipeByReferencia: Record<string, string[]>;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startEnvasado,
    {},
  );
  const [orderId, setOrderId] = useState(NO_ORDER_VALUE);
  const [presentacion, setPresentacion] = useState("");
  const [insumos, setInsumos] = useState<InsumoUsoDraft[]>(
    buildInsumoDrafts(envasadoInsumos),
  );
  const [insumosFiltrados, setInsumosFiltrados] = useState(false);
  const [insumosObservacion, setInsumosObservacion] = useState("");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  function selectOrder(value: string) {
    setOrderId(value);
    const order = envasadoOrders.find((o) => o.id === value);
    if (!order) return;
    setPresentacion(order.presentacion);

    const receta = recipeByReferencia[order.referenciaId];
    if (receta && receta.length > 0) {
      const recetaSet = new Set(receta);
      setInsumos(buildInsumoDrafts(envasadoInsumos.filter((i) => recetaSet.has(i.id))));
      setInsumosFiltrados(true);
    } else {
      setInsumos(buildInsumoDrafts(envasadoInsumos));
      setInsumosFiltrados(false);
    }
  }

  const checkedInsumos = insumos.filter((i) => i.checked);

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

      {insumosFiltrados && (
        <p className="-mb-2 text-xs text-muted-foreground">
          Mostrando solo los insumos de la receta de esta referencia.
        </p>
      )}
      <InsumosUsoChecklist drafts={insumos} onChange={setInsumos} />
      <input
        type="hidden"
        name="insumos_uso"
        value={JSON.stringify(
          checkedInsumos.map((i) => ({
            envasado_insumo_id: i.envasado_insumo_id,
            lote: i.lote,
            fecha_vencimiento: i.fecha_vencimiento || undefined,
            proveedor: i.proveedor,
            cantidad_usada: i.cantidad_usada || undefined,
            unidad_medida: i.unidad_medida,
            desperdicio: i.desperdicio || undefined,
          })),
        )}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="insumos_observacion">Observación del supervisor</Label>
        <Input
          id="insumos_observacion"
          name="insumos_observacion"
          placeholder="Opcional"
          value={insumosObservacion}
          onChange={(e) => setInsumosObservacion(e.target.value)}
        />
      </div>

      {checkedInsumos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Marcá al menos un insumo de envasado antes de iniciar.
        </p>
      )}

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending || checkedInsumos.length === 0}>
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
  envasadoInsumos,
  recipeByReferencia,
}: {
  baches: BacheOption[];
  operarios: Profile[];
  envasadoOrders: EnvasadoOrderOption[];
  envasadoInsumos: EnvasadoInsumo[];
  recipeByReferencia: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Iniciar envasado</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar envasado</DialogTitle>
        </DialogHeader>
        <StartEnvasadoForm
          baches={baches}
          operarios={operarios}
          envasadoOrders={envasadoOrders}
          envasadoInsumos={envasadoInsumos}
          recipeByReferencia={recipeByReferencia}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
