"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { finalizarEnvasado, type ActionState } from "./actions";
import { TurnoPanel, type CorteDisplay } from "./turno-panel";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type { CorteDisplay, LecturaDisplay, EstibaDisplay } from "./turno-panel";

function FinalizarEnvasadoForm({
  recordId,
  onSuccess,
}: {
  recordId: string;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarEnvasado,
    {},
  );
  const [bacheTerminado, setBacheTerminado] = useState("true");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="record_id" value={recordId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="bache_terminado">¿Se terminó de envasar este bache?</Label>
        <select
          id="bache_terminado"
          name="bache_terminado"
          value={bacheTerminado}
          onChange={(e) => setBacheTerminado(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="true">Sí, no queda producto</option>
          <option value="false">No, queda producto sin envasar</option>
        </select>
      </div>

      {bacheTerminado === "false" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="volumen_restante">Cantidad restante (L)</Label>
          <Input
            id="volumen_restante"
            name="volumen_restante"
            type="number"
            step="0.01"
            min="0"
            placeholder="Opcional"
          />
          <p className="text-xs text-muted-foreground">
            El bache sigue apareciendo para elegir en un próximo envasado.
          </p>
        </div>
      )}

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Finalizando..." : "Finalizar envasado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FinalizarEnvasadoDialog({
  recordId,
  disabled,
}: {
  recordId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={disabled}>Finalizar envasado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar envasado</DialogTitle>
        </DialogHeader>
        <FinalizarEnvasadoForm recordId={recordId} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EnvasadoCard({
  recordId,
  bacheLabel,
  presentacion,
  operarioName,
  massBalanceKg,
  turnos,
  operarios,
  cortes,
}: {
  recordId: string;
  bacheLabel: string;
  presentacion: string;
  operarioName: string;
  massBalanceKg?: number;
  turnos: Turno[];
  operarios: Profile[];
  cortes: CorteDisplay[];
}) {
  const cortesCerrados = cortes.filter((c) => c.endedAt);
  const hayTurnoActivo = cortes.some((c) => !c.endedAt);
  // Las unidades envasadas son la suma de lo que dio cada estiba (dato
  // real, contado), no la resta de los contadores de inicio/final del
  // turno (que son solo una referencia).
  const totalUnidades = cortes.reduce(
    (sum, c) =>
      sum + c.estibas.reduce((s2, e) => s2 + (e.unidadesPorEstiba ?? 0), 0),
    0,
  );
  const totalDesperdicio = cortesCerrados.reduce((sum, c) => sum + (c.desperdicio ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {bacheLabel} · {presentacion}
        </CardTitle>
        <CardAction>
          <Link
            href={`/envasado/${recordId}/imprimir`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            title="Imprimir informe"
          >
            <Printer className="size-4" />
          </Link>
        </CardAction>
        <p className="text-sm text-muted-foreground">{operarioName}</p>
        {massBalanceKg !== undefined && (
          <p className="text-sm text-muted-foreground">
            Insumos alistados: <span className="font-medium">{massBalanceKg} kg</span>{" "}
            (referencia para calcular mermas)
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Unidades: <span className="font-semibold text-foreground">{totalUnidades}</span>
              {" · "}
              Desperdicio:{" "}
              <span className="font-semibold text-foreground">{totalDesperdicio}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Suma de los turnos ya finalizados.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <FinalizarEnvasadoDialog recordId={recordId} disabled={hayTurnoActivo} />
            {hayTurnoActivo && (
              <p className="text-xs text-muted-foreground">
                Finalizá el turno activo antes de cerrar el envasado.
              </p>
            )}
          </div>
        </div>

        <TurnoPanel
          envasadoId={recordId}
          turnos={turnos}
          operarios={operarios}
          cortes={cortes}
        />
      </CardContent>
    </Card>
  );
}
