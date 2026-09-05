"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  iniciarCorteTurno,
  finalizarCorteTurno,
  addCalidadLectura,
  iniciarEstiba,
  finalizarEstiba,
  type ActionState,
} from "./actions";
import { NO_ORDER_VALUE } from "./constants";
import { formatTime } from "@/lib/format-date";
import type { Database } from "@/lib/supabase/types";

type Turno = Database["public"]["Tables"]["turnos"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface LecturaDisplay {
  id: string;
  timestamp: string;
  pesoPromedio: number | null;
  selladoCumple: boolean;
  fechadoCumple: boolean;
  observaciones: string | null;
}

export interface EstibaDisplay {
  id: string;
  inicioEstiba: string;
  finalEstiba: string | null;
  unidadesPorEstiba: number | null;
}

export interface CorteDisplay {
  id: string;
  turnoName: string;
  operarios: string;
  startedAt: string;
  endedAt: string | null;
  unidadesInicio: number;
  unidadesFinal: number | null;
  desperdicio: number | null;
  observaciones: string | null;
  lecturas: LecturaDisplay[];
  estibas: EstibaDisplay[];
}

// ---------------------------------------------------------------------------
// Iniciar turno
// ---------------------------------------------------------------------------
function IniciarTurnoForm({
  envasadoId,
  turnos,
  operarios,
  onSuccess,
}: {
  envasadoId: string;
  turnos: Turno[];
  operarios: Profile[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    iniciarCorteTurno,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="envasado_id" value={envasadoId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="turno_id">Turno</Label>
        <Select
          name="turno_id"
          required
          items={turnos.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.hora_inicio}–${t.hora_fin})`,
          }))}
        >
          <SelectTrigger id="turno_id" className="w-full">
            <SelectValue placeholder="Elegí un turno" />
          </SelectTrigger>
          <SelectContent>
            {turnos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.hora_inicio}–{t.hora_fin})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="operario_id">Operario 1</Label>
          <Select
            name="operario_id"
            required
            items={operarios.map((o) => ({ value: o.id, label: o.full_name }))}
          >
            <SelectTrigger id="operario_id" className="w-full">
              <SelectValue placeholder="Elegí" />
            </SelectTrigger>
            <SelectContent>
              {operarios.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="operario_2_id">Operario 2</Label>
          <Select
            name="operario_2_id"
            defaultValue={NO_ORDER_VALUE}
            items={[
              { value: NO_ORDER_VALUE, label: "—" },
              ...operarios.map((o) => ({ value: o.id, label: o.full_name })),
            ]}
          >
            <SelectTrigger id="operario_2_id" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORDER_VALUE}>—</SelectItem>
              {operarios.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="unidades_inicio">Unidades al inicio</Label>
        <Input
          id="unidades_inicio"
          name="unidades_inicio"
          type="number"
          step="1"
          min="0"
          defaultValue={0}
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Iniciar turno"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function IniciarTurnoDialog({
  envasadoId,
  turnos,
  operarios,
}: {
  envasadoId: string;
  turnos: Turno[];
  operarios: Profile[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Iniciar turno
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar turno</DialogTitle>
        </DialogHeader>
        <IniciarTurnoForm
          envasadoId={envasadoId}
          turnos={turnos}
          operarios={operarios}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Lecturas de calidad (peso neto, sellado, fechado) — cada hora
// ---------------------------------------------------------------------------
function LecturaCalidadSubmitForm({
  corteId,
  peso1,
  peso2,
  peso3,
  selladoCumple,
  fechadoCumple,
  observaciones,
  onSuccess,
}: {
  corteId: string;
  peso1: string;
  peso2: string;
  peso3: string;
  selladoCumple: string;
  fechadoCumple: string;
  observaciones: string;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addCalidadLectura,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="corte_id" value={corteId} />
      <input type="hidden" name="peso_1" value={peso1} />
      <input type="hidden" name="peso_2" value={peso2} />
      <input type="hidden" name="peso_3" value={peso3} />
      <input type="hidden" name="sellado_cumple" value={selladoCumple} />
      <input type="hidden" name="fechado_cumple" value={fechadoCumple} />
      <input type="hidden" name="observaciones" value={observaciones} />
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Agregar lectura"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function LecturaCalidadForm({ corteId }: { corteId: string }) {
  const [peso1, setPeso1] = useState("");
  const [peso2, setPeso2] = useState("");
  const [peso3, setPeso3] = useState("");
  const [selladoCumple, setSelladoCumple] = useState("true");
  const [fechadoCumple, setFechadoCumple] = useState("true");
  const [observaciones, setObservaciones] = useState("");
  const [formKey, setFormKey] = useState(0);

  const pesos = [peso1, peso2, peso3].map(Number).filter((n) => n > 0);
  const promedio = pesos.length === 3 ? (pesos[0] + pesos[1] + pesos[2]) / 3 : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <Label className="text-xs font-normal text-muted-foreground">
        Nueva lectura de calidad
      </Label>
      <div className="grid grid-cols-3 gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Peso 1"
          value={peso1}
          onChange={(e) => setPeso1(e.target.value)}
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Peso 2"
          value={peso2}
          onChange={(e) => setPeso2(e.target.value)}
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Peso 3"
          value={peso3}
          onChange={(e) => setPeso3(e.target.value)}
        />
      </div>
      {promedio !== null && (
        <p className="text-sm font-medium">Promedio: {promedio.toFixed(2)} g</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={selladoCumple}
          onChange={(e) => setSelladoCumple(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="true">Sellado: Cumple</option>
          <option value="false">Sellado: No cumple</option>
        </select>
        <select
          value={fechadoCumple}
          onChange={(e) => setFechadoCumple(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="true">Fechado: Cumple</option>
          <option value="false">Fechado: No cumple</option>
        </select>
      </div>
      <Input
        placeholder="Observaciones (opcional)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
      />
      <LecturaCalidadSubmitForm
        key={formKey}
        corteId={corteId}
        peso1={peso1}
        peso2={peso2}
        peso3={peso3}
        selladoCumple={selladoCumple}
        fechadoCumple={fechadoCumple}
        observaciones={observaciones}
        onSuccess={() => {
          setPeso1("");
          setPeso2("");
          setPeso3("");
          setSelladoCumple("true");
          setFechadoCumple("true");
          setObservaciones("");
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function LecturasList({ lecturas }: { lecturas: LecturaDisplay[] }) {
  if (lecturas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin lecturas todavía.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Hora</th>
            <th className="py-1 pr-3 font-normal">Peso prom.</th>
            <th className="py-1 pr-3 font-normal">Sellado</th>
            <th className="py-1 pr-3 font-normal">Fechado</th>
          </tr>
        </thead>
        <tbody>
          {lecturas.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="py-1 pr-3">{formatTime(l.timestamp)}</td>
              <td className="py-1 pr-3">
                {l.pesoPromedio !== null ? `${l.pesoPromedio.toFixed(2)} g` : "—"}
              </td>
              <td className="py-1 pr-3">
                <Badge variant={l.selladoCumple ? "default" : "destructive"}>
                  {l.selladoCumple ? "Cumple" : "No cumple"}
                </Badge>
              </td>
              <td className="py-1 pr-3">
                <Badge variant={l.fechadoCumple ? "default" : "destructive"}>
                  {l.fechadoCumple ? "Cumple" : "No cumple"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estibas: solo una abierta a la vez por turno
// ---------------------------------------------------------------------------
function IniciarEstibaForm({ corteId }: { corteId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    iniciarEstiba,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="corte_id" value={corteId} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="self-start"
      >
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
    finalizarEstiba,
    {},
  );

  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="estiba_id" value={estibaId} />
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-normal text-muted-foreground">
          Unidades de esta estiba
        </Label>
        <Input
          name="unidades_por_estiba"
          type="number"
          step="1"
          min="0"
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

function EstibasList({ estibas }: { estibas: EstibaDisplay[] }) {
  if (estibas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin estibas todavía.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Inicio</th>
            <th className="py-1 pr-3 font-normal">Final</th>
            <th className="py-1 pr-3 font-normal">Unidades</th>
          </tr>
        </thead>
        <tbody>
          {estibas.map((e) => (
            <tr key={e.id} className="border-b last:border-0">
              <td className="py-1 pr-3">{formatTime(e.inicioEstiba)}</td>
              <td className="py-1 pr-3">
                {e.finalEstiba ? formatTime(e.finalEstiba) : "En curso"}
              </td>
              <td className="py-1 pr-3">{e.unidadesPorEstiba ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finalizar turno
// ---------------------------------------------------------------------------
function FinalizarTurnoForm({
  corteId,
  unidadesInicio,
  totalUnidadesEstibas,
  onSuccess,
}: {
  corteId: string;
  unidadesInicio: number;
  totalUnidadesEstibas: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finalizarCorteTurno,
    {},
  );
  const unidadesFinal = unidadesInicio + totalUnidadesEstibas;

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="corte_id" value={corteId} />
      <input type="hidden" name="unidades_inicio" value={unidadesInicio} />
      <input type="hidden" name="unidades_final" value={unidadesFinal} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="unidades_final">Unidades al final</Label>
        <Input
          id="unidades_final"
          type="number"
          value={unidadesFinal}
          readOnly
          disabled
        />
        <p className="text-xs text-muted-foreground">
          Suma de las unidades reportadas en las estibas del turno.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="desperdicio">Desperdicio</Label>
        <Input
          id="desperdicio"
          name="desperdicio"
          type="number"
          step="0.01"
          min="0"
          placeholder="Opcional"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Input id="observaciones" name="observaciones" placeholder="Opcional" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Finalizar turno"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FinalizarTurnoDialog({
  corteId,
  unidadesInicio,
  totalUnidadesEstibas,
}: {
  corteId: string;
  unidadesInicio: number;
  totalUnidadesEstibas: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Finalizar turno</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar turno</DialogTitle>
        </DialogHeader>
        <FinalizarTurnoForm
          corteId={corteId}
          unidadesInicio={unidadesInicio}
          totalUnidadesEstibas={totalUnidadesEstibas}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Panel principal
// ---------------------------------------------------------------------------
export function TurnoPanel({
  envasadoId,
  turnos,
  operarios,
  cortes,
}: {
  envasadoId: string;
  turnos: Turno[];
  operarios: Profile[];
  cortes: CorteDisplay[];
}) {
  const activo = cortes.find((c) => !c.endedAt);
  const cerrados = cortes.filter((c) => c.endedAt);
  const estibaAbierta = activo?.estibas.find((e) => !e.finalEstiba);
  const totalUnidadesEstibas =
    activo?.estibas.reduce((sum, e) => sum + (e.unidadesPorEstiba ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <Label>Turno de envasado</Label>
        {!activo && (
          <IniciarTurnoDialog envasadoId={envasadoId} turnos={turnos} operarios={operarios} />
        )}
      </div>

      {activo && (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{activo.turnoName}</p>
              <p className="text-xs text-muted-foreground">
                {activo.operarios} · desde {formatTime(activo.startedAt)} · unidades
                inicio {activo.unidadesInicio}
              </p>
            </div>
            <FinalizarTurnoDialog
              corteId={activo.id}
              unidadesInicio={activo.unidadesInicio}
              totalUnidadesEstibas={totalUnidadesEstibas}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs font-normal text-muted-foreground">
              Control de calidad (cada hora)
            </Label>
            <LecturasList lecturas={activo.lecturas} />
            <LecturaCalidadForm corteId={activo.id} />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs font-normal text-muted-foreground">Estibas</Label>
            <EstibasList estibas={activo.estibas} />
            {estibaAbierta ? (
              <FinalizarEstibaForm estibaId={estibaAbierta.id} />
            ) : (
              <IniciarEstibaForm corteId={activo.id} />
            )}
          </div>
        </div>
      )}

      {cerrados.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-normal text-muted-foreground">
            Turnos finalizados
          </Label>
          {cerrados.map((c) => (
            <div key={c.id} className="rounded-lg border p-2 text-xs">
              <p className="font-semibold">{c.turnoName}</p>
              <p className="text-muted-foreground">{c.operarios}</p>
              <p>
                {c.unidadesInicio} → {c.unidadesFinal} unidades
                {c.desperdicio ? ` · Desperdicio: ${c.desperdicio}` : ""}
              </p>
              <p className="text-muted-foreground">
                {c.lecturas.length} lectura(s) de calidad · {c.estibas.length} estiba(s)
              </p>
              {c.observaciones && (
                <p className="text-muted-foreground">Obs: {c.observaciones}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
