"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";

export interface EtapaDuracionRow {
  productId: string;
  productName: string;
  stageName: string;
  promedioMin: number;
  cantidad: number;
}

export interface EtapaHistorialRow {
  productId: string;
  bacheId: string;
  batchCode: string;
  startedAt: string;
  stageName: string;
  sequenceOrder: number;
  minutos: number;
}

const ULTIMOS_BACHES = 10;

const PALETTE = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "#b08968",
  "#7b5ea7",
];

function minutesLabel(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

export function EtapaGantt({
  rows,
  historial,
}: {
  rows: EtapaDuracionRow[];
  historial: EtapaHistorialRow[];
}) {
  const productos = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!seen.has(r.productId)) seen.set(r.productId, r.productName);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const [productId, setProductId] = useState(productos[0]?.id ?? "");

  const segmentos = useMemo(() => {
    const propios = rows.filter((r) => r.productId === productId);
    return propios.map((r, i) => {
      const start = propios.slice(0, i).reduce((sum, x) => sum + x.promedioMin, 0);
      return { ...r, start, end: start + r.promedioMin, color: PALETTE[i % PALETTE.length] };
    });
  }, [rows, productId]);

  const total = segmentos.length > 0 ? segmentos[segmentos.length - 1].end : 0;
  const stageColumns = segmentos.map((s) => s.stageName);

  const historialFiltrado = useMemo(() => {
    const porBache = new Map<
      string,
      { bacheId: string; batchCode: string; startedAt: string; stages: Map<string, number> }
    >();
    for (const h of historial) {
      if (h.productId !== productId) continue;
      const entry = porBache.get(h.bacheId) ?? {
        bacheId: h.bacheId,
        batchCode: h.batchCode,
        startedAt: h.startedAt,
        stages: new Map<string, number>(),
      };
      entry.stages.set(h.stageName, h.minutos);
      porBache.set(h.bacheId, entry);
    }
    return Array.from(porBache.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, ULTIMOS_BACHES);
  }, [historial, productId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:w-72">
        <Label htmlFor="producto_gantt">Producto</Label>
        <Select
          value={productId}
          onValueChange={(value) => setProductId(value ?? "")}
          items={productos.map((p) => ({ value: p.id, label: p.name }))}
        >
          <SelectTrigger id="producto_gantt" className="w-full">
            <SelectValue placeholder="Elegí un producto" />
          </SelectTrigger>
          <SelectContent>
            {productos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {segmentos.length > 0 && total > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <div className="flex min-w-[560px] flex-col gap-1.5">
              {segmentos.map((s) => (
                <div key={s.stageName} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-sm" title={s.stageName}>
                    {s.stageName}
                  </span>
                  <div className="relative h-7 flex-1 rounded-md bg-muted/40">
                    <div
                      className="absolute top-0.5 bottom-0.5 flex items-center overflow-hidden rounded px-1.5 text-[11px] whitespace-nowrap text-white"
                      style={{
                        left: `${(s.start / total) * 100}%`,
                        width: `${Math.max(1, ((s.end - s.start) / total) * 100)}%`,
                        backgroundColor: s.color,
                      }}
                      title={`${s.stageName}: ${minutesLabel(s.promedioMin)} (${s.cantidad} completadas)`}
                    >
                      {minutesLabel(s.promedioMin)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Tiempo total estimado del proceso: <span className="font-medium text-foreground">{minutesLabel(total)}</span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin etapas completadas para este producto.</p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Últimos {ULTIMOS_BACHES} baches</p>
        {historialFiltrado.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bache</TableHead>
                  <TableHead>Iniciado</TableHead>
                  {stageColumns.map((stageName) => (
                    <TableHead key={stageName} className="text-right whitespace-nowrap">
                      {stageName}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {historialFiltrado.map((b) => (
                  <TableRow key={b.bacheId}>
                    <TableCell className="font-medium whitespace-nowrap">{b.batchCode}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(b.startedAt)}</TableCell>
                    {stageColumns.map((stageName) => {
                      const minutos = b.stages.get(stageName);
                      return (
                        <TableCell key={stageName} className="text-right whitespace-nowrap">
                          {minutos != null ? minutesLabel(minutos) : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin baches completados para este producto.</p>
        )}
      </div>
    </div>
  );
}
