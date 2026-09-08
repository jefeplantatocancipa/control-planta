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
import { upsertTanque, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Tanque = Database["public"]["Tables"]["tanques"]["Row"];

function TanqueForm({
  tanque,
  onSuccess,
}: {
  tanque: Tanque | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertTanque,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {tanque && <input type="hidden" name="id" value={tanque.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={tanque?.name} required />
      </div>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={tanque?.active ?? true}
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

export function TanquesPanel({ tanques }: { tanques: Tanque[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tanque | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Tanques</h3>
          <p className="text-sm text-muted-foreground">
            Se usan para elegir el tanque en la captura de etapas del bache
            (parámetro de tipo &quot;Tanque&quot;).
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Nuevo tanque
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
          {tanques.map((tanque) => (
            <TableRow key={tanque.id}>
              <TableCell className="font-medium">{tanque.name}</TableCell>
              <TableCell>
                <Badge variant={tanque.active ? "default" : "outline"}>
                  {tanque.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(tanque);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tanques.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin tanques todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tanque" : "Nuevo tanque"}</DialogTitle>
          </DialogHeader>
          <TanqueForm
            key={editing?.id ?? "new"}
            tanque={editing}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
