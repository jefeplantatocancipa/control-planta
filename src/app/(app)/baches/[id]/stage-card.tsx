"use client";

import { useEffect, useRef, useState } from "react";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  startStage,
  finishStage,
  addReading,
  firmarEtapaBache,
  type ActionState,
} from "../actions";
import { Plus, X } from "lucide-react";
import { formatTime } from "@/lib/format-date";
import type { Database, StageParameterDef, StageReading } from "@/lib/supabase/types";

type StageTemplate =
  Database["public"]["Tables"]["process_stage_templates"]["Row"];
type StageRecord = Database["public"]["Tables"]["bache_stage_records"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Tanque = Database["public"]["Tables"]["tanques"]["Row"];
type Equipo = Database["public"]["Tables"]["equipos"]["Row"];
type EquipoRequirement =
  Database["public"]["Tables"]["stage_equipo_requirements"]["Row"];

const SELECT_CLASSNAME =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm";

// Un mismo <input>/<select> para todos los tipos de parámetro de etapa, así
// la captura de valores (FinishStageForm) y de lecturas (AddReadingSection)
// se comportan igual sin duplicar el switch por tipo.
function ParamValueInput({
  id,
  param,
  value,
  onChange,
  tanques,
  className,
}: {
  id: string;
  param: StageParameterDef;
  value: string;
  onChange: (value: string) => void;
  tanques: Tanque[];
  className?: string;
}) {
  if (param.type === "tanque") {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className ? `${SELECT_CLASSNAME} ${className}` : SELECT_CLASSNAME}
      >
        <option value="">Elegí un tanque</option>
        {tanques.map((tanque) => (
          <option key={tanque.id} value={tanque.name}>
            {tanque.name}
          </option>
        ))}
      </select>
    );
  }

  if (param.type === "positivo_negativo") {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className ? `${SELECT_CLASSNAME} ${className}` : SELECT_CLASSNAME}
      >
        <option value="">Elegí un resultado</option>
        <option value="Positivo">Positivo</option>
        <option value="Negativo">Negativo</option>
      </select>
    );
  }

  return (
    <Input
      id={id}
      type={
        param.type === "number" || param.type === "porcentaje"
          ? "number"
          : param.type === "time"
            ? "time"
            : "text"
      }
      step={param.type === "number" || param.type === "porcentaje" ? "0.01" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

interface RecipeInsumo {
  id: string;
  name: string;
  lote?: string;
  peso?: number;
  marca?: string;
}

interface InsumoDraft {
  insumo_id: string;
  nombre: string;
  checked: boolean;
  lote: string;
  peso: string;
  marca: string;
  // true si lote/peso/marca ya vienen confirmados de una etapa de insumos
  // anterior (encadenada): acá solo hace falta marcar el checkbox, no
  // volver a tipearlos.
  prefilled: boolean;
}

interface BacheConBaseOption {
  id: string;
  batch_code: string;
  volumen_restante_litros: number | null;
}

interface BaseOtroBacheDraft {
  key: number;
  bache_id: string;
  cantidad: string;
}

function formatParamValue(type: StageParameterDef["type"], value: string | number) {
  return type === "porcentaje" ? `${value}%` : value;
}

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  return `${minutes} min`;
}


// ---------------------------------------------------------------------------
// Iniciar etapa
// ---------------------------------------------------------------------------
function ConfirmStartForm({
  bacheId,
  stageTemplateId,
  operarioId,
  equipoSelecciones,
  onSuccess,
}: {
  bacheId: string;
  stageTemplateId: string;
  operarioId: string;
  equipoSelecciones: { requirement_id: string; equipo_id: string }[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startStage,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="bache_id" value={bacheId} />
      <input type="hidden" name="stage_template_id" value={stageTemplateId} />
      <input type="hidden" name="operario_id" value={operarioId} />
      <input
        type="hidden"
        name="equipo_selecciones"
        value={JSON.stringify(equipoSelecciones)}
      />
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Iniciando..." : "Confirmar inicio"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function StartStageForm({
  bacheId,
  stage,
  operarios,
  equipos,
  requirements,
  equiposOcupadosIds,
}: {
  bacheId: string;
  stage: StageTemplate;
  operarios: Profile[];
  equipos: Equipo[];
  requirements: EquipoRequirement[];
  equiposOcupadosIds: Set<string>;
}) {
  const [operarioId, setOperarioId] = useState("");
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const operarioName = operarios.find((o) => o.id === operarioId)?.full_name;

  const fijosOcupados = requirements
    .filter((r) => r.modo === "fijo" && r.equipo_id && equiposOcupadosIds.has(r.equipo_id))
    .map((r) => equipos.find((e) => e.id === r.equipo_id)?.name ?? "—");

  const eligeRequirements = requirements.filter((r) => r.modo === "elige");
  const faltanElegir = eligeRequirements.some((r) => !selecciones[r.id]);

  const canStart = Boolean(operarioId) && fijosOcupados.length === 0 && !faltanElegir;

  const equipoNombres = [
    ...requirements
      .filter((r) => r.modo === "fijo" && r.equipo_id)
      .map((r) => equipos.find((e) => e.id === r.equipo_id)?.name ?? "—"),
    ...eligeRequirements
      .map((r) => equipos.find((e) => e.id === selecciones[r.id])?.name)
      .filter((n): n is string => Boolean(n)),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`operario-${stage.id}`}>Operario responsable</Label>
        <Select
          value={operarioId}
          onValueChange={(value) => setOperarioId(value ?? "")}
          items={operarios.map((operario) => ({
            value: operario.id,
            label: operario.full_name,
          }))}
        >
          <SelectTrigger id={`operario-${stage.id}`} className="w-full">
            <SelectValue placeholder="Elegí un operario" />
          </SelectTrigger>
          <SelectContent>
            {operarios.map((operario) => (
              <SelectItem key={operario.id} value={operario.id}>
                {operario.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {requirements
        .filter((r) => r.modo === "fijo")
        .map((r) => {
          const equipo = r.equipo_id ? equipos.find((e) => e.id === r.equipo_id) : null;
          const ocupado = Boolean(r.equipo_id && equiposOcupadosIds.has(r.equipo_id));
          return (
            <p key={r.id} className="text-sm text-muted-foreground">
              Equipo: {equipo?.name ?? "—"}
              {ocupado && <span className="text-destructive"> · en uso en otro bache</span>}
            </p>
          );
        })}

      {eligeRequirements.map((r) => {
        const equiposDisponibles = r.equipo_tipo
          ? equipos.filter((e) => e.tipo === r.equipo_tipo)
          : equipos;
        return (
          <div key={r.id} className="flex flex-col gap-2">
            <Label htmlFor={`equipo-${r.id}`}>Equipo{r.equipo_tipo ? ` (${r.equipo_tipo})` : ""}</Label>
            <Select
              value={selecciones[r.id] ?? ""}
              onValueChange={(value) =>
                setSelecciones((s) => ({ ...s, [r.id]: value ?? "" }))
              }
              items={equiposDisponibles.map((e) => ({
                value: e.id,
                label: equiposOcupadosIds.has(e.id) ? `${e.name} (en uso)` : e.name,
              }))}
            >
              <SelectTrigger id={`equipo-${r.id}`} className="w-full">
                <SelectValue placeholder="Elegí un equipo" />
              </SelectTrigger>
              <SelectContent>
                {equiposDisponibles.map((e) => (
                  <SelectItem key={e.id} value={e.id} disabled={equiposOcupadosIds.has(e.id)}>
                    {equiposOcupadosIds.has(e.id) ? `${e.name} (en uso)` : e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {equiposDisponibles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sin equipos{r.equipo_tipo ? ` de tipo "${r.equipo_tipo}"` : ""} en Administración.
              </p>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        size="sm"
        disabled={!canStart}
        onClick={() => setConfirmOpen(true)}
        className="self-start"
      >
        Iniciar etapa
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar inicio de etapa</DialogTitle>
            <DialogDescription>
              {stage.name} · {operarioName}
              {equipoNombres.length > 0 ? ` · ${equipoNombres.join(", ")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ConfirmStartForm
            bacheId={bacheId}
            stageTemplateId={stage.id}
            operarioId={operarioId}
            equipoSelecciones={eligeRequirements.map((r) => ({
              requirement_id: r.id,
              equipo_id: selecciones[r.id],
            }))}
            onSuccess={() => setConfirmOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finalizar etapa
// ---------------------------------------------------------------------------
function InsumosChecklist({
  drafts,
  onChange,
}: {
  drafts: InsumoDraft[];
  onChange: (drafts: InsumoDraft[]) => void;
}) {
  function updateAt(index: number, patch: Partial<InsumoDraft>) {
    onChange(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  return (
    <div className="flex flex-col gap-3">
      <Label>Insumos (receta del producto)</Label>
      {drafts.map((draft, index) => {
        const incomplete =
          draft.checked && !(draft.lote.trim() && draft.peso.trim() && draft.marca.trim());
        return (
        <div
          key={draft.insumo_id}
          className={
            incomplete
              ? "flex flex-col gap-2 rounded-lg border border-destructive/50 p-3"
              : "flex flex-col gap-2 rounded-lg border p-3"
          }
        >
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.checked}
              onChange={(e) => updateAt(index, { checked: e.target.checked })}
            />
            {draft.nombre}
          </label>
          {draft.checked &&
            (draft.prefilled ? (
              <p className="pl-6 text-sm text-muted-foreground">
                Lote {draft.lote || "—"} · {draft.peso || "0"} kg ·{" "}
                {draft.marca || "—"}
              </p>
            ) : (
              <div className="flex items-center gap-2 pl-6">
                <Input
                  placeholder="Lote"
                  value={draft.lote}
                  onChange={(e) => updateAt(index, { lote: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Peso (kg)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.peso}
                  onChange={(e) => updateAt(index, { peso: e.target.value })}
                  className="w-24"
                />
                <Input
                  placeholder="Marca"
                  value={draft.marca}
                  onChange={(e) => updateAt(index, { marca: e.target.value })}
                  className="flex-1"
                />
              </div>
            ))}
        </div>
        );
      })}
      {drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este producto no tiene insumos configurados en Administración →
          Insumos.
        </p>
      )}
    </div>
  );
}

// Permite sumar al balance de masa de este bache un volumen que en
// realidad viene de OTRO bache ya existente (ej. sobrante de un tanque que
// se mezcla acá) -- se descuenta del "volumen_restante_litros" de ese
// bache de origen al finalizar la etapa, para no contarlo dos veces.
function BaseOtroBacheEditor({
  drafts,
  onChange,
  opciones,
}: {
  drafts: BaseOtroBacheDraft[];
  onChange: (drafts: BaseOtroBacheDraft[]) => void;
  opciones: BacheConBaseOption[];
}) {
  function updateAt(index: number, patch: Partial<BaseOtroBacheDraft>) {
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function remove(index: number) {
    onChange(drafts.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...drafts, { key: Date.now() + drafts.length, bache_id: "", cantidad: "" }]);
  }

  if (opciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Label>Base de otro bache (si mezclaste sobrante de otro tanque)</Label>
      {drafts.map((draft, index) => {
        const opcion = opciones.find((o) => o.id === draft.bache_id);
        const disponible = opcion?.volumen_restante_litros ?? null;
        const excede = disponible != null && Number(draft.cantidad) > disponible;
        return (
          <div key={draft.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <select
                value={draft.bache_id}
                onChange={(e) => updateAt(index, { bache_id: e.target.value })}
                className={`${SELECT_CLASSNAME} flex-1`}
              >
                <option value="">Elegí un bache</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.batch_code} (quedan {o.volumen_restante_litros} kg)
                  </option>
                ))}
              </select>
              <Input
                placeholder="Cantidad (kg)"
                type="number"
                step="0.01"
                min="0"
                value={draft.cantidad}
                onChange={(e) => updateAt(index, { cantidad: e.target.value })}
                className="w-32"
              />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
                <X className="size-4" />
              </Button>
            </div>
            {excede && (
              <p className="text-xs text-destructive">
                Supera lo que queda disponible en ese bache ({disponible} kg).
              </p>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={add} className="self-start">
        <Plus className="size-4" />
        Agregar base de otro bache
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lecturas periódicas (curva)
// ---------------------------------------------------------------------------
function ReadingsTable({
  stage,
  readings,
}: {
  stage: StageTemplate;
  readings: StageReading[];
}) {
  if (readings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Todavía no hay lecturas.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Hora</th>
            {stage.parameter_schema.map((param) => (
              <th key={param.key} className="py-1 pr-3 font-normal">
                {param.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {readings.map((reading, idx) => (
            <tr key={idx} className="border-b last:border-0">
              <td className="py-1 pr-3">{formatTime(reading.timestamp)}</td>
              {stage.parameter_schema.map((param) => (
                <td key={param.key} className="py-1 pr-3">
                  {reading[param.key] !== undefined
                    ? formatParamValue(param.type, reading[param.key])
                    : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadingSubmitForm({
  bacheId,
  stageTemplateId,
  recordId,
  values,
  onSuccess,
}: {
  bacheId: string;
  stageTemplateId: string;
  recordId: string;
  values: Record<string, string>;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addReading,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="bache_id" value={bacheId} />
      <input type="hidden" name="stage_template_id" value={stageTemplateId} />
      {Object.entries(values).map(([key, value]) => (
        <input key={key} type="hidden" name={`param__${key}`} value={value} />
      ))}
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

function AddReadingSection({
  bacheId,
  stage,
  record,
  tanques,
}: {
  bacheId: string;
  stage: StageTemplate;
  record: StageRecord;
  tanques: Tanque[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const readings = Array.isArray(record.parameters.lecturas)
    ? record.parameters.lecturas
    : [];

  return (
    <div className="flex flex-col gap-3">
      <ReadingsTable stage={stage} readings={readings} />
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Label>Nueva lectura</Label>
        <div className="flex flex-wrap gap-2">
          {stage.parameter_schema.map((param) => (
            <div key={param.key} className="flex flex-col gap-1">
              <Label
                htmlFor={`reading-${record.id}-${param.key}`}
                className="text-xs font-normal"
              >
                {param.label}
              </Label>
              <ParamValueInput
                id={`reading-${record.id}-${param.key}`}
                param={param}
                value={values[param.key] ?? ""}
                onChange={(value) =>
                  setValues((v) => ({ ...v, [param.key]: value }))
                }
                tanques={tanques}
                className="w-32"
              />
            </div>
          ))}
        </div>
        <ReadingSubmitForm
          key={formKey}
          bacheId={bacheId}
          stageTemplateId={stage.id}
          recordId={record.id}
          values={values}
          onSuccess={() => {
            setValues({});
            setFormKey((k) => k + 1);
          }}
        />
      </div>
    </div>
  );
}

function ConfirmFinishForm({
  recordId,
  bacheId,
  stageTemplateId,
  notes,
  values,
  insumos,
  capturesInsumos,
  baseOtroBache,
  opciones,
  onSuccess,
}: {
  recordId: string;
  bacheId: string;
  stageTemplateId: string;
  notes: string;
  values: Record<string, string>;
  insumos: InsumoDraft[];
  capturesInsumos: boolean;
  baseOtroBache: BaseOtroBacheDraft[];
  opciones: BacheConBaseOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finishStage,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="bache_id" value={bacheId} />
      <input type="hidden" name="stage_template_id" value={stageTemplateId} />
      <input type="hidden" name="notes" value={notes} />
      {Object.entries(values).map(([key, value]) => (
        <input key={key} type="hidden" name={`param__${key}`} value={value} />
      ))}
      {capturesInsumos && (
        <input
          type="hidden"
          name="insumos"
          value={JSON.stringify(
            insumos
              .filter((i) => i.checked)
              .map((i) => ({
                insumo_id: i.insumo_id,
                nombre: i.nombre,
                lote: i.lote,
                peso: Number(i.peso),
                marca: i.marca,
              })),
          )}
        />
      )}
      {capturesInsumos && baseOtroBache.length > 0 && (
        <input
          type="hidden"
          name="base_otro_bache"
          value={JSON.stringify(
            baseOtroBache
              .filter((b) => b.bache_id && Number(b.cantidad) > 0)
              .map((b) => ({
                bache_id: b.bache_id,
                batch_code: opciones.find((o) => o.id === b.bache_id)?.batch_code ?? "—",
                cantidad: Number(b.cantidad),
              })),
          )}
        />
      )}
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Confirmar finalización"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FinishStageForm({
  bacheId,
  stage,
  record,
  recipeInsumos,
  tanques,
  otrosBachesConBase,
}: {
  bacheId: string;
  stage: StageTemplate;
  record: StageRecord;
  recipeInsumos: RecipeInsumo[];
  tanques: Tanque[];
  otrosBachesConBase: BacheConBaseOption[];
}) {
  const capturesInsumos = stage.captures_insumos;
  const capturesReadings = stage.captures_readings;
  const [values, setValues] = useState<Record<string, string>>({});
  const [insumos, setInsumos] = useState<InsumoDraft[]>(
    recipeInsumos.map((r) => ({
      insumo_id: r.id,
      nombre: r.name,
      checked: false,
      lote: r.lote ?? "",
      peso: r.peso !== undefined ? String(r.peso) : "",
      marca: r.marca ?? "",
      prefilled: r.lote !== undefined,
    })),
  );
  const [baseOtroBache, setBaseOtroBache] = useState<BaseOtroBacheDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const checkedInsumos = insumos.filter((i) => i.checked);
  const baseOtroBacheValida = baseOtroBache.filter(
    (b) => b.bache_id && Number(b.cantidad) > 0,
  );
  const baseOtroBacheExcede = baseOtroBacheValida.some((b) => {
    const disponible = otrosBachesConBase.find((o) => o.id === b.bache_id)
      ?.volumen_restante_litros;
    return disponible != null && Number(b.cantidad) > disponible;
  });
  const totalBalanceMasa =
    checkedInsumos.reduce((sum, i) => sum + (Number(i.peso) || 0), 0) +
    baseOtroBacheValida.reduce((sum, b) => sum + Number(b.cantidad), 0);
  const readings = Array.isArray(record.parameters.lecturas)
    ? record.parameters.lecturas
    : [];
  const insumosOk = capturesInsumos
    ? checkedInsumos.length > 0 &&
      checkedInsumos.every((i) => i.lote.trim() && i.peso.trim() && i.marca.trim())
    : true;
  const readingsOk = capturesReadings ? readings.length > 0 : true;
  const canSubmit = insumosOk && readingsOk && !baseOtroBacheExcede;

  return (
    <div className="flex flex-col gap-3">
      {!capturesReadings &&
        stage.parameter_schema.map((param) => (
          <div key={param.key} className="flex flex-col gap-2">
            <Label htmlFor={`param-${record.id}-${param.key}`}>{param.label}</Label>
            <ParamValueInput
              id={`param-${record.id}-${param.key}`}
              param={param}
              value={values[param.key] ?? ""}
              onChange={(value) =>
                setValues((v) => ({ ...v, [param.key]: value }))
              }
              tanques={tanques}
            />
          </div>
        ))}

      {capturesReadings && (
        <AddReadingSection
          bacheId={bacheId}
          stage={stage}
          record={record}
          tanques={tanques}
        />
      )}

      {capturesInsumos && (
        <>
          <InsumosChecklist drafts={insumos} onChange={setInsumos} />
          <BaseOtroBacheEditor
            drafts={baseOtroBache}
            onChange={setBaseOtroBache}
            opciones={otrosBachesConBase}
          />
          {(checkedInsumos.length > 0 || baseOtroBacheValida.length > 0) && (
            <p className="text-sm font-semibold">
              Balance de masa: {totalBalanceMasa.toFixed(2)} kg
            </p>
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`notes-${record.id}`}>Notas</Label>
        <Input
          id={`notes-${record.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </div>

      {capturesReadings && !readingsOk && (
        <p className="text-sm text-muted-foreground">
          Agregá al menos una lectura antes de finalizar.
        </p>
      )}
      {capturesInsumos && !insumosOk && (
        <p className="text-sm text-muted-foreground">
          {checkedInsumos.length === 0
            ? "Marcá al menos un insumo."
            : "Completá lote, peso y marca de cada insumo marcado."}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        disabled={!canSubmit}
        onClick={() => setConfirmOpen(true)}
        className="self-start"
      >
        Finalizar etapa
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar finalización de etapa</DialogTitle>
            <DialogDescription>{stage.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {stage.parameter_schema.map((param) =>
              values[param.key] ? (
                <p key={param.key}>
                  {param.label}: {formatParamValue(param.type, values[param.key])}
                </p>
              ) : null,
            )}
            {capturesInsumos &&
              checkedInsumos.map((i) => (
                <p key={i.insumo_id}>
                  {i.nombre}: Lote {i.lote || "—"} · {i.peso || "0"} kg · {i.marca || "—"}
                </p>
              ))}
            {capturesInsumos &&
              baseOtroBacheValida.map((b) => (
                <p key={b.key}>
                  Base de {otrosBachesConBase.find((o) => o.id === b.bache_id)?.batch_code ?? "—"}:{" "}
                  {b.cantidad} kg
                </p>
              ))}
            {capturesInsumos && (checkedInsumos.length > 0 || baseOtroBacheValida.length > 0) && (
              <p className="font-semibold text-foreground">
                Balance de masa: {totalBalanceMasa.toFixed(2)} kg
              </p>
            )}
            {notes && <p>Notas: {notes}</p>}
          </div>
          <ConfirmFinishForm
            recordId={record.id}
            bacheId={bacheId}
            stageTemplateId={stage.id}
            notes={notes}
            values={values}
            insumos={insumos}
            capturesInsumos={capturesInsumos}
            baseOtroBache={baseOtroBacheValida}
            opciones={otrosBachesConBase}
            onSuccess={() => setConfirmOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Firma de calidad (aprobación posterior al cierre de la etapa; nunca
// bloquea ni condiciona el proceso, que sigue su curso igual)
// ---------------------------------------------------------------------------
export interface FirmaDisplay {
  aprobado: boolean;
  observaciones: string | null;
  firmadoPorNombre: string;
  firmadoAt: string;
}

function FirmarEtapaForm({
  stageRecordId,
  bacheId,
  onSuccess,
}: {
  stageRecordId: string;
  bacheId: string;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    firmarEtapaBache,
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
      <input type="hidden" name="stage_record_id" value={stageRecordId} />
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

function FirmaSection({
  stageRecordId,
  bacheId,
  firma,
  canFirmar,
}: {
  stageRecordId: string;
  bacheId: string;
  firma: FirmaDisplay | null;
  canFirmar: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (firma && !editing) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={firma.aprobado ? "secondary" : "destructive"}>
            {firma.aprobado ? "Aprobado por calidad" : "Rechazado por calidad"}
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
    return (
      <p className="text-xs text-muted-foreground">Pendiente de firma de calidad.</p>
    );
  }

  return (
    <FirmarEtapaForm
      stageRecordId={stageRecordId}
      bacheId={bacheId}
      onSuccess={() => setEditing(false)}
    />
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de etapa
// ---------------------------------------------------------------------------
export function StageCard({
  bacheId,
  stage,
  record,
  operarios,
  recipeInsumos,
  otrosBachesConBase,
  canAct,
  unlocked,
  tanques,
  equipos,
  requirements,
  recordEquipoIds,
  equiposOcupadosIds,
  firma,
  canFirmar,
}: {
  bacheId: string;
  stage: StageTemplate;
  record: StageRecord | null;
  operarios: Profile[];
  recipeInsumos: RecipeInsumo[];
  otrosBachesConBase: BacheConBaseOption[];
  canAct: boolean;
  unlocked: boolean;
  tanques: Tanque[];
  equipos: Equipo[];
  requirements: EquipoRequirement[];
  recordEquipoIds: string[];
  equiposOcupadosIds: Set<string>;
  firma?: FirmaDisplay | null;
  canFirmar?: boolean;
}) {
  const status = !record ? "not_started" : record.ended_at ? "done" : "in_progress";
  const operarioName = record
    ? operarios.find((o) => o.id === record.operario_id)?.full_name
    : undefined;
  const equipoNames = recordEquipoIds.map(
    (id) => equipos.find((e) => e.id === id)?.name ?? "Equipo eliminado",
  );
  const insumos =
    record && stage.captures_insumos && Array.isArray(record.parameters.insumos)
      ? record.parameters.insumos
      : null;
  const baseOtroBache =
    record && stage.captures_insumos && Array.isArray(record.parameters.base_otro_bache)
      ? record.parameters.base_otro_bache
      : null;
  const readings =
    record && stage.captures_readings && Array.isArray(record.parameters.lecturas)
      ? record.parameters.lecturas
      : null;
  const paramEntries = record
    ? (Object.entries(record.parameters).filter(
        ([key]) => key !== "insumos" && key !== "lecturas",
      ) as [string, string | number][])
    : [];

  return (
    <Card className={status === "not_started" && !unlocked ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>
            {stage.sequence_order}. {stage.name}
          </span>
          <Badge
            variant={
              status === "done"
                ? "secondary"
                : status === "in_progress"
                  ? "default"
                  : "outline"
            }
          >
            {status === "done"
              ? "Completada"
              : status === "in_progress"
                ? "En curso"
                : "Pendiente"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === "done" && record?.ended_at && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              {operarioName ?? "—"} · {formatTime(record.started_at)}–
              {formatTime(record.ended_at)} ({durationLabel(record.started_at, record.ended_at)})
            </p>
            {equipoNames.length > 0 && <p>Equipo: {equipoNames.join(", ")}</p>}
            {record.closed_by && (
              <p>
                Firmado por:{" "}
                {operarios.find((o) => o.id === record.closed_by)?.full_name ?? "—"}
              </p>
            )}
            {paramEntries.length > 0 && (
              <ul className="list-inside list-disc">
                {paramEntries.map(([key, value]) => {
                  const param = stage.parameter_schema.find((p) => p.key === key);
                  return (
                    <li key={key}>
                      {param?.label ?? key}:{" "}
                      {param ? formatParamValue(param.type, value) : value}
                    </li>
                  );
                })}
              </ul>
            )}
            {(insumos || baseOtroBache) && (
              <>
                <ul className="list-inside list-disc">
                  {insumos?.map((insumo, idx) => (
                    <li key={idx}>
                      {insumo.nombre}: Lote {insumo.lote} · {insumo.peso} kg ·{" "}
                      {insumo.marca}
                    </li>
                  ))}
                  {baseOtroBache?.map((b, idx) => (
                    <li key={`base-${idx}`}>
                      Base de {b.batch_code}: {b.cantidad} kg
                    </li>
                  ))}
                </ul>
                <p className="font-semibold text-foreground">
                  Balance de masa:{" "}
                  {(
                    (insumos ?? []).reduce((sum, i) => sum + (Number(i.peso) || 0), 0) +
                    (baseOtroBache ?? []).reduce((sum, b) => sum + (Number(b.cantidad) || 0), 0)
                  ).toFixed(2)}{" "}
                  kg
                </p>
              </>
            )}
            {readings && (
              <div className="pt-1">
                <ReadingsTable stage={stage} readings={readings} />
              </div>
            )}
            {record.notes && <p>Notas: {record.notes}</p>}
            <FirmaSection
              stageRecordId={record.id}
              bacheId={bacheId}
              firma={firma ?? null}
              canFirmar={Boolean(canFirmar)}
            />
          </div>
        )}

        {status === "in_progress" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Iniciada por {operarioName ?? "—"} a las {formatTime(record!.started_at)}
              {equipoNames.length > 0 ? ` · ${equipoNames.join(", ")}` : ""}
            </p>
            {canAct ? (
              <FinishStageForm
                bacheId={bacheId}
                stage={stage}
                record={record!}
                recipeInsumos={recipeInsumos}
                tanques={tanques}
                otrosBachesConBase={otrosBachesConBase}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Esperando que se complete la captura.
              </p>
            )}
          </div>
        )}

        {status === "not_started" &&
          (canAct && unlocked ? (
            <StartStageForm
              bacheId={bacheId}
              stage={stage}
              operarios={operarios.filter(
                (o) => o.role === "operario" || o.role === "supervisor",
              )}
              equipos={equipos}
              requirements={requirements}
              equiposOcupadosIds={equiposOcupadosIds}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {unlocked ? "Sin iniciar." : "Esperando la etapa anterior."}
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
