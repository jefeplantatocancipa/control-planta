"use client";

import { useEffect, useRef, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearEntradaBitacora, type ActionState } from "./actions";
import { NONE_VALUE } from "./constants";

const TIPOS = ["lavado", "novedad"] as const;
const TIPO_LABELS: Record<(typeof TIPOS)[number], string> = {
  lavado: "Lavado",
  novedad: "Novedad",
};

export function BitacoraForm({
  turnos,
  equipos,
}: {
  turnos: { id: string; name: string }[];
  equipos: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    crearEntradaBitacora,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("novedad");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tipo" value={tipo} />

      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={tipo === t ? "default" : "outline"}
            onClick={() => setTipo(t)}
          >
            {TIPO_LABELS[t]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="turno_select" className="text-xs font-normal text-muted-foreground">
            Turno (opcional)
          </Label>
          <Select
            name="turno_id"
            defaultValue={NONE_VALUE}
            items={[
              { value: NONE_VALUE, label: "Sin turno" },
              ...turnos.map((t) => ({ value: t.id, label: t.name })),
            ]}
          >
            <SelectTrigger id="turno_select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sin turno</SelectItem>
              {turnos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipo === "lavado" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="equipo_select" className="text-xs font-normal text-muted-foreground">
              Equipo (opcional)
            </Label>
            <Select
              name="equipo_id"
              defaultValue={NONE_VALUE}
              items={[
                { value: NONE_VALUE, label: "Sin equipo puntual" },
                ...equipos.map((e) => ({ value: e.id, label: e.name })),
              ]}
            >
              <SelectTrigger id="equipo_select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sin equipo puntual</SelectItem>
                {equipos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="texto" className="text-xs font-normal text-muted-foreground">
          {tipo === "lavado" ? "Qué se lavó / detalle" : "Qué pasó"}
        </Label>
        <Input
          id="texto"
          name="texto"
          placeholder={tipo === "lavado" ? "Ej: Lavado de tanque 2, CIP completo" : "Ej: Falló la selladora en el turno B"}
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Agregar entrada"}
      </Button>
    </form>
  );
}
