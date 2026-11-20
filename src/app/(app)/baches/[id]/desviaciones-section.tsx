"use client";

import { useEffect, useRef, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/format-date";
import { DESVIACION_MOTIVO_LABELS } from "@/lib/desviacion-labels";
import { firmarDesviacion, type ActionState } from "../actions";
import type { FirmaDisplay } from "./stage-card";
import type { DesviacionMotivo } from "@/lib/supabase/types";

export interface DesviacionDisplay {
  id: string;
  tipo: "tiempo" | "receta";
  stageName: string;
  insumoNombre: string | null;
  valorReal: number;
  valorEsperado: number | null;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  motivo: DesviacionMotivo;
  descripcion: string;
  creadoPorNombre: string;
  createdAt: string;
  firma: FirmaDisplay | null;
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function FirmarDesviacionForm({
  desviacionId,
  bacheId,
  onSuccess,
}: {
  desviacionId: string;
  bacheId: string;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    firmarDesviacion,
    {},
  );
  const [observaciones, setObservaciones] = useState("");
  const [aprobado, setAprobado] = useState("true");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="desviacion_id" value={desviacionId} />
      <input type="hidden" name="bache_id" value={bacheId} />
      <input type="hidden" name="aprobado" value={aprobado} />
      <Input
        placeholder="Observaciones (opcional)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        name="observaciones"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            setAprobado("true");
            formRef.current?.requestSubmit();
          }}
        >
          Aprobar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            setAprobado("false");
            formRef.current?.requestSubmit();
          }}
        >
          Rechazar
        </Button>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function DesviacionFirma({
  desviacionId,
  bacheId,
  firma,
  canFirmar,
}: {
  desviacionId: string;
  bacheId: string;
  firma: FirmaDisplay | null;
  canFirmar: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (firma && !editing) {
    return (
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={firma.aprobado ? "secondary" : "destructive"}>
            {firma.aprobado ? "Aprobada por calidad" : "Rechazada por calidad"}
          </Badge>
          {canFirmar && (
            <button
              type="button"
              className="text-muted-foreground underline"
              onClick={() => setEditing(true)}
            >
              Corregir
            </button>
          )}
        </div>
        <p className="text-muted-foreground">
          {firma.firmadoPorNombre} · {formatTime(firma.firmadoAt)}
        </p>
        {firma.observaciones && <p>Obs: {firma.observaciones}</p>}
      </div>
    );
  }

  if (!canFirmar) {
    return <p className="text-xs text-muted-foreground">Pendiente de firma de calidad.</p>;
  }

  return (
    <FirmarDesviacionForm
      desviacionId={desviacionId}
      bacheId={bacheId}
      onSuccess={() => setEditing(false)}
    />
  );
}

export function DesviacionesSection({
  bacheId,
  desviaciones,
  canFirmar,
}: {
  bacheId: string;
  desviaciones: DesviacionDisplay[];
  canFirmar: boolean;
}) {
  if (desviaciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Desviaciones</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {desviaciones.map((d) => (
          <div
            key={d.id}
            className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {d.tipo === "tiempo" ? "Tiempo" : "Receta"} · {d.stageName}
                {d.insumoNombre ? ` · ${d.insumoNombre}` : ""}
              </span>
              <Badge variant="outline">{DESVIACION_MOTIVO_LABELS[d.motivo]}</Badge>
            </div>
            <p className="text-muted-foreground">
              {round(d.valorReal)} {d.tipo === "tiempo" ? "min" : "kg"}
              {d.valorEsperado != null
                ? ` (esperado ${round(d.valorEsperado)}${
                    d.limiteInferior != null && d.limiteSuperior != null
                      ? `, rango ${round(d.limiteInferior)}–${round(d.limiteSuperior)}`
                      : ""
                  })`
                : ""}
            </p>
            <p>{d.descripcion}</p>
            <p className="text-xs text-muted-foreground">
              {d.creadoPorNombre} · {formatTime(d.createdAt)}
            </p>
            <DesviacionFirma
              desviacionId={d.id}
              bacheId={bacheId}
              firma={d.firma}
              canFirmar={canFirmar}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
