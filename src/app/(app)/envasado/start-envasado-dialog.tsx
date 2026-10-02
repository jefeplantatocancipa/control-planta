"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Plus, X } from "lucide-react";
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

type EnvasadoInsumo = Database["public"]["Tables"]["envasado_insumos"]["Row"];

interface BacheOption {
  id: string;
  productId: string;
  label: string;
}

interface EnvasadoOrderOption {
  id: string;
  label: string;
  presentacion: string;
  referenciaId: string;
  productId: string | null;
}

interface BacheConBaseOption {
  id: string;
  productId: string;
  batchCode: string;
  volumenRestante: number | null;
}

interface BaseOtroBacheDraft {
  key: number;
  bacheId: string;
  cantidad: string;
}

interface InsumoUsoDraft {
  envasado_insumo_id: string;
  nombre: string;
  checked: boolean;
  lote: string;
  fecha_vencimiento: string;
  proveedor: string;
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

// Para cuando se mezcla el sobrante de OTRO bache (ej. de un tanque) al
// momento de envasar: suma al balance de masa del bache que se está
// envasando y se descuenta de "volumen_restante_litros" del bache de
// origen, para no contarlo dos veces.
function BaseOtroBacheEditor({
  drafts,
  onChange,
  opciones,
}: {
  drafts: BaseOtroBacheDraft[];
  onChange: (drafts: BaseOtroBacheDraft[]) => void;
  opciones: BacheConBaseOption[];
}) {
  function updateAt(index: number, patch: Partial<BaseOtroBacheDraft>) {
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function remove(index: number) {
    onChange(drafts.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...drafts, { key: Date.now() + drafts.length, bacheId: "", cantidad: "" }]);
  }

  if (opciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Label>Base de otro bache (si mezclaste sobrante de otro tanque)</Label>
      {drafts.map((draft, index) => {
        const opcion = opciones.find((o) => o.id === draft.bacheId);
        const disponible = opcion?.volumenRestante ?? null;
        const excede = disponible != null && Number(draft.cantidad) > disponible;
        return (
          <div key={draft.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <select
                value={draft.bacheId}
                onChange={(e) => updateAt(index, { bacheId: e.target.value })}
                className="h-8 flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Elegí un bache</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.batchCode} (quedan {o.volumenRestante} L)
                  </option>
                ))}
              </select>
              <Input
                placeholder="Cantidad (kg)"
                type="number"
                step="0.01"
                min="0"
                value={draft.cantidad}
                onChange={(e) => updateAt(index, { cantidad: e.target.value })}
                className="w-32"
              />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
                <X className="size-4" />
              </Button>
            </div>
            {excede && (
              <p className="text-xs text-destructive">
                Supera lo que queda disponible en ese bache ({disponible} L).
              </p>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={add} className="self-start">
        <Plus className="size-4" />
        Agregar base de otro bache
      </Button>
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
  }));
}

function StartEnvasadoForm({
  baches,
  envasadoOrders,
  envasadoInsumos,
  recipeByReferencia,
  bachesConBase,
  onSuccess,
}: {
  baches: BacheOption[];
  envasadoOrders: EnvasadoOrderOption[];
  envasadoInsumos: EnvasadoInsumo[];
  recipeByReferencia: Record<string, string[]>;
  bachesConBase: BacheConBaseOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startEnvasado,
    {},
  );
  const [orderId, setOrderId] = useState(NO_ORDER_VALUE);
  const [bacheId, setBacheId] = useState("");
  const [referenciaId, setReferenciaId] = useState(NO_ORDER_VALUE);
  const [presentacion, setPresentacion] = useState("");
  const [insumos, setInsumos] = useState<InsumoUsoDraft[]>(
    buildInsumoDrafts(envasadoInsumos),
  );
  const [insumosFiltrados, setInsumosFiltrados] = useState(false);
  const [insumosObservacion, setInsumosObservacion] = useState("");
  const [baseOtroBache, setBaseOtroBache] = useState<BaseOtroBacheDraft[]>([]);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  function aplicarInsumosDeReferencia(referenciaIdElegida: string) {
    const receta = recipeByReferencia[referenciaIdElegida];
    if (receta && receta.length > 0) {
      const recetaSet = new Set(receta);
      setInsumos(buildInsumoDrafts(envasadoInsumos.filter((i) => recetaSet.has(i.id))));
      setInsumosFiltrados(true);
    } else {
      setInsumos(buildInsumoDrafts(envasadoInsumos));
      setInsumosFiltrados(false);
    }
  }

  function selectOrder(value: string) {
    setOrderId(value);
    const order = envasadoOrders.find((o) => o.id === value);
    if (!order) return;
    setPresentacion(order.presentacion);
    setReferenciaId(order.referenciaId);
    aplicarInsumosDeReferencia(order.referenciaId);

    // Si el bache ya elegido es de otro producto, se deselecciona: evita
    // armar una combinación cruzada orden/bache sin querer.
    const bache = baches.find((b) => b.id === bacheId);
    if (bache && order.productId && bache.productId !== order.productId) {
      setBacheId("");
    }
  }

  function selectBache(value: string) {
    setBacheId(value);
    const bache = baches.find((b) => b.id === value);
    if (!bache) return;

    // Misma idea en el otro sentido: si había una orden de otro producto
    // elegida, se limpia en vez de dejar la combinación mal armada.
    const order = envasadoOrders.find((o) => o.id === orderId);
    if (order && order.productId && order.productId !== bache.productId) {
      setOrderId(NO_ORDER_VALUE);
      setPresentacion("");
      setReferenciaId(NO_ORDER_VALUE);
      aplicarInsumosDeReferencia("");
    }
  }

  // El desplegable que falta por elegir se filtra por el producto del que
  // ya se eligió, para no poder armar una orden/bache de productos
  // distintos en primer lugar.
  const bacheActivo = baches.find((b) => b.id === bacheId);
  const ordenActiva = envasadoOrders.find((o) => o.id === orderId);
  const visibleBaches = ordenActiva?.productId
    ? baches.filter((b) => b.productId === ordenActiva.productId)
    : baches;
  const visibleOrders = bacheActivo
    ? envasadoOrders.filter((o) => !o.productId || o.productId === bacheActivo.productId)
    : envasadoOrders;

  // Candidatos para "base de otro bache": mismo producto que el bache que
  // se está envasando, sin contar el propio bache.
  const bachesConBaseVisibles = bacheActivo
    ? bachesConBase.filter((b) => b.productId === bacheActivo.productId && b.id !== bacheActivo.id)
    : [];
  const baseOtroBacheValida = baseOtroBache.filter((b) => b.bacheId && Number(b.cantidad) > 0);
  const baseOtroBacheExcede = baseOtroBacheValida.some((b) => {
    const disponible = bachesConBase.find((o) => o.id === b.bacheId)?.volumenRestante;
    return disponible != null && Number(b.cantidad) > disponible;
  });

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
              ...visibleOrders.map((order) => ({
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
              {visibleOrders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {bacheActivo
              ? "Mostrando solo las órdenes del producto del bache elegido."
              : "Al elegir una orden se completa la presentación (podés cambiarla) y se filtra el bache al mismo producto."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="bache_id">Bache</Label>
        <Select
          name="bache_id"
          value={bacheId}
          onValueChange={(value) => selectBache(value ?? "")}
          required
          items={visibleBaches.map((bache) => ({ value: bache.id, label: bache.label }))}
        >
          <SelectTrigger id="bache_id" className="w-full">
            <SelectValue placeholder="Elegí un bache" />
          </SelectTrigger>
          <SelectContent>
            {visibleBaches.map((bache) => (
              <SelectItem key={bache.id} value={bache.id}>
                {bache.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ordenActiva && visibleBaches.length === 0 && (
          <p className="text-xs text-destructive">
            No hay baches de este producto listos para envasar todavía.
          </p>
        )}
      </div>

      {bacheActivo && (
        <BaseOtroBacheEditor
          drafts={baseOtroBache}
          onChange={setBaseOtroBache}
          opciones={bachesConBaseVisibles}
        />
      )}

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

      <input type="hidden" name="referencia_id" value={referenciaId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="lote">Lote de envasado</Label>
        <Input id="lote" name="lote" required />
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
          })),
        )}
      />
      {baseOtroBacheValida.length > 0 && (
        <input
          type="hidden"
          name="base_otro_bache"
          value={JSON.stringify(
            baseOtroBacheValida.map((b) => ({
              bache_id: b.bacheId,
              batch_code: bachesConBase.find((o) => o.id === b.bacheId)?.batchCode ?? "—",
              cantidad: Number(b.cantidad),
            })),
          )}
        />
      )}

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
        <Button
          type="submit"
          disabled={pending || checkedInsumos.length === 0 || baseOtroBacheExcede}
        >
          {pending ? "Iniciando..." : "Iniciar envasado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StartEnvasadoDialog({
  baches,
  envasadoOrders,
  envasadoInsumos,
  recipeByReferencia,
  bachesConBase,
}: {
  baches: BacheOption[];
  envasadoOrders: EnvasadoOrderOption[];
  envasadoInsumos: EnvasadoInsumo[];
  recipeByReferencia: Record<string, string[]>;
  bachesConBase: BacheConBaseOption[];
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
          envasadoOrders={envasadoOrders}
          envasadoInsumos={envasadoInsumos}
          recipeByReferencia={recipeByReferencia}
          bachesConBase={bachesConBase}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
