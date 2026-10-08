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
import { OptionPicker } from "@/components/option-picker";
import { startEnvasado, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type EnvasadoInsumo = Database["public"]["Tables"]["envasado_insumos"]["Row"];

interface BacheOption {
  id: string;
  productId: string;
  title: string;
  meta: string[];
}

interface EnvasadoReferenciaOption {
  id: string;
  productIds: string[];
  sku: string;
  name: string;
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
          <div key={draft.key} className="flex flex-col gap-2 rounded-lg border p-3">
            <OptionPicker
              value={draft.bacheId}
              onChange={(value) => updateAt(index, { bacheId: value })}
              items={opciones.map((o) => ({
                value: o.id,
                title: o.batchCode,
                meta: [`quedan ${o.volumenRestante} L`],
              }))}
              className="max-h-40 border-0 p-0"
            />
            <div className="flex items-center gap-2">
              <Input
                placeholder="Cantidad (kg)"
                type="number"
                step="0.01"
                min="0"
                value={draft.cantidad}
                onChange={(e) => updateAt(index, { cantidad: e.target.value })}
                className="w-32"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(index)}
                className="ml-auto"
              >
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
  referencias,
  envasadoInsumos,
  recipeByReferencia,
  bachesConBase,
  onSuccess,
}: {
  baches: BacheOption[];
  referencias: EnvasadoReferenciaOption[];
  envasadoInsumos: EnvasadoInsumo[];
  recipeByReferencia: Record<string, string[]>;
  bachesConBase: BacheConBaseOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startEnvasado,
    {},
  );
  const [bacheId, setBacheId] = useState("");
  const [referenciaId, setReferenciaId] = useState("");
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

  // No se elige una orden a mano: con la referencia alcanza, el servidor
  // busca sola la orden pendiente de esa referencia (la de fecha más
  // próxima) y le acredita las unidades -- así el cumplimiento del
  // programa semanal se completa sin este paso extra.
  function selectReferencia(value: string) {
    setReferenciaId(value);
    const referencia = referencias.find((r) => r.id === value);
    if (!referencia) {
      setPresentacion("");
      aplicarInsumosDeReferencia("");
      return;
    }
    setPresentacion(`${referencia.sku} — ${referencia.name}`);
    aplicarInsumosDeReferencia(referencia.id);
  }

  function selectBache(value: string) {
    setBacheId(value);
    const bache = baches.find((b) => b.id === value);
    if (!bache) return;

    // Si la referencia ya elegida no aplica al producto de este bache, se
    // limpia en vez de dejar armada una combinación cruzada.
    const referencia = referencias.find((r) => r.id === referenciaId);
    if (referencia && !referencia.productIds.includes(bache.productId)) {
      setReferenciaId("");
      setPresentacion("");
      aplicarInsumosDeReferencia("");
    }
  }

  const bacheActivo = baches.find((b) => b.id === bacheId);
  const referenciasVisibles = bacheActivo
    ? referencias.filter((r) => r.productIds.includes(bacheActivo.productId))
    : [];

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
      <div className="flex flex-col gap-2">
        <Label>Bache</Label>
        <input type="hidden" name="bache_id" value={bacheId} />
        <OptionPicker
          value={bacheId}
          onChange={selectBache}
          items={baches.map((bache) => ({
            value: bache.id,
            title: bache.title,
            meta: bache.meta,
          }))}
          emptyLabel="No hay baches listos para envasar todavía."
        />
      </div>

      {bacheActivo && (
        <BaseOtroBacheEditor
          drafts={baseOtroBache}
          onChange={setBaseOtroBache}
          opciones={bachesConBaseVisibles}
        />
      )}

      {bacheActivo && referenciasVisibles.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label>Referencia de envasado</Label>
          <input type="hidden" name="referencia_id" value={referenciaId} />
          <input type="hidden" name="presentacion" value={presentacion} />
          <OptionPicker
            value={referenciaId}
            onChange={selectReferencia}
            items={referenciasVisibles.map((r) => ({
              value: r.id,
              title: r.name,
              meta: [r.sku],
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Se busca sola la orden del programa semanal pendiente de esta referencia y se le
            acreditan las unidades.
          </p>
        </div>
      ) : (
        bacheActivo && (
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
            <input type="hidden" name="referencia_id" value="" />
            <p className="text-xs text-muted-foreground">
              Este producto no tiene referencias de envasado configuradas (Administración →
              Envasado) — escribila a mano.
            </p>
          </div>
        )
      )}

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
  referencias,
  envasadoInsumos,
  recipeByReferencia,
  bachesConBase,
}: {
  baches: BacheOption[];
  referencias: EnvasadoReferenciaOption[];
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
          referencias={referencias}
          envasadoInsumos={envasadoInsumos}
          recipeByReferencia={recipeByReferencia}
          bachesConBase={bachesConBase}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
