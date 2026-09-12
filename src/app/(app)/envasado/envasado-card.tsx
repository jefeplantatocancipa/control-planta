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
import { DeleteButton } from "@/components/delete-button";
import {
  finalizarEnvasado,
  deleteEnvasado,
  iniciarParada,
  finalizarParada,
  type ActionState,
} from "./actions";
import { TurnoPanel, type CorteDisplay } from "./turno-panel";
import { formatDateTime } from "@/lib/format-date";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type { CorteDisplay, LecturaDisplay, EstibaDisplay } from "./turno-panel";

export interface ParadaDisplay {
  id: string;
  motivo: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface InsumoUsoDisplay {
  id: string;
  nombre: string;
  inventarioInicial: number | null;
}

function FinalizarEnvasadoForm({
  recordId,
  insumosUso,
  onSuccess,
}: {
  recordId: string;
  insumosUso: InsumoUsoDisplay[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarEnvasado,
    {},
  );
  const [bacheTerminado, setBacheTerminado] = useState("true");
  const [inventariosFinales, setInventariosFinales] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  const faltanInventarios = insumosUso.some((i) => !inventariosFinales[i.id]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="record_id" value={recordId} />
      <input
        type="hidden"
        name="insumos_final"
        value={JSON.stringify(
          insumosUso
            .filter((i) => inventariosFinales[i.id])
            .map((i) => ({ id: i.id, inventario_final: inventariosFinales[i.id] })),
        )}
      />

      {insumosUso.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Inventario final de insumos</Label>
          {insumosUso.map((insumo) => (
            <div key={insumo.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">{insumo.nombre}</p>
                {insumo.inventarioInicial !== null && (
                  <p className="text-xs text-muted-foreground">
                    Inventario inicial: {insumo.inventarioInicial}
                  </p>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="w-28"
                value={inventariosFinales[insumo.id] ?? ""}
                onChange={(e) =>
                  setInventariosFinales((v) => ({ ...v, [insumo.id]: e.target.value }))
                }
                required
              />
            </div>
          ))}
        </div>
      )}

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
        <Button type="submit" disabled={pending || faltanInventarios}>
          {pending ? "Finalizando..." : "Finalizar envasado"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FinalizarEnvasadoDialog({
  recordId,
  insumosUso,
  disabled,
}: {
  recordId: string;
  insumosUso: InsumoUsoDisplay[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={disabled}>Finalizar envasado</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar envasado</DialogTitle>
        </DialogHeader>
        <FinalizarEnvasadoForm
          recordId={recordId}
          insumosUso={insumosUso}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function IniciarParadaForm({
  envasadoId,
  onSuccess,
}: {
  envasadoId: string;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    iniciarParada,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="envasado_id" value={envasadoId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`motivo-${envasadoId}`}>Motivo</Label>
        <Input
          id={`motivo-${envasadoId}`}
          name="motivo"
          placeholder="Ej: sin actividad, falla, cambio de referencia, descanso (opcional)"
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar parada"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function IniciarParadaDialog({ envasadoId }: { envasadoId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Registrar parada
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar parada</DialogTitle>
        </DialogHeader>
        <IniciarParadaForm envasadoId={envasadoId} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function FinalizarParadaForm({ paradaId }: { paradaId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarParada,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={paradaId} />
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Finalizando..." : "Finalizar parada"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ParadasSection({
  envasadoId,
  paradas,
}: {
  envasadoId: string;
  paradas: ParadaDisplay[];
}) {
  const paradaAbierta = paradas.find((p) => !p.endedAt);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Paradas de la línea</h3>
          <p className="text-xs text-muted-foreground">
            Tiempo sin envasar: falla, cambio de referencia, descanso, entre
            turnos, etc.
          </p>
        </div>
        {!paradaAbierta && <IniciarParadaDialog envasadoId={envasadoId} />}
      </div>
      {paradaAbierta && (
        <p className="text-sm font-medium text-destructive">
          Línea parada desde {formatDateTime(paradaAbierta.startedAt)}
          {paradaAbierta.motivo ? ` — ${paradaAbierta.motivo}` : ""}
        </p>
      )}
      {paradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin paradas registradas.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-3 font-normal">Inicio</th>
              <th className="py-1 pr-3 font-normal">Final</th>
              <th className="py-1 pr-3 font-normal">Duración</th>
              <th className="py-1 pr-3 font-normal">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {paradas.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-1 pr-3">{formatDateTime(p.startedAt)}</td>
                <td className="py-1 pr-3">
                  {p.endedAt ? formatDateTime(p.endedAt) : "En curso"}
                </td>
                <td className="py-1 pr-3">
                  {durationLabel(p.startedAt, p.endedAt ?? new Date().toISOString())}
                </td>
                <td className="py-1 pr-3">{p.motivo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {paradaAbierta && <FinalizarParadaForm paradaId={paradaAbierta.id} />}
    </div>
  );
}

export function EnvasadoCard({
  recordId,
  bacheLabel,
  presentacion,
  lote,
  operarioName,
  massBalanceKg,
  turnos,
  operarios,
  cortes,
  paradas,
  insumosUso,
  canDelete,
}: {
  recordId: string;
  bacheLabel: string;
  presentacion: string;
  lote: string | null;
  operarioName: string;
  massBalanceKg?: number;
  turnos: Turno[];
  operarios: Profile[];
  cortes: CorteDisplay[];
  paradas: ParadaDisplay[];
  insumosUso: InsumoUsoDisplay[];
  canDelete?: boolean;
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
        <CardTitle className="text-base">{bacheLabel}</CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            <Link
              href={`/envasado/${recordId}/imprimir`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              title="Imprimir informe"
            >
              <Printer className="size-4" />
            </Link>
            {canDelete && (
              <DeleteButton
                action={deleteEnvasado}
                id={recordId}
                title="Eliminar envasado"
                description="Borra este envasado con todos sus turnos, lecturas, estibas y su encajado."
              />
            )}
          </div>
        </CardAction>
        <p className="text-sm text-muted-foreground">{presentacion}</p>
        <p className="text-sm text-muted-foreground">
          {operarioName}
          {lote ? ` · Lote ${lote}` : ""}
        </p>
        {massBalanceKg !== undefined && (
          <p className="text-sm text-muted-foreground">
            Insumos alistados: <span className="font-medium">{massBalanceKg} kg</span>{" "}
            (referencia para calcular mermas)
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Resumen del envasado</h3>
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
              <FinalizarEnvasadoDialog
                recordId={recordId}
                insumosUso={insumosUso}
                disabled={hayTurnoActivo}
              />
              {hayTurnoActivo && (
                <p className="text-xs text-muted-foreground">
                  Finalizá el turno activo antes de cerrar el envasado.
                </p>
              )}
            </div>
          </div>
        </div>

        <ParadasSection envasadoId={recordId} paradas={paradas} />

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
