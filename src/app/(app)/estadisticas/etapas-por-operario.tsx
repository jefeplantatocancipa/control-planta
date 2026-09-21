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
  product_id: string;
  product_name: string;
  stage_id: string;
  stage_name: string;
  etapas_completadas: number;
  duracion_promedio_min: number | null;
}

const ALL_PRODUCTS = "__todos__";

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
  const productos = useMemo(
    () =>
      Array.from(new Map(rows.map((r) => [r.product_id, r.product_name])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
  const [operarioId, setOperarioId] = useState(operarios[0]?.id ?? "");
  const [productId, setProductId] = useState(ALL_PRODUCTS);

  // Promedio de planta por producto + etapa (todos los operarios), para
  // comparar en igualdad de condiciones (una misma etapa por nombre puede
  // repetirse en varios productos).
  const promedioPlantaPorProductoEtapa = useMemo(() => {
    const acc = new Map<string, { sumaMin: number; cantidad: number }>();
    for (const r of rows) {
      if (r.duracion_promedio_min == null) continue;
      const key = `${r.product_id}:${r.stage_id}`;
      const entry = acc.get(key) ?? { sumaMin: 0, cantidad: 0 };
      entry.sumaMin += r.duracion_promedio_min * r.etapas_completadas;
      entry.cantidad += r.etapas_completadas;
      acc.set(key, entry);
    }
    const out = new Map<string, number>();
    for (const [key, e] of acc) {
      if (e.cantidad > 0) out.set(key, e.sumaMin / e.cantidad);
    }
    return out;
  }, [rows]);

  const filasOperario = useMemo(
    () =>
      rows
        .filter((r) => r.operario_id === operarioId)
        .filter((r) => productId === ALL_PRODUCTS || r.product_id === productId)
        .sort(
          (a, b) =>
            a.product_name.localeCompare(b.product_name) || a.stage_name.localeCompare(b.stage_name),
        ),
    [rows, operarioId, productId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-2 sm:w-64">
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

        <div className="flex flex-col gap-2 sm:w-64">
          <Label htmlFor="producto_filter">Producto</Label>
          <Select
            value={productId}
            onValueChange={(value) => setProductId(value ?? ALL_PRODUCTS)}
            items={[
              { value: ALL_PRODUCTS, label: "Todos los productos" },
              ...productos.map((p) => ({ value: p.id, label: p.name })),
            ]}
          >
            <SelectTrigger id="producto_filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PRODUCTS}>Todos los productos</SelectItem>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Completadas</TableHead>
            <TableHead className="text-right">Duración promedio</TableHead>
            <TableHead className="text-right">Promedio planta</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filasOperario.map((row) => {
            const plantaAvg = promedioPlantaPorProductoEtapa.get(`${row.product_id}:${row.stage_id}`) ?? null;
            const diff =
              row.duracion_promedio_min != null && plantaAvg != null
                ? Math.round(row.duracion_promedio_min - plantaAvg)
                : null;
            return (
              <TableRow key={`${row.product_id}-${row.stage_id}`}>
                <TableCell className="text-muted-foreground">{row.product_name}</TableCell>
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
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {operarios.length === 0
                  ? "Sin etapas completadas todavía."
                  : "Sin etapas completadas con ese filtro."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
