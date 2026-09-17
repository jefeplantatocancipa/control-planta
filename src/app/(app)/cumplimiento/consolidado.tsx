"use client";

import { Fragment, useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Beaker, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fridayOfWeek } from "../programa/excel-utils";

type Accent = "bases" | "envasado";

const ACCENT: Record<Accent, { icon: typeof Beaker; color: string; label: string }> = {
  bases: { icon: Beaker, color: "var(--chart-1)", label: "Bases (baches)" },
  envasado: { icon: Package, color: "var(--chart-4)", label: "Envasado" },
};

function AccentTitle({ accent }: { accent: Accent }) {
  const { icon: Icon, color, label } = ACCENT[accent];
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon className="size-4" />
      </span>
      <span style={{ color }}>{label}</span>
    </div>
  );
}

export interface CumplimientoRow {
  id: string;
  name: string;
  scheduled_date: string;
  planned: number;
  executed: number;
  unit: string;
}

type Mode = "dia" | "semana" | "mes";

const WEEKDAY_LABELS = ["Vie", "Sáb", "Dom", "Lun", "Mar", "Mié", "Jue"];

function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function todayISO(): string {
  return toISO(new Date());
}

function pct(planned: number, executed: number): number {
  if (planned > 0) return Math.round((executed / planned) * 100);
  return executed > 0 ? 100 : 0;
}

