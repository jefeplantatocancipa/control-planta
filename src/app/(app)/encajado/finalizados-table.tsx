"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScrollSync } from "@/components/table-scroll-sync";
import { DeleteButton } from "@/components/delete-button";
import { ReabrirEncajadoButton } from "./reabrir-encajado-button";
import { deleteEncajado } from "./actions";
import { formatDate, formatDateTime, formatTime } from "@/lib/format-date";
import type { EstibaDisplay } from "./encajado-card";

export interface FinalizadoRow {
  id: string;
  bacheLabel: string;
  presentacion: string;
  lote: string | null;
  fechaEnvasado: string | null;
  unidadesEnvasadas: number;
  estibas: EstibaDisplay[];
  multiempaque: number | null;
  unidadesSueltas: number;
  unidadesAveriadas: number;
  startedAt: string | null;
  endedAt: string | null;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FinalizadoDetalle({
  row,
  totalCajas,
  unidadesEmpacadas,
}: {
  row: FinalizadoRow;
  totalCajas: number;
  unidadesEmpacadas: number | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Unidades totales" value={row.unidadesEnvasadas} />
        <Stat label="Unidades empacadas" value={unidadesEmpacadas ?? "—"} />
        <Stat label="Averiadas" value={row.unidadesAveriadas} />
        <Stat label="Sueltas" value={row.unidadesSueltas} />
      </div>
      {row.estibas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Estibas ({row.estibas.length}, {totalCajas} cajas)
          </p>
          <div className="flex flex-wrap gap-2">
            {row.estibas.map((e, i) => (
              <div key={e.id} className="rounded-md border bg-background px-3 py-2 text-xs">
                <p className="font-medium">Estiba {i + 1}</p>
                <p className="text-muted-foreground">
                  {formatTime(e.inicioEstiba)} –{" "}
                  {e.finalEstiba ? formatTime(e.finalEstiba) : "En curso"}
                </p>
                <p>{e.cajasPorEstiba ?? "—"} cajas</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin estibas todavía.</p>
      )}
    </div>
  );
}

export function FinalizadosTable({
  rows,
  canExecute,
  canDelete,
}: {
  rows: FinalizadoRow[];
  canExecute: boolean;
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const colSpan = 12 + (canExecute || canDelete ? 1 : 0);

  return (
    <TableScrollSync>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bache</TableHead>
            <TableHead>Presentación</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Fecha de envasado</TableHead>
            <TableHead>Unidades envasadas</TableHead>
            <TableHead>Estibas</TableHead>
            <TableHead>Cajas</TableHead>
            <TableHead>Unidades empacadas</TableHead>
            <TableHead>Sueltas</TableHead>
            <TableHead>Averiadas</TableHead>
            <TableHead>Iniciado</TableHead>
            <TableHead>Finalizado</TableHead>
            {(canExecute || canDelete) && (
              <TableHead className="sticky right-0 bg-background" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const totalCajas = c.estibas.reduce((sum, e) => sum + (e.cajasPorEstiba ?? 0), 0);
            const isExpanded = expanded.has(c.id);
            return (
              <Fragment key={c.id}>
                <TableRow className="group">
                  <TableCell className="font-medium">{c.bacheLabel}</TableCell>
                  <TableCell>{c.presentacion}</TableCell>
                  <TableCell>{c.lote ?? "—"}</TableCell>
                  <TableCell>{c.fechaEnvasado ? formatDate(c.fechaEnvasado) : "—"}</TableCell>
                  <TableCell>{c.unidadesEnvasadas}</TableCell>
                  <TableCell>{c.estibas.length}</TableCell>
                  <TableCell>{totalCajas}</TableCell>
                  <TableCell>
                    {c.multiempaque !== null ? totalCajas * c.multiempaque : "—"}
                  </TableCell>
                  <TableCell>{c.unidadesSueltas}</TableCell>
                  <TableCell>{c.unidadesAveriadas}</TableCell>
                  <TableCell>{c.startedAt && formatDateTime(c.startedAt)}</TableCell>
                  <TableCell>{c.endedAt && formatDateTime(c.endedAt)}</TableCell>
                  {(canExecute || canDelete) && (
                    <TableCell className="sticky right-0 bg-background text-right group-hover:bg-muted/50">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggle(c.id)}
                        >
                          <ChevronRight
                            className={`size-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                          Ver
                        </Button>
                        {canExecute && <ReabrirEncajadoButton id={c.id} />}
                        {canDelete && (
                          <DeleteButton
                            action={deleteEncajado}
                            id={c.id}
                            title="Eliminar encajado"
                            description="Borra este encajado con sus estibas registradas."
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={colSpan}>
                      <FinalizadoDetalle
                        row={c}
                        totalCajas={totalCajas}
                        unidadesEmpacadas={c.multiempaque !== null ? totalCajas * c.multiempaque : null}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                Sin encajados finalizados todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableScrollSync>
  );
}
