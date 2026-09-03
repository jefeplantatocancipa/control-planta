"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
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
import {
  upsertEnvasadoInsumo,
  saveEnvasadoReferenciaRecipe,
  type ActionState,
} from "./actions";
import { ImportEnvasadoInsumosDialog } from "./import-envasado-insumos-dialog";
import type { Database } from "@/lib/supabase/types";

type EnvasadoInsumo = Database["public"]["Tables"]["envasado_insumos"]["Row"];
type EnvasadoReferencia =
  Database["public"]["Tables"]["envasado_referencias"]["Row"];

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
}: {
  referencias: EnvasadoReferencia[];
  insumos: EnvasadoInsumo[];
  recipeByReferencia: Map<string, Set<string>>;
}) {
  const [referenciaId, setReferenciaId] = useState(referencias[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(
    new Set(recipeByReferencia.get(referencias[0]?.id ?? "") ?? []),
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveEnvasadoReferenciaRecipe,
    {},
  );

  function selectReferencia(id: string) {
    setReferenciaId(id);
    setChecked(new Set(recipeByReferencia.get(id) ?? []));
  }

  function toggle(insumoId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(insumoId)) next.delete(insumoId);
      else next.add(insumoId);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="referencia_id" value={referenciaId} />
      {Array.from(checked).map((id) => (
        <input key={id} type="hidden" name="envasado_insumo_ids" value={id} />
      ))}

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

      <div className="flex flex-col gap-2">
        {insumos.map((insumo) => (
          <label key={insumo.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={checked.has(insumo.id)}
              onChange={() => toggle(insumo.id)}
            />
            {insumo.name}
          </label>
        ))}
        {insumos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin insumos de envasado en el catálogo todavía.
          </p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending || !referenciaId} className="self-start">
        {pending ? "Guardando..." : "Guardar receta"}
      </Button>
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
}: {
  insumos: EnvasadoInsumo[];
  referencias: EnvasadoReferencia[];
  referenciaInsumos: { referencia_id: string; envasado_insumo_id: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EnvasadoInsumo | null>(null);

  const recipeByReferencia = new Map<string, Set<string>>();
  for (const row of referenciaInsumos) {
    const set = recipeByReferencia.get(row.referencia_id) ?? new Set<string>();
    set.add(row.envasado_insumo_id);
    recipeByReferencia.set(row.referencia_id, set);
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
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
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
              <TableCell>{insumo.presentacion_caja ?? "—"}</TableCell>
              <TableCell>{insumo.marca ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={insumo.active ? "default" : "outline"}>
                  {insumo.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
          {insumos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
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