function diffClass(diff: number): string {
  if (diff < 0) return "text-destructive";
  if (diff > 0) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

interface Aggregated {
  id: string;
  name: string;
  unit: string;
  planned: number;
  executed: number;
}

function aggregateByProduct(rows: CumplimientoRow[]): Aggregated[] {
  const totals = new Map<string, Aggregated>();
  for (const row of rows) {
    const entry = totals.get(row.id) ?? {
      id: row.id,
      name: row.name,
      unit: row.unit,
      planned: 0,
      executed: 0,
    };
    entry.planned += row.planned;
    entry.executed += row.executed;
    totals.set(row.id, entry);
  }
  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function ResumenTable({
  accent,
  rows,
  emptyLabel,
}: {
  accent: Accent;
  rows: CumplimientoRow[];
  emptyLabel: string;
}) {
  const aggregated = useMemo(() => aggregateByProduct(rows), [rows]);
  const totalPlanned = aggregated.reduce((s, r) => s + r.planned, 0);
  const totalExecuted = aggregated.reduce((s, r) => s + r.executed, 0);
  const totalDiff = totalExecuted - totalPlanned;

  return (
    <Card className="border-t-4" style={{ borderTopColor: ACCENT[accent].color }}>
      <CardHeader>
        <CardTitle className="text-base">
          <AccentTitle accent={accent} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Programado</TableHead>
              <TableHead className="text-right">Ejecutado</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead className="text-right">Cumplimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregated.map((r) => {
              const diff = r.executed - r.planned;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.planned} {r.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.executed} {r.unit}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${diffClass(diff)}`}>
                    {diff > 0 ? "+" : ""}
                    {diff} {r.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={pct(r.planned, r.executed) >= 100 ? "default" : "outline"}>
                      {pct(r.planned, r.executed)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {aggregated.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {aggregated.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{totalPlanned}</TableCell>
                <TableCell className="text-right tabular-nums">{totalExecuted}</TableCell>
                <TableCell className={`text-right tabular-nums ${diffClass(totalDiff)}`}>
                  {totalDiff > 0 ? "+" : ""}
                  {totalDiff}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={pct(totalPlanned, totalExecuted) >= 100 ? "default" : "outline"}>
                    {pct(totalPlanned, totalExecuted)}%
                  </Badge>
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}

interface WeekCell {
  planned: number;
  executed: number;
}

interface WeekProductRow {
  id: string;
  name: string;
  cells: WeekCell[];
  totalPlanned: number;
  totalExecuted: number;
}

function buildWeekGrid(rows: CumplimientoRow[], days: string[]): WeekProductRow[] {
  const byProduct = new Map<string, WeekProductRow>();
  for (const row of rows) {
    const dayIndex = days.indexOf(row.scheduled_date);
    if (dayIndex === -1) continue;
    let entry = byProduct.get(row.id);
    if (!entry) {
      entry = {
        id: row.id,
        name: row.name,
        cells: days.map(() => ({ planned: 0, executed: 0 })),
        totalPlanned: 0,
        totalExecuted: 0,
      };
      byProduct.set(row.id, entry);
    }
    entry.cells[dayIndex].planned += row.planned;
    entry.cells[dayIndex].executed += row.executed;
    entry.totalPlanned += row.planned;
    entry.totalExecuted += row.executed;
  }
  return Array.from(byProduct.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function SemanaGrid({
  accent,
  rows,
  weekStart,
  emptyLabel,
}: {
  accent: Accent;
  rows: CumplimientoRow[];
  weekStart: string;
  emptyLabel: string;
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toISO(addDays(parseISO(weekStart), i))),
    [weekStart],
  );
  const products = useMemo(() => buildWeekGrid(rows, days), [rows, days]);
  const colSpan = days.length + 2;

  return (
    <Card className="border-t-4" style={{ borderTopColor: ACCENT[accent].color }}>
      <CardHeader>
        <CardTitle className="text-base">
          <AccentTitle accent={accent} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              {days.map((d, i) => (
                <TableHead key={d} className="text-right">
                  <div className="flex flex-col items-end">
                    <span>{WEEKDAY_LABELS[i]}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {format(parseISO(d), "d/MM")}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <Fragment key={p.id}>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={colSpan} className="font-semibold">
                    {p.name}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 text-muted-foreground">Programado</TableCell>
                  {p.cells.map((c, i) => (
                    <TableCell key={i} className="text-right tabular-nums">
                      {c.planned || "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums font-medium">
                    {p.totalPlanned}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 text-muted-foreground">Ejecutado</TableCell>
                  {p.cells.map((c, i) => (
                    <TableCell key={i} className="text-right tabular-nums">
                      {c.executed || "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums font-medium">
                    {p.totalExecuted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 text-muted-foreground">Diferencia</TableCell>
                  {p.cells.map((c, i) => {
                    const diff = c.executed - c.planned;
                    const empty = c.planned === 0 && c.executed === 0;
                    return (
                      <TableCell
                        key={i}
                        className={`text-right tabular-nums ${empty ? "text-muted-foreground" : diffClass(diff)}`}
                      >
                        {empty ? "—" : `${diff > 0 ? "+" : ""}${diff}`}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={`text-right tabular-nums font-medium ${diffClass(p.totalExecuted - p.totalPlanned)}`}
                  >
                    {p.totalExecuted - p.totalPlanned > 0 ? "+" : ""}
                    {p.totalExecuted - p.totalPlanned}
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ConsolidadoCumplimiento({
  bachesRows,
  envasadoRows,
}: {
  bachesRows: CumplimientoRow[];
  envasadoRows: CumplimientoRow[];
}) {
  const [mode, setMode] = useState<Mode>("semana");
  const [anchor, setAnchor] = useState<string>(() => todayISO());

  const periodRange = useMemo(() => {
    if (mode === "dia") return { start: anchor, end: anchor };
    if (mode === "semana") {
      const start = fridayOfWeek(anchor);
      return { start, end: toISO(addDays(parseISO(start), 6)) };
    }
    return {
      start: toISO(startOfMonth(parseISO(anchor))),
      end: toISO(endOfMonth(parseISO(anchor))),
    };
  }, [mode, anchor]);

  function shift(step: number) {
    if (mode === "dia") setAnchor((a) => toISO(addDays(parseISO(a), step)));
    else if (mode === "semana") setAnchor((a) => toISO(addDays(parseISO(a), step * 7)));
    else setAnchor((a) => toISO(addMonths(parseISO(a), step)));
  }

  const bachesInRange = useMemo(
    () => bachesRows.filter((r) => r.scheduled_date >= periodRange.start && r.scheduled_date <= periodRange.end),
    [bachesRows, periodRange],
  );
  const envasadoInRange = useMemo(
    () =>
      envasadoRows.filter(
        (r) => r.scheduled_date >= periodRange.start && r.scheduled_date <= periodRange.end,
      ),
    [envasadoRows, periodRange],
  );

  const periodLabel = useMemo(() => {
    if (mode === "dia") return format(parseISO(anchor), "EEEE d 'de' MMMM yyyy", { locale: es });
    if (mode === "semana") {
      return `${format(parseISO(periodRange.start), "d MMM", { locale: es })} – ${format(
        parseISO(periodRange.end),
        "d MMM yyyy",
        { locale: es },
      )}`;
    }
    return format(parseISO(anchor), "MMMM yyyy", { locale: es });
  }, [mode, anchor, periodRange]);

  const emptySuffix = mode === "dia" ? "este día" : mode === "semana" ? "esta semana" : "este mes";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={mode} onValueChange={(value) => value && setMode(value as Mode)}>
            <TabsList>
              <TabsTrigger value="dia">Diario</TabsTrigger>
              <TabsTrigger value="semana">Semanal</TabsTrigger>
              <TabsTrigger value="mes">Mensual</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Período anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-44 text-center text-sm font-medium capitalize">{periodLabel}</span>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Período siguiente">
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(todayISO())}>
              Hoy
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === "semana" ? (
        <>
          <SemanaGrid
            accent="bases"
            rows={bachesInRange}
            weekStart={periodRange.start}
            emptyLabel={`Sin baches programados ${emptySuffix}.`}
          />
          <SemanaGrid
            accent="envasado"
            rows={envasadoInRange}
            weekStart={periodRange.start}
            emptyLabel={`Sin envasado programado ${emptySuffix}.`}
          />
        </>
      ) : (
        <>
          <ResumenTable
            accent="bases"
            rows={bachesInRange}
            emptyLabel={`Sin baches programados ${emptySuffix}.`}
          />
          <ResumenTable
            accent="envasado"
            rows={envasadoInRange}
            emptyLabel={`Sin envasado programado ${emptySuffix}.`}
          />
        </>
      )}
    </div>
  );
}
