"use client";

import { useEffect, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
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
import { upsertInventarioCategoria, type ActionState } from "./actions";
import type { Database, InventarioTablaDestino } from "@/lib/supabase/types";

type Categoria = Database["public"]["Tables"]["inventario_categorias"]["Row"];

const TABLA_DESTINO_LABELS: Record<InventarioTablaDestino, string> = {
  materia_prima: "Materia prima (recetas de bache)",
  empaque: "Material de empaque (recetas de envasado)",
  vaso_blanco: "Vaso blanco (enmangado)",
  generico: "Solo stock (sin receta)",
};

function CategoriaForm({
  categoria,
  onSuccess,
}: {
  categoria: Categoria | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertInventarioCategoria,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" defaultValue={categoria?.nombre} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tabla_destino">A dónde alimenta</Label>
        <Select
          name="tabla_destino"
          defaultValue={categoria?.tabla_destino ?? "generico"}
          items={TABLA_DESTINO_LABELS}
        >
          <SelectTrigger id="tabla_destino" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TABLA_DESTINO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Los insumos de esta categoría van a ese catálogo -- solo
          &quot;materia prima&quot;, &quot;empaque&quot; y &quot;vaso
          blanco&quot; aparecen para elegir en recetas.
        </p>
      </div>
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

export function InventarioCategoriasPanel({
  categorias,
  canWrite = true,
}: {
  categorias: Categoria[];
  canWrite?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Categorías de inventario</h3>
          <p className="text-sm text-muted-foreground">
            Las categorías con destino distinto de &quot;Solo stock&quot; son las que
            aparecen para elegir en las recetas de bache/envasado.
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
            Nueva categoría
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.map((categoria) => (
            <TableRow key={categoria.id}>
              <TableCell className="font-medium">{categoria.nombre}</TableCell>
              <TableCell>
                <Badge variant="outline">{TABLA_DESTINO_LABELS[categoria.tabla_destino]}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(categoria);
                      setOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {categorias.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin categorías todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <CategoriaForm
            key={editing?.id ?? "new"}
            categoria={editing}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
