"use client";

import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import {
  iniciarEncajado,
  iniciarEstibaEncajado,
  finalizarEstibaEncajado,
  finalizarEncajado,
  deleteEncajado,
  type ActionState,
} from "./actions";
import { formatTime, formatDate, formatDateTime } from "@/lib/format-date";

export interface EstibaDisplay {
  id: string;
  inicioEstiba: string;
  finalEstiba: string | null;
  cajasPorEstiba: number | null;
}

export interface EncajadoDisplay {
  id: string;
  bacheLabel: string;
  presentacion: string;
  unidadesEnvasadas: number;
  fechaEnvasado: string | null;
  lote: string | null;
  startedAt: string | null;
  endedAt: string | null;
  estibas: EstibaDisplay[];
  canDelete?: boolean;
  canExecute?: boolean;
}

function IniciarEncajadoForm({ encajadoId }: { encajadoId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    iniciarEncajado,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={encajadoId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`lote-${encajadoId}`} className="text-xs font-normal text-muted-foreground">
          Lote
        </Label>
        <Input id={`lote-${encajadoId}`} name="lote" required />
      </div>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Iniciando..." : "Iniciar encajado"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function IniciarEstibaForm({ encajadoId }: { encajadoId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    iniciarEstibaEncajado,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="encajado_id" value={encajadoId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="self-start">
        {pending ? "Iniciando..." : "Iniciar estiba"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function FinalizarEstibaForm({ estibaId }: { estibaId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarEstibaEncajado,
    {},
  );

  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="estiba_id" value={estibaId} />
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-normal text-muted-foreground">
          Cajas de esta estiba
        </Label>
        <Input
          name="cajas_por_estiba"
          type="number"
          step="1"
          min="1"
          className="w-32"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando..." : "Finalizar estiba"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function FinalizarEncajadoForm({ encajadoId }: { encajadoId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarEncajado,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={encajadoId} />
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Finalizando..." : "Finalizar encajado"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function EstibasList({ estibas }: { estibas: EstibaDisplay[] }) {
  if (estibas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin estibas todavía.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 pr-3 font-normal">Inicio</th>
          <th className="py-1 pr-3 font-normal">Final</th>
          <th className="py-1 pr-3 font-normal">Cajas</th>
        </tr>
      </thead>
      <tbody>
        {estibas.map((e) => (
          <tr key={e.id} className="border-b last:border-0">
            <td className="py-1 pr-3">{formatTime(e.inicioEstiba)}</td>
            <td className="py-1 pr-3">
              {e.finalEstiba ? formatTime(e.finalEstiba) : "En curso"}
            </td>
            <td className="py-1 pr-3">{e.cajasPorEstiba ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EncajadoCard({
  id,
  bacheLabel,
  presentacion,
  unidadesEnvasadas,
  fechaEnvasado,
  lote,
  startedAt,
  endedAt,
  estibas,
  canDelete,
  canExecute = true,
}: EncajadoDisplay) {
  const estibaAbierta = estibas.find((e) => !e.finalEstiba);
  const totalCajas = estibas.reduce((sum, e) => sum + (e.cajasPorEstiba ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {bacheLabel} · {presentacion}
        </CardTitle>
        {canDelete && (
          <CardAction>
            <DeleteButton
              action={deleteEncajado}
              id={id}
              title="Eliminar encajado"
              description="Borra este encajado con sus estibas registradas."
            />
          </CardAction>
        )}
        <p className="text-sm text-muted-foreground">
          {unidadesEnvasadas} unidades envasadas
          {fechaEnvasado ? ` · ${formatDate(fechaEnvasado)}` : ""}
        </p>
        {lote && <p className="text-sm text-muted-foreground">Lote: {lote}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!startedAt && canExecute && <IniciarEncajadoForm encajadoId={id} />}

        {startedAt && (
          <>
            <p className="text-xs text-muted-foreground">
              Iniciado {formatDateTime(startedAt)}
              {endedAt && ` · Finalizado ${formatDateTime(endedAt)}`}
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-normal text-muted-foreground">Estibas</Label>
                {totalCajas > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: <span className="font-medium text-foreground">{totalCajas}</span> cajas
                  </p>
                )}
              </div>
              <EstibasList estibas={estibas} />
              {!endedAt &&
                canExecute &&
                (estibaAbierta ? (
                  <FinalizarEstibaForm estibaId={estibaAbierta.id} />
                ) : (
                  <IniciarEstibaForm encajadoId={id} />
                ))}
            </div>

            {!endedAt && canExecute && (
              <div className="flex flex-col items-end gap-1">
                <FinalizarEncajadoForm encajadoId={id} />
                {estibaAbierta && (
                  <p className="text-xs text-muted-foreground">
                    Finalizá la estiba en curso antes de cerrar el encajado.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
