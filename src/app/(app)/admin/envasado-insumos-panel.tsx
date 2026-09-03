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
import { upsertEnvasadoInsumo, type ActionState } from "./actions";
import { ImportEnvasadoInsumosDialog } from "./import-envasado-insumos-dialog";
import type { Database } from "@/lib/supabase/types";

type EnvasadoInsumo = Database["public"]["Tables"]["envasado_insumos"]["Row"];

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

export function EnvasadoInsumosPanel({
  insumos,
}: {
  insumos: EnvasadoInsumo[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EnvasadoInsumo | null>(null);

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
