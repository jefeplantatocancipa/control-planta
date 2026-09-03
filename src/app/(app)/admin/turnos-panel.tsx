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
import { upsertTurno, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];

function TurnoForm({
  turno,
  onSuccess,
}: {
  turno: Turno | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertTurno,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {turno && <input type="hidden" name="id" value={turno.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={turno?.name} required />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="hora_inicio">Hora de inicio</Label>
          <Input
            id="hora_inicio"
            name="hora_inicio"
            type="time"
            defaultValue={turno?.hora_inicio}
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="hora_fin">Hora final</Label>
          <Input
            id="hora_fin"
            name="hora_fin"
            type="time"
            defaultValue={turno?.hora_fin}
            required
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Si la hora final es menor a la de inicio, se entiende que el turno
        cruza la medianoche (ej. 22:00 a 06:00).
      </p>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={turno?.active ?? true}
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

export function TurnosPanel({ turnos }: { turnos: Turno[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Turno | null>(null);

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
          Nuevo turno
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Hora inicio</TableHead>
            <TableHead>Hora final</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {turnos.map((turno) => (
            <TableRow key={turno.id}>
              <TableCell className="font-medium">{turno.name}</TableCell>
              <TableCell>{turno.hora_inicio}</TableCell>
              <TableCell>{turno.hora_fin}</TableCell>
              <TableCell>
                <Badge variant={turno.active ? "default" : "outline"}>
                  {turno.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(turno);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {turnos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin turnos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar turno" : "Nuevo turno"}</DialogTitle>
          </DialogHeader>
          <TurnoForm
            key={editing?.id ?? "new"}
            turno={editing}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
