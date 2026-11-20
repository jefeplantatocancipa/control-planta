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
import {
  upsertEnvasadoInsumo,
  deleteEnvasadoInsumo,
  saveEnvasadoReferenciaRecipe,
  type ActionState,
} from "./actions";
import { ImportEnvasadoInsumosDialog } from "./import-envasado-insumos-dialog";
import type { Database } from "@/lib/supabase/types";

type EnvasadoInsumo = Database["public"]["Tables"]["envasado_insumos"]["Row"];
type EnvasadoReferencia =
  Database["public"]["Tables"]["envasado_referencias"]["Row"];

interface EnvasadoRecipeDraft {
  checked: boolean;
  cantidad: string;
}

function emptyEnvasadoDraft(): EnvasadoRecipeDraft {
  return { checked: false, cantidad: "" };
}

function envasadoDraftsFor(
  insumos: EnvasadoInsumo[],
  recipe: Map<string, number | null>,
) {
  const map = new Map<string, EnvasadoRecipeDraft>();
  for (const insumo of insumos) {
    const cantidad = recipe.get(insumo.id);
    map.set(
      insumo.id,
      recipe.has(insumo.id)
        ? { checked: true, cantidad: cantidad != null ? String(cantidad) : "" }
        : emptyEnvasadoDraft(),
    );
  }
  return map;
}

function EnvasadoInsumoForm({
  insumo,
  onSuccess,
}: {
  insumo: EnvasadoInsumo | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertEnvasadoInsumo,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {insumo && <input type="hidden" name="id" value={insumo.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del insumo</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ej: Vaso 450 g, Tapa, Etiqueta, Caja x12"
          defaultValue={insumo?.name}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unit">Unidad</Label>
        <Input
          id="unit"
          name="unit"
          defaultValue={insumo?.unit ?? "unidades"}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="presentacion_caja">Presentación por caja</Label>
        <Input
          id="presentacion_caja"
          name="presentacion_caja"
          placeholder="Ej: 500 unidades x caja"
          defaultValue={insumo?.presentacion_caja ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="marca">Marca o marcas</Label>
        <Input
          id="marca"
          name="marca"
          placeholder="Ej: Plastienvases, Empack"
          defaultValue={insumo?.marca ?? ""}
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

function RecipeEditor({
  referencias,
  insumos,
  recipeByReferencia,
  canWrite,
}: {
  referencias: EnvasadoReferencia[];
  insumos: EnvasadoInsumo[];
  recipeByReferencia: Map<string, Map<string, number | null>>;
  canWrite: boolean;
}) {
  const [referenciaId, setReferenciaId] = useState(referencias[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Map<string, EnvasadoRecipeDraft>>(
    envasadoDraftsFor(insumos, recipeByReferencia.get(referencias[0]?.id ?? "") ?? new Map()),
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveEnvasadoReferenciaRecipe,
    {},
  );

  function selectReferencia(id: string) {
    setReferenciaId(id);
    setDrafts(envasadoDraftsFor(insumos, recipeByReferencia.get(id) ?? new Map()));
  }

  function update(insumoId: string, patch: Partial<EnvasadoRecipeDraft>) {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(insumoId, { ...(next.get(insumoId) ?? emptyEnvasadoDraft()), ...patch });
      return next;
    });
  }

  const recipePayload = Array.from(drafts.entries())
    .filter(([, d]) => d.checked)
    .map(([envasado_insumo_id, d]) => ({
      envasado_insumo_id,
      cantidad_por_unidad: d.cantidad.trim() ? Number(d.cantidad) : null,
    }));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="referencia_id" value={referenciaId} />
      <input type="hidden" name="recipe" value={JSON.stringify(recipePayload)} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="recipe-referencia">Referencia</Label>
        <Select
          value={referenciaId}
          onValueChange={(value) => selectReferencia(value ?? "")}
          items={referencias.map((r) => ({
            value: r.id,
            label: `${r.sku} — ${r.name}`,
          }))}
        >
          <SelectTrigger id="recipe-referencia" className="w-full sm:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {referencias.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.sku} — {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        {insumos.map((insumo) => {
          const draft = drafts.get(insumo.id) ?? emptyEnvasadoDraft();
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
                <div className="flex flex-col gap-1 pl-6 sm:w-48">
                  <Label className="text-xs font-normal text-muted-foreground">
                    Cantidad / unidad envasada
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={draft.cantidad}
                    onChange={(e) => update(insumo.id, { cantidad: e.target.value })}
                    disabled={!canWrite}
                    placeholder="Ej: 1, o 0.0417 para cajas de 24"
                  />
                </div>
              )}
            </div>
          );
        })}
        {insumos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin insumos de envasado en el catálogo todavía.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Para vasos/tapas/etiquetas es 1 por unidad. Para cajas, cargá la
        fracción (1 ÷ unidades por caja) -- el resultado te va a dar con
        decimales, ajustalo al pedir.
      </p>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {canWrite && (
        <Button type="submit" disabled={pending || !referenciaId} className="self-start">
          {pending ? "Guardando..." : "Guardar receta"}
        </Button>
      )}
      {state.success && (
        <p className="text-sm text-muted-foreground">Receta guardada.</p>
      )}
    </form>
  );
}

