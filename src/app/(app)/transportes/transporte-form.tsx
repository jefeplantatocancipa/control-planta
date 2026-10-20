"use client";

import { useEffect, useRef } from "react";
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
import { solicitarTransporte, type ActionState } from "./actions";

const SI_NO = ["Si", "No"] as const;

export function TransporteForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    solicitarTransporte,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="area_solicitante">Área solicitante</Label>
          <Input id="area_solicitante" name="area_solicitante" placeholder="Ej: Bodega Chía" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descripcion">Descripción del objeto a transportar</Label>
          <Input id="descripcion" name="descripcion" placeholder="Ej: Canastillas" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input id="cantidad" name="cantidad" type="number" step="1" min="0" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="peso">Peso aprox. (kg)</Label>
          <Input id="peso" name="peso" type="number" step="0.1" min="0" required />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="requiere_refrigeracion_select">¿Requiere refrigeración?</Label>
        <Select
          name="requiere_refrigeracion"
          defaultValue="No"
          items={SI_NO.map((v) => ({ value: v, label: v === "Si" ? "Sí" : "No" }))}
        >
          <SelectTrigger id="requiere_refrigeracion_select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SI_NO.map((v) => (
              <SelectItem key={v} value={v}>
                {v === "Si" ? "Sí" : "No"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="origen">Origen</Label>
          <Input id="origen" name="origen" placeholder="Ej: Tocancipá" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="destino">Destino</Label>
          <Input id="destino" name="destino" placeholder="Ej: Chía" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha_requerida">Fecha requerida del traslado</Label>
          <Input id="fecha_requerida" name="fecha_requerida" type="date" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hora_requerida">Hora requerida del traslado</Label>
          <Input id="hora_requerida" name="hora_requerida" type="time" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quien_recibe">Quién recibe</Label>
          <Input id="quien_recibe" name="quien_recibe" placeholder="Nombre de quien recibe" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="urgencia_select">Urgencia</Label>
          <Select
            name="urgencia"
            defaultValue="No"
            items={SI_NO.map((v) => ({ value: v, label: v === "Si" ? "Sí" : "No" }))}
          >
            <SelectTrigger id="urgencia_select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SI_NO.map((v) => (
                <SelectItem key={v} value={v}>
                  {v === "Si" ? "Sí" : "No"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-600" role="status">
          Solicitud enviada por correo.
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar solicitud"}
      </Button>
    </form>
  );
}
