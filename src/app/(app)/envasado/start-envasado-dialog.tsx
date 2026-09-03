"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { startEnvasado, type ActionState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface BacheOption {
  id: string;
  label: string;
}

function StartEnvasadoForm({
  baches,
  operarios,
  onSuccess,
}: {
  baches: BacheOption[];
  operarios: Profile[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startEnvasado,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="bache_id">Bache</Label>
        <Select
          name="bache_id"
          required
          items={baches.map((bache) => ({ value: bache.id, label: bache.label }))}
        >
          <SelectTrigger id="bache_id" className="w-full">
            <SelectValue placeholder="Elegí un bache" />
          </SelectTrigger>
          <SelectContent>
            {baches.map((bache) => (
              <SelectItem key={bache.id} value={bache.id}>
                {bache.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="presentacion">Presentación</Label>
        <Input
          id="presentacion"
          name="presentacion"
          placeholder="Ej: Sachet 1L"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="operario_id">Operario responsable</Label>
        <Select
          name="operario_id"
          required
          items={operarios.map((operario) => ({
            value: operario.id,
            label: operario.full_name,
          }))}
        >
          <SelectTrigger id="operario_id" className="w-full">
            <SelectValue placeholder="Elegí un operario" />
          </SelectTrigger>
          <SelectContent>
            {operarios.map((operario) => (
              <SelectItem key={operario.id} value={operario.id}>
                {operario.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Iniciando..." : "Iniciar envasado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StartEnvasadoDialog({
  baches,
  operarios,
}: {
  baches: BacheOption[];
  operarios: Profile[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Iniciar envasado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar envasado</DialogTitle>
        </DialogHeader>
        <StartEnvasadoForm
          baches={baches}
          operarios={operarios}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