export function EnvasadoInsumosPanel({
  insumos,
  referencias,
  referenciaInsumos,
  canWrite = true,
}: {
  insumos: EnvasadoInsumo[];
  referencias: EnvasadoReferencia[];
  referenciaInsumos: {
    referencia_id: string;
    envasado_insumo_id: string;
    cantidad_por_unidad: number | null;
  }[];
  canWrite?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EnvasadoInsumo | null>(null);

  const recipeByReferencia = new Map<string, Map<string, number | null>>();
  for (const row of referenciaInsumos) {
    const map = recipeByReferencia.get(row.referencia_id) ?? new Map<string, number | null>();
    map.set(row.envasado_insumo_id, row.cantidad_por_unidad);
    recipeByReferencia.set(row.referencia_id, map);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Material de empaque</h3>
          <p className="text-sm text-muted-foreground">
            Envases y empaques (vasos, tapas, etiquetas, cajas), usados al
            iniciar un envasado.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <ImportEnvasadoInsumosDialog />
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Nuevo insumo
            </Button>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Presentación por caja</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {insumos.map((insumo) => (
            <TableRow key={insumo.id}>
              <TableCell className="font-medium">{insumo.name}</TableCell>
              <TableCell className="text-muted-foreground">{insumo.unit}</TableCell>
              <TableCell>{insumo.presentacion_caja ?? "—"}</TableCell>
              <TableCell>{insumo.marca ?? "—"}</TableCell>
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
                      action={deleteEnvasadoInsumo}
                      id={insumo.id}
                      title="Eliminar insumo"
                      description={`Borra "${insumo.name}" del catálogo. Si ya está usado en alguna receta o envasado registrado, no se va a poder eliminar -- marcalo como inactivo en su lugar.`}
                    />
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {insumos.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin insumos de envasado todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Separator />

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-medium">Receta por referencia</h3>
          <p className="text-sm text-muted-foreground">
            Los insumos marcados acá son los que aparecen para chequear al
            iniciar un envasado con esa referencia.
          </p>
        </div>
        {referencias.length > 0 ? (
          <RecipeEditor
            referencias={referencias}
            insumos={insumos}
            recipeByReferencia={recipeByReferencia}
            canWrite={canWrite}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Creá al menos una referencia en la pestaña Envasado para definir
            su receta de empaque.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar insumo" : "Nuevo insumo de envasado"}
            </DialogTitle>
          </DialogHeader>
          <EnvasadoInsumoForm
            key={editing?.id ?? "new"}
            insumo={editing}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
