import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplianceChart, type ComplianceDatum } from "./compliance-chart";
import type { Database } from "@/lib/supabase/types";

type Row = Database["public"]["Views"]["v_cumplimiento_programa"]["Row"];

function aggregate(
  rows: Row[],
  keyOf: (row: Row) => string,
  labelOf: (key: string) => string,
): ComplianceDatum[] {
  const totals = new Map<string, { planned: number; executed: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = totals.get(key) ?? { planned: 0, executed: 0 };
    entry.planned += row.planned_quantity;
    entry.executed += row.executed_quantity;
    totals.set(key, entry);
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { planned, executed }]) => ({
      key,
      label: labelOf(key),
      planned,
      executed,
      pct: planned > 0 ? Math.round((executed / planned) * 100) : 0,
    }));
}

export default async function CumplimientoPage() {
  await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_cumplimiento_programa")
    .select("*")
    .order("scheduled_date", { ascending: false });

  const rows = data ?? [];

  const weekly = aggregate(
    rows,
    (r) => r.week_start_date,
    (key) => format(new Date(`${key}T00:00:00`), "d MMM", { locale: es }),
  ).reverse();

  const monthly = aggregate(
    rows,
    (r) => r.scheduled_date.slice(0, 7),
    (key) => format(new Date(`${key}-01T00:00:00`), "MMM yyyy", { locale: es }),
  ).reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cumplimiento del programa</h1>
        <p className="text-muted-foreground">
          Planeado vs. ejecutado por producto, semana y mes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por semana</CardTitle>
          </CardHeader>
          <CardContent>
            {weekly.length > 0 ? (
              <ComplianceChart data={weekly} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly.length > 0 ? (
              <ComplianceChart data={monthly} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle por orden</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Semana</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Planeado</TableHead>
                <TableHead>Ejecutado</TableHead>
                <TableHead>Cumplimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.production_order_id}>
                  <TableCell className="font-medium">{row.product_name}</TableCell>
                  <TableCell>
                    {format(new Date(`${row.week_start_date}T00:00:00`), "d MMM", {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell>
                    {format(new Date(`${row.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {row.planned_quantity} {row.unit}
                  </TableCell>
                  <TableCell>
                    {row.executed_quantity} {row.unit}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.cumplimiento_pct >= 100 ? "default" : "outline"}>
                      {row.cumplimiento_pct}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Sin órdenes de producción todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
