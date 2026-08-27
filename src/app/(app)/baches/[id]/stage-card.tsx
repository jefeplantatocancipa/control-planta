"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
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
import { startStage, finishStage, type ActionState } from "../actions";
import type { Database } from "@/lib/supabase/types";

type StageTemplate =
  Database["public"]["Tables"]["process_stage_templates"]["Row"];
type StageRecord = Database["public"]["Tables"]["bache_stage_records"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface InsumoDraft {
  insumo_id: string;
  nombre: string;
  checked: boolean;
  lote: string;
  peso: string;
  marca: string;
}

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  return `${minutes} min`;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Iniciar etapa
// ---------------------------------------------------------------------------
function ConfirmStartForm({
  bacheId,
  stageTemplateId,
  operarioId,
  onSuccess,
}: {
  bacheId: string;
  stageTemplateId: string;
  operarioId: string;
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
}: {
  bacheId: string;
  stage: StageTemplate;
  operarios: Profile[];
}) {
  const [operarioId, setOperarioId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const operarioName = operarios.find((o) => o.id === operarioId)?.full_name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`operario-${stage.id}`}>Operario responsable</Label>
        <Select value={operarioId} onValueChange={(value) => setOperarioId(value ?? "")}>
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
      <Button
        type="button"
        size="sm"
        disabled={!operarioId}
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
            </DialogDescription>
          </DialogHeader>
          <ConfirmStartForm
            bacheId={bacheId}
            stageTemplateId={stage.id}
            operarioId={operarioId}
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
      {drafts.map((draft, index) => (
        <div key={draft.insumo_id} className="flex flex-col gap-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.checked}
              onChange={(e) => updateAt(index, { checked: e.target.checked })}
            />
            {draft.nombre}
          </label>
          {draft.checked && (
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
          )}
        </div>
      ))}
      {drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este producto no tiene insumos configurados en Administración →
          Insumos.
        </p>
      )}
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
  isInsumos,
  onSuccess,
}: {
  recordId: string;
  bacheId: string;
  stageTemplateId: string;
  notes: string;
  values: Record<string, string>;
  insumos: InsumoDraft[];
  isInsumos: boolean;
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
      {isInsumos ? (
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
      ) : (
        Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={`param__${key}`} value={value} />
        ))
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
}: {
  bacheId: string;
  stage: StageTemplate;
  record: StageRecord;
  recipeInsumos: { id: string; name: string }[];
}) {
  const isInsumos = stage.capture_mode === "insumos";
  const [values, setValues] = useState<Record<string, string>>({});
  const [insumos, setInsumos] = useState<InsumoDraft[]>(
    recipeInsumos.map((r) => ({
      insumo_id: r.id,
      nombre: r.name,
      checked: false,
      lote: "",
      peso: "",
      marca: "",
    })),
  );
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const checkedInsumos = insumos.filter((i) => i.checked);
  const canSubmit = isInsumos
    ? checkedInsumos.length > 0 &&
      checkedInsumos.every((i) => i.lote.trim() && i.peso.trim() && i.marca.trim())
    : true;

  return (
    <div className="flex flex-col gap-3">
      {isInsumos ? (
        <InsumosChecklist drafts={insumos} onChange={setInsumos} />
      ) : (
        stage.parameter_schema.map((param) => (
          <div key={param.key} className="flex flex-col gap-2">
            <Label htmlFor={`param-${record.id}-${param.key}`}>{param.label}</Label>
            <Input
              id={`param-${record.id}-${param.key}`}
              type={
                param.type === "number"
                  ? "number"
                  : param.type === "time"
                    ? "time"
                    : "text"
              }
              step={param.type === "number" ? "0.01" : undefined}
              value={values[param.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [param.key]: e.target.value }))
              }
            />
          </div>
        ))
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
            {isInsumos
              ? checkedInsumos.map((i) => (
                  <p key={i.insumo_id}>
                    {i.nombre}: Lote {i.lote || "—"} · {i.peso || "0"} kg ·{" "}
                    {i.marca || "—"}
                  </p>
                ))
              : stage.parameter_schema.map((param) =>
                  values[param.key] ? (
                    <p key={param.key}>
                      {param.label}: {values[param.key]}
                    </p>
                  ) : null,
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
            isInsumos={isInsumos}
            onSuccess={() => setConfirmOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
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
  canAct,
  unlocked,
}: {
  bacheId: string;
  stage: StageTemplate;
  record: StageRecord | null;
  operarios: Profile[];
  recipeInsumos: { id: string; name: string }[];
  canAct: boolean;
  unlocked: boolean;
}) {
  const status = !record ? "not_started" : record.ended_at ? "done" : "in_progress";
  const operarioName = record
    ? operarios.find((o) => o.id === record.operario_id)?.full_name
    : undefined;
  const insumos =
    record &&
    stage.capture_mode === "insumos" &&
    "insumos" in record.parameters &&
    Array.isArray(record.parameters.insumos)
      ? record.parameters.insumos
      : null;

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
              {operarioName ?? "—"} · {timeLabel(record.started_at)}–
              {timeLabel(record.ended_at)} ({durationLabel(record.started_at, record.ended_at)})
            </p>
            {insumos ? (
              <ul className="list-inside list-disc">
                {insumos.map((insumo, idx) => (
                  <li key={idx}>
                    {insumo.nombre}: Lote {insumo.lote} · {insumo.peso} kg ·{" "}
                    {insumo.marca}
                  </li>
                ))}
              </ul>
            ) : (
              Object.entries(record.parameters).length > 0 && (
                <ul className="list-inside list-disc">
                  {Object.entries(record.parameters as Record<string, string | number>).map(
                    ([key, value]) => (
                      <li key={key}>
                        {stage.parameter_schema.find((p) => p.key === key)?.label ?? key}:{" "}
                        {value}
                      </li>
                    ),
                  )}
                </ul>
              )
            )}
            {record.notes && <p>Notas: {record.notes}</p>}
          </div>
        )}

        {status === "in_progress" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Iniciada por {operarioName ?? "—"} a las {timeLabel(record!.started_at)}
            </p>
            {canAct ? (
              <FinishStageForm
                bacheId={bacheId}
                stage={stage}
                record={record!}
                recipeInsumos={recipeInsumos}
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
            <StartStageForm bacheId={bacheId} stage={stage} operarios={operarios} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {unlocked ? "Sin iniciar." : "Esperando la etapa anterior."}
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
