"use client";

import { useState } from "react";
import { useActionState } from "react";
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
import { importEnvasadoProgram, type ImportActionState } from "./actions";

function ImportEnvasadoForm() {
  const [state, action, pending] = useActionState<ImportActionState, FormData>(
    importEnvasadoProgram,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="envasado-file">Archivo Excel (.xlsx)</Label>
        <input
          id="envasado-file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Tiene que tener las columnas de la plantilla: FECHA, Linea, SKU,
          Descripción, Und Programadas, Gramaje x UND. El producto se busca
          por el código (sku) ya cargado en Administración → Productos.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm font-medium text-primary">
          Se importaron {state.imported} órdenes de envasado correctamente.
        </p>
      )}
      {state.warnings && state.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">Filas que no se importaron:</p>
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

export function ImportEnvasadoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Upload className="size-4" />
            Importar Envasado
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar programa de Envasado desde Excel</DialogTitle>
          <DialogDescription>
            Crea o actualiza el programa semanal y sus órdenes de envasado a
            partir del formato de empaque.{" "}
            <a
              href="/programa/plantilla-envasado"
              className="font-medium text-primary underline underline-offset-2"
            >
              Descargar plantilla
            </a>
          </DialogDescription>
        </DialogHeader>
        <ImportEnvasadoForm />
      </DialogContent>
    </Dialog>
  );
}
