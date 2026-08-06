"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startStage, finishStage, type ActionState } from "../actions";
import type { Database, StageParameterDef } from "@/lib/supabase/types";

type StageTemplate =
  Database["public"]["Tables"]["process_stage_templates"]["Row"];
type StageRecord = Database["public"]["Tables"]["bache_stage_records"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

function durationLabel(startedAt: string, endedAt: string) {
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  return `${minutes} min`;
}

function StartStageForm({
  bacheId,
  stageTemplateId,
  operarios,
}: {
  bacheId: string;
  stageTemplateId: string;
  operarios: Profile[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    startStage,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="bache_id" value={bacheId} />
      <input type="hidden" name="stage_template_id" value={stageTemplateId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`operario-${stageTemplateId}`}>Operario responsable</Label>
        <Select name="operario_id" required>
          <SelectTrigger id={`operario-${stageTemplateId}`} className="w-full">
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
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Iniciando..." : "Iniciar etapa"}
      </Button>
    </form>
  );
}

function FinishStageForm({
  bacheId,
  stageTemplateId,
  record,
  parameterSchema,
}: {
  bacheId: string;
  stageTemplateId: string;
  record: StageRecord;
  parameterSchema: StageParameterDef[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    finishStage,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="record_id" value={record.id} />
      <input type="hidden" name="bache_id" value={bacheId} />
      <input type="hidden" name="stage_template_id" value={stageTemplateId} />

      {parameterSchema.map((param) => (
        <div key={param.key} className="flex flex-col gap-2">
          <Label htmlFor={`param-${record.id}-${param.key}`}>{param.label}</Label>
          <Input
            id={`param-${record.id}-${param.key}`}
            name={`param__${param.key}`}
            type={param.type === "number" ? "number" : "text"}
            step={param.type === "number" ? "0.01" : undefined}
          />
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`notes-${record.id}`}>Notas</Label>
        <Input id={`notes-${record.id}`} name="notes" placeholder="Opcional" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Finalizar etapa"}
      </Button>
    </form>
  );
}

export function StageCard({
  bacheId,
  stage,
  record,
  operarios,
  canAct,
  unlocked,
}: {
  bacheId: string;
  stage: StageTemplate;
  record: StageRecord | null;
  operarios: Profile[];
  canAct: boolean;
  unlocked: boolean;
}) {
  const status = !record ? "not_started" : record.ended_at ? "done" : "in_progress";
  const operarioName = record
    ? operarios.find((o) => o.id === record.operario_id)?.full_name
    : undefined;

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
              {operarioName ?? "—"} · {durationLabel(record.started_at, record.ended_at)}
            </p>
            {Object.entries(record.parameters).length > 0 && (
              <ul className="list-inside list-disc">
                {Object.entries(record.parameters).map(([key, value]) => (
                  <li key={key}>
                    {stage.parameter_schema.find((p) => p.key === key)?.label ?? key}:{" "}
                    {value}
                  </li>
                ))}
              </ul>
            )}
            {record.notes && <p>Notas: {record.notes}</p>}
          </div>
        )}

        {status === "in_progress" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Iniciada por {operarioName ?? "—"}
            </p>
            {canAct ? (
              <FinishStageForm
                bacheId={bacheId}
                stageTemplateId={stage.id}
                record={record!}
                parameterSchema={stage.parameter_schema}
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
              stageTemplateId={stage.id}
              operarios={operarios}
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
