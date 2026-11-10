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
import { formatDate, formatDateTime } from "@/lib/format-date";
import { EstibasList, type EstibaDisplay } from "./encajado-card";

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
                      <EstibasList estibas={c.estibas} />
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
