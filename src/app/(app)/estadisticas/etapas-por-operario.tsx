"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

export interface EtapaOperarioRow {
  operario_id: string;
  operario_name: string;
  stage_id: string;
  stage_name: string;
  etapas_completadas: number;
  duracion_promedio_min: number | null;
}

function diffClass(diff: number): string {
  if (diff < -2) return "text-emerald-600 dark:text-emerald-400";
  if (diff > 2) return "text-destructive";
  return "text-muted-foreground";
}

export function EtapasPorOperario({ rows }: { rows: EtapaOperarioRow[] }) {
  const operarios = useMemo(
    () =>
      Array.from(new Map(rows.map((r) => [r.operario_id, r.operario_name])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
  const [operarioId, setOperarioId] = useState(operarios[0]?.id ?? "");

  // Promedio de planta por etapa (todos los operarios), para comparar.
  const promedioPlantaPorEtapa = useMemo(() => {
    const acc = new Map<string, { sumaMin: number; cantidad: number }>();
    for (const r of rows) {
      if (r.duracion_promedio_min == null) continue;
      const entry = acc.get(r.stage_id) ?? { sumaMin: 0, cantidad: 0 };
      entry.sumaMin += r.duracion_promedio_min * r.etapas_completadas;
      entry.cantidad += r.etapas_completadas;
      acc.set(r.stage_id, entry);
    }
    const out = new Map<string, number>();
    for (const [stageId, e] of acc) {
      if (e.cantidad > 0) out.set(stageId, e.sumaMin / e.cantidad);
    }
    return out;
  }, [rows]);

  const filasOperario = useMemo(
    () =>
      rows
        .filter((r) => r.operario_id === operarioId)
        .sort((a, b) => a.stage_name.localeCompare(b.stage_name)),
    [rows, operarioId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:w-72">
        <Label htmlFor="operario_filter">Operario</Label>
        <Select
          value={operarioId}
          onValueChange={(value) => setOperarioId(value ?? "")}
          items={operarios.map((o) => ({ value: o.id, label: o.name }))}
        >
          <SelectTrigger id="operario_filter" className="w-full">
            <SelectValue placeholder="Elegí un operario" />
          </SelectTrigger>
          <SelectContent>
            {operarios.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etapa</TableHead>
            <TableHead>Completadas</TableHead>
            <TableHead className="text-right">Duración promedio</TableHead>
            <TableHead className="text-right">Promedio planta</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filasOperario.map((row) => {
            const plantaAvg = promedioPlantaPorEtapa.get(row.stage_id) ?? null;
            const diff =
              row.duracion_promedio_min != null && plantaAvg != null
                ? Math.round(row.duracion_promedio_min - plantaAvg)
                : null;
            return (
              <TableRow key={row.stage_id}>
                <TableCell className="font-medium">{row.stage_name}</TableCell>
                <TableCell>{row.etapas_completadas}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.duracion_promedio_min != null
                    ? `${Math.round(row.duracion_promedio_min)} min`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {plantaAvg != null ? `${Math.round(plantaAvg)} min` : "—"}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${diff != null ? diffClass(diff) : ""}`}>
                  {diff != null ? `${diff > 0 ? "+" : ""}${diff} min` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {filasOperario.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {operarios.length === 0
                  ? "Sin etapas completadas todavía."
                  : "Este operario todavía no completó etapas."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
