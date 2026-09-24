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
import { DeleteButton } from "@/components/delete-button";
import { upsertEquipo, deleteEquipo, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Equipo = Database["public"]["Tables"]["equipos"]["Row"];

function EquipoForm({
  equipo,
  onSuccess,
}: {
  equipo: Equipo | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertEquipo,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {equipo && <input type="hidden" name="id" value={equipo.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ej: Tanque mezcla, Pasteurizador 1"
          defaultValue={equipo?.name}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo">Tipo</Label>
        <Input
          id="tipo"
          name="tipo"
          placeholder="Ej: tanque, pasteurizador, homogeneizador"
          defaultValue={equipo?.tipo ?? "tanque"}
          required
        />
        <p className="text-xs text-muted-foreground">
          Se usa para filtrar qué equipos ofrecer en cada etapa (ej. una
          etapa de pasteurización solo ofrece equipos tipo
          &quot;pasteurizador&quot;).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="capacidad">Capacidad</Label>
          <Input
            id="capacidad"
            name="capacidad"
            type="number"
            step="0.01"
            min="0"
            defaultValue={equipo?.capacidad ?? ""}
            placeholder="Opcional"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="unidad">Unidad</Label>
          <Input id="unidad" name="unidad" defaultValue={equipo?.unidad ?? "L"} required />
        </div>
      </div>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={equipo?.active ?? true}
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

export function EquiposPanel({
  equipos,
  canWrite = true,
}: {
  equipos: Equipo[];
  canWrite?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Equipos</h3>
          <p className="text-sm text-muted-foreground">
            Tanques, pasteurizadores, homogeneizadores y demás equipos de
            proceso. Se eligen al iniciar una etapa que los requiera, y son
            la base del diagrama de ocupación.
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
            Nuevo equipo
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Capacidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipos.map((equipo) => (
            <TableRow key={equipo.id}>
              <TableCell className="font-medium">{equipo.name}</TableCell>
              <TableCell className="text-muted-foreground">{equipo.tipo}</TableCell>
              <TableCell className="text-muted-foreground">
                {equipo.capacidad != null ? `${equipo.capacidad} ${equipo.unidad}` : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={equipo.active ? "default" : "outline"}>
                  {equipo.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {canWrite && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(equipo);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <DeleteButton
                      action={deleteEquipo}
                      id={equipo.id}
                      title="Eliminar equipo"
                      description={`Borra "${equipo.name}" del catálogo. Si ya está usado en alguna etapa registrada, no se va a poder eliminar -- marcalo como inactivo en su lugar.`}
                    />
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {equipos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin equipos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          </DialogHeader>
          <EquipoForm
            key={editing?.id ?? "new"}
            equipo={editing}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
