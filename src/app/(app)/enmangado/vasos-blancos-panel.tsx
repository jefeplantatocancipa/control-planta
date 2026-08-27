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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertVasoBlanco,
  createVasoBlancoEntrada,
  type ActionState,
} from "./actions";
import type { Database } from "@/lib/supabase/types";

type VasoBlanco = Database["public"]["Tables"]["vasos_blancos"]["Row"];

function VasoBlancoForm({
  vasoBlanco,
  onSuccess,
}: {
  vasoBlanco: VasoBlanco | null;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertVasoBlanco,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {vasoBlanco && <input type="hidden" name="id" value={vasoBlanco.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={vasoBlanco?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unit">Unidad</Label>
        <Input
          id="unit"
          name="unit"
          defaultValue={vasoBlanco?.unit ?? "unidades"}
          required
        />
      </div>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={vasoBlanco?.active ?? true}
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

function EntradaForm({
  vasosBlancos,
  onSuccess,
}: {
  vasosBlancos: VasoBlanco[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createVasoBlancoEntrada,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="vaso_blanco_id">Vaso blanco</Label>
        <Select name="vaso_blanco_id" required>
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="cantidad">Cantidad ingresada</Label>
        <Input
          id="cantidad"
          name="cantidad"
          type="number"
          step="1"
          min="0"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" name="notes" placeholder="Opcional" />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Registrar entrada"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function VasosBlancosPanel({
  vasosBlancos,
  stockByVaso,
  canManage,
}: {
  vasosBlancos: VasoBlanco[];
  stockByVaso: Map<string, number>;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<VasoBlanco | null>(null);
  const [entradaOpen, setEntradaOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
          <DialogTrigger render={<Button size="sm">Nueva entrada</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva entrada de stock</DialogTitle>
            </DialogHeader>
            <EntradaForm
              vasosBlancos={vasosBlancos}
              onSuccess={() => setEntradaOpen(false)}
            />
          </DialogContent>
        </Dialog>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setEditOpen(true);
            }}
          >
            Nuevo vaso blanco
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vasosBlancos.map((vaso) => (
            <TableRow key={vaso.id}>
              <TableCell className="font-medium">{vaso.name}</TableCell>
              <TableCell>
                {stockByVaso.get(vaso.id) ?? 0} {vaso.unit}
              </TableCell>
              <TableCell>
                <Badge variant={vaso.active ? "default" : "outline"}>
                  {vaso.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(vaso);
                      setEditOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {vasosBlancos.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin vasos blancos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar vaso blanco" : "Nuevo vaso blanco"}
            </DialogTitle>
          </DialogHeader>
          <VasoBlancoForm
            key={editing?.id ?? "new"}
            vasoBlanco={editing}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
