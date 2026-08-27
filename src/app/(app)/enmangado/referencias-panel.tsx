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
import { upsertReferencia, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Referencia = Database["public"]["Tables"]["enmangado_referencias"]["Row"];
type VasoBlanco = Database["public"]["Tables"]["vasos_blancos"]["Row"];

function ReferenciaForm({
  referencia,
  vasosBlancos,
  onSuccess,
}: {
  referencia: Referencia | null;
  vasosBlancos: VasoBlanco[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertReferencia,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {referencia && <input type="hidden" name="id" value={referencia.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código</Label>
        <Input id="code" name="code" defaultValue={referencia?.code} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={referencia?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="vaso_blanco_id">Vaso blanco que consume</Label>
        <Select name="vaso_blanco_id" defaultValue={referencia?.vaso_blanco_id} required>
          <SelectTrigger id="vaso_blanco_id" className="w-full">
            <SelectValue placeholder="Elegí un vaso blanco" />
          </SelectTrigger>
          <SelectContent>
            {vasosBlancos.map((vaso) => (
              <SelectItem key={vaso.id} value={vaso.id}>
                {vaso.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

export function ReferenciasPanel({
  referencias,
  vasosBlancos,
}: {
  referencias: Referencia[];
  vasosBlancos: VasoBlanco[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Referencia | null>(null);
  const vasoNames = new Map(vasosBlancos.map((v) => [v.id, v.name]));

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
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Vaso blanco</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {referencias.map((referencia) => (
            <TableRow key={referencia.id}>
              <TableCell className="font-medium">{referencia.code}</TableCell>
              <TableCell>{referencia.name}</TableCell>
              <TableCell>{vasoNames.get(referencia.vaso_blanco_id) ?? "—"}</TableCell>
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
              <TableCell colSpan={5} className="text-center text-muted-foreground">
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
            vasosBlancos={vasosBlancos}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
