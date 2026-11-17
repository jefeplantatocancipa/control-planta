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
import { solicitarTransporte, type ActionState } from "./actions";
import { AREAS, URGENCIA, SI_NO } from "./constants";

function hoyISO() {
  return new Date().toLocaleDateString("en-CA");
}
function horaAhora() {
  return new Date().toTimeString().slice(0, 5);
}

export function TransporteForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    solicitarTransporte,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Fecha/hora de solicitud por defecto son "ahora", pero el campo queda
  // editable (igual que en la planilla original) -- useState con lazy
  // initializer para que el valor se fije una sola vez al montar, no en
  // cada render.
  const [fechaSolicitud] = useState(hoyISO);
  const [horaSolicitud] = useState(horaAhora);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha_solicitud">Fecha de solicitud</Label>
          <Input
            id="fecha_solicitud"
            name="fecha_solicitud"
            type="date"
            defaultValue={fechaSolicitud}
            min={fechaSolicitud}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hora_solicitud">Hora de solicitud</Label>
          <Input
            id="hora_solicitud"
            name="hora_solicitud"
            type="time"
            defaultValue={horaSolicitud}
            min="07:00"
            max="17:00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="area_solicitante_select">Área solicitante</Label>
          <Select name="area_solicitante" required items={AREAS.map((a) => ({ value: a, label: a }))}>
            <SelectTrigger id="area_solicitante_select" className="w-full">
              <SelectValue placeholder="Elegí un área" />
            </SelectTrigger>
            <SelectContent>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descripcion">Descripción del objeto a transportar</Label>
          <Input id="descripcion" name="descripcion" placeholder="Ej: Canastillas" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input id="cantidad" name="cantidad" type="number" step="1" min="1" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="peso">Peso aprox. (kg)</Label>
          <Input id="peso" name="peso" type="number" step="1" min="1" placeholder="Opcional" />
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
          <Input id="origen" name="origen" placeholder="Ej: Tocancipá" list="sedes" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="destino">Destino</Label>
          <Input id="destino" name="destino" placeholder="Ej: Chía" list="sedes" required />
        </div>
        <datalist id="sedes">
          <option value="Tocancipá" />
          <option value="Chía" />
          <option value="Guasca" />
        </datalist>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha_requerida">Fecha requerida del traslado</Label>
          <Input
            id="fecha_requerida"
            name="fecha_requerida"
            type="date"
            min={fechaSolicitud}
            defaultValue={fechaSolicitud}
            required
          />
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
            defaultValue="No Urgente"
            items={URGENCIA.map((v) => ({ value: v, label: v }))}
          >
            <SelectTrigger id="urgencia_select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {URGENCIA.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
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
          Solicitud guardada y enviada por correo.
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar solicitud"}
      </Button>
    </form>
  );
}
