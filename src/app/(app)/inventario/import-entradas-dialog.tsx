"use client";

import { useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importInventarioEntradas, type ImportActionState } from "./actions";

function ImportEntradasForm() {
  const [state, action, pending] = useActionState<ImportActionState, FormData>(
    importInventarioEntradas,
    {},
    60000,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="entradas-file">Archivo Excel (.xlsx)</Label>
        <input
          id="entradas-file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Columnas: Código, Cantidad, Lote (opcional), Proveedor (opcional).
          El código tiene que existir en el catálogo -- importalo primero
          desde Administración si hace falta.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm font-medium text-primary">
          Se registraron {state.imported} entradas correctamente.
        </p>
      )}
      {state.warnings && state.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">Filas que no se registraron:</p>
          <ul className="list-inside list-disc">
            {state.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Importando..." : "Importar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ImportEntradasDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Upload className="size-4" />
            Importar entradas
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar ingreso de material desde Excel</DialogTitle>
          <DialogDescription>
            Registra varias entradas de stock de una vez (una compra grande,
            un cierre de inventario, etc.).
          </DialogDescription>
        </DialogHeader>
        <ImportEntradasForm />
      </DialogContent>
    </Dialog>
  );
}
