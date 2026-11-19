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
import { importUsuarios, type ImportActionState } from "./actions";

function ImportUsuariosForm() {
  const [state, action, pending] = useActionState<ImportActionState, FormData>(
    importUsuarios,
    {},
    60000,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="usuarios-file">Archivo Excel (.xlsx)</Label>
        <input
          id="usuarios-file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Columnas: Nombre, Apellido, Rol. Si ya existe un usuario con ese
          nombre completo, se actualiza su rol y se reactiva en vez de
          duplicarse. Los nuevos quedan sin correo/contraseña de acceso real
          (como un operario) -- si necesitan iniciar sesión, editalos después
          para cambiarles la contraseña.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm font-medium text-primary">
          Se procesaron {state.imported} usuarios correctamente.
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

export function ImportUsuariosDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Upload className="size-4" />
            Carga masiva
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar usuarios desde Excel</DialogTitle>
          <DialogDescription>
            Crea o actualiza operarios y demás personal en lote.{" "}
            <a
              href="/admin/plantilla-usuarios"
              className="font-medium text-primary underline underline-offset-2"
            >
              Descargar plantilla
            </a>
          </DialogDescription>
        </DialogHeader>
        <ImportUsuariosForm />
      </DialogContent>
    </Dialog>
  );
}
