"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteButton } from "@/components/delete-button";
import { ImportRecetaProductoDialog } from "./import-receta-producto-dialog";
import {
  upsertInsumo,
  deleteInsumo,
  saveProductRecipe,
  type ActionState,
} from "./actions";
import type { Database } from "@/lib/supabase/types";

type Insumo = Database["public"]["Tables"]["insumos"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

interface RecipeConfig {
  cantidad_kg_por_bache: number | null;
  tolerancia_inferior_pct: number | null;
  tolerancia_superior_pct: number | null;
  obligatorio: boolean;
}

// Los 3 campos numéricos quedan como string en el draft -- son inputs
// controlados y "" (vacío) es un valor válido (sin tolerancia cargada).
interface RecipeRowDraft {
  checked: boolean;
  cantidad: string;
  tolInf: string;
  tolSup: string;
  obligatorio: boolean;
}

function InsumoForm({
  insumo,
  onSuccess,
}: {
  insumo: Insumo | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertInsumo,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {insumo && <input type="hidden" name="id" value={insumo.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={insumo?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unit">Unidad</Label>
        <Input
          id="unit"
          name="unit"
          defaultValue={insumo?.unit ?? "kg"}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="stock_minimo">Stock mínimo</Label>
        <Input
          id="stock_minimo"
          name="stock_minimo"
          type="number"
          step="0.01"
          min="0"
          defaultValue={insumo?.stock_minimo ?? ""}
          placeholder="Opcional"
        />
        <p className="text-xs text-muted-foreground">
          Si el stock actual queda por debajo, se resalta en Inventario.
        </p>
      </div>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={insumo?.active ?? true}
          className="size-4"
        />
        Activo
      </Label>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function emptyDraft(cfg?: RecipeConfig): RecipeRowDraft {
  return {
    checked: Boolean(cfg),
    cantidad: cfg?.cantidad_kg_por_bache != null ? String(cfg.cantidad_kg_por_bache) : "",
    tolInf: cfg?.tolerancia_inferior_pct != null ? String(cfg.tolerancia_inferior_pct) : "",
    tolSup: cfg?.tolerancia_superior_pct != null ? String(cfg.tolerancia_superior_pct) : "",
    obligatorio: cfg?.obligatorio ?? false,
  };
}

function draftsFor(insumos: Insumo[], recipe: Map<string, RecipeConfig>) {
  const map = new Map<string, RecipeRowDraft>();
  for (const insumo of insumos) map.set(insumo.id, emptyDraft(recipe.get(insumo.id)));
  return map;
}

function RecipeEditor({
  products,
  insumos,
  recipeByProduct,
  canWrite,
}: {
  products: Product[];
  insumos: Insumo[];
  recipeByProduct: Map<string, Map<string, RecipeConfig>>;
  canWrite: boolean;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const selectedProduct = products.find((p) => p.id === productId);
  const [drafts, setDrafts] = useState<Map<string, RecipeRowDraft>>(
    draftsFor(insumos, recipeByProduct.get(products[0]?.id ?? "") ?? new Map()),
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveProductRecipe,
    {},
  );

  function selectProduct(id: string) {
    setProductId(id);
    setDrafts(draftsFor(insumos, recipeByProduct.get(id) ?? new Map()));
  }

  function update(insumoId: string, patch: Partial<RecipeRowDraft>) {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(insumoId, { ...(next.get(insumoId) ?? emptyDraft()), ...patch });
      return next;
    });
  }

  const recipePayload = Array.from(drafts.entries())
    .filter(([, d]) => d.checked)
    .map(([insumo_id, d]) => ({
      insumo_id,
      cantidad_kg_por_bache: d.cantidad.trim() ? Number(d.cantidad) : null,
      tolerancia_inferior_pct: d.tolInf.trim() ? Number(d.tolInf) : null,
      tolerancia_superior_pct: d.tolSup.trim() ? Number(d.tolSup) : null,
      obligatorio: d.obligatorio,
    }));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="recipe" value={JSON.stringify(recipePayload)} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="recipe-product">Producto</Label>
        <Select
          value={productId}
          onValueChange={(value) => selectProduct(value ?? "")}
          items={products.map((product) => ({
            value: product.id,
            label: product.name,
          }))}
        >
          <SelectTrigger id="recipe-product" className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selectedProduct?.volumen_por_bache
            ? `Volumen estándar por bache de este producto: ${selectedProduct.volumen_por_bache} L (se edita en Administración → Productos).`
            : "Este producto no tiene volumen por bache configurado en Administración → Productos: la cantidad esperada no se podrá escalar."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {insumos.map((insumo) => {
          const draft = drafts.get(insumo.id) ?? emptyDraft();
          return (
            <div key={insumo.id} className="flex flex-col gap-2 rounded-lg border p-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.checked}
                  onChange={(e) => update(insumo.id, { checked: e.target.checked })}
                  disabled={!canWrite}
                />
                {insumo.name}
              </label>
              {draft.checked && (
                <div className="grid grid-cols-2 gap-2 pl-6 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-normal text-muted-foreground">
                      kg / bache
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      value={draft.cantidad}
                      onChange={(e) => update(insumo.id, { cantidad: e.target.value })}
                      disabled={!canWrite}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-normal text-muted-foreground">
                      Tolerancia inf. %
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      value={draft.tolInf}
                      onChange={(e) => update(insumo.id, { tolInf: e.target.value })}
                      disabled={!canWrite}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-normal text-muted-foreground">
                      Tolerancia sup. %
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      value={draft.tolSup}
                      onChange={(e) => update(insumo.id, { tolSup: e.target.value })}
                      disabled={!canWrite}
                      placeholder="Opcional"
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={draft.obligatorio}
                      onChange={(e) => update(insumo.id, { obligatorio: e.target.checked })}
                      disabled={!canWrite}
                    />
                    Obligatorio
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {insumos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin insumos en el catálogo todavía.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Cantidad y tolerancias son opcionales: sin tolerancia cargada para un
        insumo, se muestra la cantidad esperada pero no se pide
        justificación. &quot;Obligatorio&quot; exige justificar si el
        insumo no se marca al finalizar la etapa.
      </p>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {canWrite && (
        <Button type="submit" disabled={pending || !productId} className="self-start">
          {pending ? "Guardando..." : "Guardar receta"}
        </Button>
      )}
      {state.success && (
        <p className="text-sm text-muted-foreground">Receta guardada.</p>
      )}
    </form>
  );
}

type ProductInsumoRow = Database["public"]["Tables"]["product_insumos"]["Row"];

export function InsumosPanel({
  insumos,
  products,
  productInsumos,
  canWrite = true,
}: {
  insumos: Insumo[];
  products: Product[];
  productInsumos: ProductInsumoRow[];
  canWrite?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);

  const recipeByProduct = new Map<string, Map<string, RecipeConfig>>();
  for (const row of productInsumos) {
    const map = recipeByProduct.get(row.product_id) ?? new Map<string, RecipeConfig>();
    map.set(row.insumo_id, {
      cantidad_kg_por_bache: row.cantidad_kg_por_bache,
      tolerancia_inferior_pct: row.tolerancia_inferior_pct,
      tolerancia_superior_pct: row.tolerancia_superior_pct,
      obligatorio: row.obligatorio,
    });
    recipeByProduct.set(row.product_id, map);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Materia prima</h3>
            <p className="text-sm text-muted-foreground">
              Insumos de producción del bache (leche, proteína, cultivos,
              etc.), usados en Alistamiento de insumos y Mezcla.
            </p>
          </div>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Nuevo insumo
            </Button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((insumo) => (
              <TableRow key={insumo.id}>
                <TableCell className="font-medium">{insumo.name}</TableCell>
                <TableCell className="text-muted-foreground">{insumo.unit}</TableCell>
                <TableCell>
                  <Badge variant={insumo.active ? "default" : "outline"}>
                    {insumo.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(insumo);
                          setOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <DeleteButton
                        action={deleteInsumo}
                        id={insumo.id}
                        title="Eliminar insumo"
                        description={`Borra "${insumo.name}" del catálogo. Si ya está usado en alguna receta o etapa registrada, no se va a poder eliminar -- marcalo como inactivo en su lugar.`}
                      />
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {insumos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin insumos todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Receta por producto</h3>
            <p className="text-sm text-muted-foreground">
              Los insumos marcados acá son los que aparecen para chequear en
              la etapa de alistamiento de insumos de cada bache.
            </p>
          </div>
          {canWrite && <ImportRecetaProductoDialog />}
        </div>
        {products.length > 0 ? (
          <RecipeEditor
            products={products}
            insumos={insumos}
            recipeByProduct={recipeByProduct}
            canWrite={canWrite}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Creá al menos un producto para definir su receta.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
          </DialogHeader>
          <InsumoForm
            key={editing?.id ?? "new"}
            insumo={editing}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
