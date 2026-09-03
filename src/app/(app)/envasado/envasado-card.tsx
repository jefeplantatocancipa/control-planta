"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { finalizarEnvasado, type ActionState } from "./actions";
import { TurnoPanel, type CorteDisplay } from "./turno-panel";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type { CorteDisplay, LecturaDisplay, EstibaDisplay } from "./turno-panel";

function FinalizarEnvasadoForm({
  recordId,
  disabled,
}: {
  recordId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarEnvasado,
    {},
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="record_id" value={recordId} />
      <Button type="submit" size="sm" disabled={pending || disabled}>
        {pending ? "Finalizando..." : "Finalizar envasado"}
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground">
          Finalizá el turno activo antes de cerrar el envasado.
        </p>
      )}
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
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
  const totalUnidades = cortesCerrados.reduce(
    (sum, c) => sum + ((c.unidadesFinal ?? c.unidadesInicio) - c.unidadesInicio),
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
          <FinalizarEnvasadoForm recordId={recordId} disabled={hayTurnoActivo} />
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
