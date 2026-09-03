"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveEnvasado, type ActionState } from "./actions";
import { CorteTurnoDialog } from "./corte-turno-dialog";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface CorteDisplay {
  id: string;
  turnoName: string;
  fecha: string;
  operarios: string;
  unidades: number;
  unidadesFinal: number;
  selladoCumple: boolean;
  loteMarcado: "C" | "NC";
  pesoPromedio: number | null;
  observaciones: string | null;
}

function CortesList({ cortes }: { cortes: CorteDisplay[] }) {
  if (cortes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin cortes de turno todavía.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {cortes.map((corte) => (
        <div key={corte.id} className="rounded-lg border p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">
              {corte.turnoName} · {corte.fecha}
            </p>
            <div className="flex gap-1">
              <Badge variant={corte.selladoCumple ? "default" : "destructive"}>
                Sellado {corte.selladoCumple ? "cumple" : "no cumple"}
              </Badge>
              <Badge variant={corte.loteMarcado === "C" ? "default" : "destructive"}>
                Lote {corte.loteMarcado}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground">{corte.operarios}</p>
          <p>
            {corte.unidades} unidades
            {corte.pesoPromedio !== null && ` · Peso prom. ${corte.pesoPromedio.toFixed(2)} g`}
          </p>
          {corte.observaciones && (
            <p className="text-muted-foreground">Obs: {corte.observaciones}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function EnvasadoCard({
  recordId,
  bacheLabel,
  presentacion,
  operarioName,
  cantidadUnidades,
  cantidadMermas,
  notes,
  massBalanceKg,
  turnos,
  operarios,
  cortes,
}: {
  recordId: string;
  bacheLabel: string;
  presentacion: string;
  operarioName: string;
  cantidadUnidades: number;
  cantidadMermas: number;
  notes: string | null;
  massBalanceKg?: number;
  turnos: Turno[];
  operarios: Profile[];
  cortes: CorteDisplay[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveEnvasado,
    {},
  );
  const ultimasUnidadesFinal =
    cortes.length > 0 ? cortes[cortes.length - 1].unidadesFinal : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {bacheLabel} · {presentacion}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{operarioName}</p>
        {massBalanceKg !== undefined && (
          <p className="text-sm text-muted-foreground">
            Insumos alistados: <span className="font-medium">{massBalanceKg} kg</span>{" "}
            (referencia para calcular mermas)
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="record_id" value={recordId} />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`unidades-${recordId}`}>Unidades (total)</Label>
              <Input
                id={`unidades-${recordId}`}
                name="cantidad_unidades"
                type="number"
                step="1"
                min="0"
                defaultValue={cantidadUnidades}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`mermas-${recordId}`}>Mermas (total)</Label>
              <Input
                id={`mermas-${recordId}`}
                name="cantidad_mermas"
                type="number"
                step="1"
                min="0"
                defaultValue={cantidadMermas}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`notes-${recordId}`}>Notas</Label>
            <Input
              id={`notes-${recordId}`}
              name="notes"
              defaultValue={notes ?? ""}
              placeholder="Opcional"
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              name="finalize"
              value="false"
              variant="outline"
              size="sm"
              disabled={pending}
            >
              Actualizar
            </Button>
            <Button
              type="submit"
              name="finalize"
              value="true"
              size="sm"
              disabled={pending}
            >
              Finalizar
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label>Cortes de turno</Label>
            <CorteTurnoDialog
              envasadoId={recordId}
              turnos={turnos}
              operarios={operarios}
              unidadesInicioSugeridas={ultimasUnidadesFinal}
            />
          </div>
          <CortesList cortes={cortes} />
        </div>
      </CardContent>
    </Card>
  );
}
