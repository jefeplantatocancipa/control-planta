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
  upsertInsumo,
  saveProductRecipe,
  type ActionState,
} from "./actions";
import type { Database } from "@/lib/supabase/types";

type Insumo = Database["public"]["Tables"]["insumos"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

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
  products,
  insumos,
  recipeByProduct,
}: {
  products: Product[];
  insumos: Insumo[];
  recipeByProduct: Map<string, Set<string>>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(
    new Set(recipeByProduct.get(products[0]?.id ?? "") ?? []),
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveProductRecipe,
    {},
  );

  function selectProduct(id: string) {
    setProductId(id);
    setChecked(new Set(recipeByProduct.get(id) ?? []));
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
      <input type="hidden" name="product_id" value={productId} />
      {Array.from(checked).map((id) => (
        <input key={id} type="hidden" name="insumo_ids" value={id} />
      ))}

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
            Sin insumos en el catálogo todavía.
          </p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending || !productId} className="self-start">
        {pending ? "Guardando..." : "Guardar receta"}
      </Button>
      {state.success && (
        <p className="text-sm text-muted-foreground">Receta guardada.</p>
      )}
    </form>
  );
}

export function InsumosPanel({
  insumos,
  products,
  productInsumos,
}: {
  insumos: Insumo[];
  products: Product[];
  productInsumos: { product_id: string; insumo_id: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);

  const recipeByProduct = new Map<string, Set<string>>();
  for (const row of productInsumos) {
    const set = recipeByProduct.get(row.product_id) ?? new Set<string>();
    set.add(row.insumo_id);
    recipeByProduct.set(row.product_id, set);
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((insumo) => (
              <TableRow key={insumo.id}>
                <TableCell className="font-medium">{insumo.name}</TableCell>
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
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin insumos todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-medium">Receta por producto</h3>
          <p className="text-sm text-muted-foreground">
            Los insumos marcados acá son los que aparecen para chequear en la
            etapa de alistamiento de insumos de cada bache.
          </p>
        </div>
        {products.length > 0 ? (
          <RecipeEditor
            products={products}
            insumos={insumos}
            recipeByProduct={recipeByProduct}
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
