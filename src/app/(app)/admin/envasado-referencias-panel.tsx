"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { upsertEnvasadoReferencia, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Referencia = Database["public"]["Tables"]["envasado_referencias"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

function ReferenciaForm({
  referencia,
  products,
  onSuccess,
}: {
  referencia: Referencia | null;
  products: Product[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertEnvasadoReferencia,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {referencia && <input type="hidden" name="id" value={referencia.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="sku">Referencia (SKU)</Label>
        <Input id="sku" name="sku" defaultValue={referencia?.sku} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={referencia?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="product_id">Producto (bache)</Label>
        <Select
          name="product_id"
          defaultValue={referencia?.product_id}
          required
          items={products.map((product) => ({
            value: product.id,
            label: product.name,
          }))}
        >
          <SelectTrigger id="product_id" className="w-full">
            <SelectValue placeholder="Elegí un producto" />
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
        <Label htmlFor="peso_unitario">Peso unitario (g)</Label>
        <Input
          id="peso_unitario"
          name="peso_unitario"
          type="number"
          step="0.01"
          min="0"
          defaultValue={referencia?.peso_unitario}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="multiempaque">Multiempaque (unidades por caja)</Label>
        <Input
          id="multiempaque"
          name="multiempaque"
          type="number"
          step="1"
          min="1"
          defaultValue={referencia?.multiempaque ?? 1}
          required
        />
      </div>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={referencia?.active ?? true}
          className="size-4"
        />
        Activa
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

export function EnvasadoReferenciasPanel({
  referencias,
  products,
}: {
  referencias: Referencia[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Referencia | null>(null);
  const productNames = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Nueva referencia
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referencia (SKU)</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Peso unitario</TableHead>
            <TableHead>Multiempaque</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {referencias.map((referencia) => (
            <TableRow key={referencia.id}>
              <TableCell className="font-medium">{referencia.sku}</TableCell>
              <TableCell>{referencia.name}</TableCell>
              <TableCell>{productNames.get(referencia.product_id) ?? "—"}</TableCell>
              <TableCell>{referencia.peso_unitario} g</TableCell>
              <TableCell>{referencia.multiempaque}</TableCell>
              <TableCell>
                <Badge variant={referencia.active ? "default" : "outline"}>
                  {referencia.active ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(referencia);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {referencias.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Sin referencias todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar referencia" : "Nueva referencia"}
            </DialogTitle>
          </DialogHeader>
          <ReferenciaForm
            key={editing?.id ?? "new"}
            referencia={editing}
            products={products}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
