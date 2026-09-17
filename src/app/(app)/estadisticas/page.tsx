import type { ComponentType } from "react";
import { Clock, Package, PackageCheck, Timer } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperarioBarChart } from "./operario-bar-chart";
import { TrendChart, type TrendDatum } from "./trend-chart";
import { fridayOfWeek } from "../programa/excel-utils";

function minutesLabel(minutes: number | null) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function kg(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("es-CO");
}

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function daysAgoISO(days: number) {
  return format(new Date(Date.now() - days * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{sublabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function EstadisticasPage() {
  await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);
  const supabase = await createClient();

  const [
    { data: etapaStats },
    { data: envasadoStats },
    { data: vasosEnmangados },
    { data: profiles },
    { data: bachesCerrados },
    { data: consumoMateriaPrima },
    { data: insumos },
    { data: envasados },
    { data: envasadoReferencias },
  ] = await Promise.all([
    supabase.from("v_estadisticas_operario").select("*").order("operario_name"),
    supabase
      .from("v_estadisticas_envasado_operario")
      .select("*")
      .order("total_unidades", { ascending: false }),
    supabase.from("vasos_enmangados").select("*"),
    supabase.from("profiles").select("*"),
    supabase
      .from("baches")
      .select("started_at, completed_at")
      .eq("status", "completado")
      .not("completed_at", "is", null),
    supabase
      .from("inventario_movimientos")
      .select("cantidad, created_at, insumo_id")
      .eq("insumo_tipo", "materia_prima")
      .eq("tipo", "consumo"),
    supabase.from("insumos").select("id, name"),
    supabase.from("envasados").select("cantidad_unidades, referencia_id, presentacion, started_at"),
    supabase.from("envasado_referencias").select("id, sku, name, peso_unitario"),
  ]);

  const operarioNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // -------------------------------------------------------------------
  // KPI: tiempo promedio de preparación de un bache
  // -------------------------------------------------------------------
  const prepDurations = (bachesCerrados ?? [])
    .filter((b) => b.completed_at)
    .map((b) => (new Date(b.completed_at!).getTime() - new Date(b.started_at).getTime()) / 60000);
  const avgPrepMinutes =
    prepDurations.length > 0
      ? prepDurations.reduce((s, v) => s + v, 0) / prepDurations.length
      : null;

  // -------------------------------------------------------------------
  // KPI + gráfico: duración promedio por etapa (planta completa, no por
  // operario) -- promedio ponderado por cantidad de etapas completadas.
  // -------------------------------------------------------------------
  const porEtapa = new Map<string, { nombre: string; sumaMin: number; cantidad: number }>();
  for (const row of etapaStats ?? []) {
    if (row.duracion_promedio_min == null) continue;
    const entry = porEtapa.get(row.stage_id) ?? {
      nombre: row.stage_name,
      sumaMin: 0,
      cantidad: 0,
    };
    entry.sumaMin += row.duracion_promedio_min * row.etapas_completadas;
    entry.cantidad += row.etapas_completadas;
    porEtapa.set(row.stage_id, entry);
  }
  const duracionPorEtapa = Array.from(porEtapa.values())
    .map((e) => ({ label: e.nombre, value: e.cantidad > 0 ? Math.round(e.sumaMin / e.cantidad) : 0 }))
    .sort((a, b) => b.value - a.value);
  const totalEtapasCompletadas = Array.from(porEtapa.values()).reduce((s, e) => s + e.cantidad, 0);
  const avgEtapaMinutes =
    totalEtapasCompletadas > 0
      ? Array.from(porEtapa.values()).reduce((s, e) => s + e.sumaMin, 0) / totalEtapasCompletadas
      : null;

  // -------------------------------------------------------------------
  // Kg producidos: consumo real de materia prima registrado al cerrar la
  // última etapa con checklist de insumos de cada bache (igual criterio
  // que el balance de masa del reporte de bache).
  // -------------------------------------------------------------------
  const insumoNames = new Map((insumos ?? []).map((i) => [i.id, i.name]));

  // -------------------------------------------------------------------
  // Kg empacados: unidades envasadas x peso unitario de la referencia
  // (mismo criterio de resolución que el reporte impreso de bache: por
  // referencia_id, si no por el texto congelado de la presentación, y si
  // no por el nombre de la referencia).
  // -------------------------------------------------------------------
  const pesoUnitarioById = new Map((envasadoReferencias ?? []).map((r) => [r.id, r.peso_unitario]));
  const pesoUnitarioByLabel = new Map(
    (envasadoReferencias ?? []).map((r) => [`${r.sku} — ${r.name}`, r.peso_unitario]),
  );
  const pesoUnitarioByName = new Map((envasadoReferencias ?? []).map((r) => [r.name, r.peso_unitario]));
  function pesoUnitarioDe(e: { referencia_id: string | null; presentacion: string }) {
    if (e.referencia_id && pesoUnitarioById.has(e.referencia_id)) {
      return pesoUnitarioById.get(e.referencia_id)!;
    }
    if (pesoUnitarioByLabel.has(e.presentacion)) return pesoUnitarioByLabel.get(e.presentacion)!;
    const parts = e.presentacion.split(" — ");
    const nameGuess = (parts.length > 1 ? parts.slice(1).join(" — ") : e.presentacion).trim();
    return pesoUnitarioByName.get(nameGuess) ?? null;
  }

  const cutoff30d = daysAgoISO(30);

  const kgProducidos30d = (consumoMateriaPrima ?? [])
    .filter((m) => m.created_at.slice(0, 10) >= cutoff30d)
    .reduce((s, m) => s + Math.abs(m.cantidad), 0);

  const kgEmpacados30d = (envasados ?? [])
    .filter((e) => e.started_at.slice(0, 10) >= cutoff30d)
    .reduce((s, e) => {
      const peso = pesoUnitarioDe(e);
      return peso ? s + (e.cantidad_unidades * peso) / 1000 : s;
    }, 0);

  // -------------------------------------------------------------------
  // Top 5 insumos de materia prima más consumidos (últimos 30 días)
  // -------------------------------------------------------------------
  const topInsumosMap = new Map<string, number>();
  for (const m of consumoMateriaPrima ?? []) {
    if (m.created_at.slice(0, 10) < cutoff30d) continue;
    topInsumosMap.set(m.insumo_id, (topInsumosMap.get(m.insumo_id) ?? 0) + Math.abs(m.cantidad));
  }
  const topInsumos = Array.from(topInsumosMap.entries())
    .map(([id, total]) => ({ id, nombre: insumoNames.get(id) ?? "—", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // -------------------------------------------------------------------
  // Tendencia semanal (últimas 8 semanas, viernes a jueves): kg producidos
  // vs. kg empacados.
  // -------------------------------------------------------------------
  const currentWeek = fridayOfWeek(todayISO());
  const weekStarts: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(`${currentWeek}T00:00:00`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weekStarts.push(d.toISOString().slice(0, 10));
  }
  const trendData: TrendDatum[] = weekStarts.map((weekStart) => {
    const producido = (consumoMateriaPrima ?? [])
      .filter((m) => fridayOfWeek(m.created_at.slice(0, 10)) === weekStart)
      .reduce((s, m) => s + Math.abs(m.cantidad), 0);
    const empacado = (envasados ?? [])
      .filter((e) => fridayOfWeek(e.started_at.slice(0, 10)) === weekStart)
      .reduce((s, e) => {
        const peso = pesoUnitarioDe(e);
        return peso ? s + (e.cantidad_unidades * peso) / 1000 : s;
      }, 0);
    return {
      label: format(new Date(`${weekStart}T00:00:00`), "d MMM", { locale: es }),
      producido: Math.round(producido * 10) / 10,
      empacado: Math.round(empacado * 10) / 10,
    };
  });

  const enmangadoByOperario = new Map<
    string,
    { operario_name: string; eventos: number; total_unidades: number; total_mermas: number }
  >();
  for (const vaso of vasosEnmangados ?? []) {
    const entry = enmangadoByOperario.get(vaso.operario_id) ?? {
      operario_name: operarioNames.get(vaso.operario_id) ?? "—",
      eventos: 0,
      total_unidades: 0,
      total_mermas: 0,
    };
    entry.eventos += 1;
    entry.total_unidades += vaso.cantidad_unidades;
    entry.total_mermas += vaso.cantidad_mermas;
    enmangadoByOperario.set(vaso.operario_id, entry);
  }
  const enmangadoStats = Array.from(enmangadoByOperario.values())
    .map((e) => ({
      ...e,
      tasa_merma_pct:
        e.total_unidades + e.total_mermas > 0
          ? Math.round((e.total_mermas / (e.total_unidades + e.total_mermas)) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.total_unidades - a.total_unidades);

  const envasadoChartData = (envasadoStats ?? []).map((s) => ({
    label: s.operario_name,
    value: s.total_unidades,
  }));
  const enmangadoChartData = enmangadoStats.map((s) => ({
    label: s.operario_name,
    value: s.total_unidades,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Estadísticas</h1>
        <p className="text-muted-foreground">
          Indicadores de planta y desempeño por operario y por proceso.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Clock}
          label="Tiempo promedio de preparación"
          value={minutesLabel(avgPrepMinutes)}
          sublabel={`${prepDurations.length} bache${prepDurations.length === 1 ? "" : "s"} cerrados`}
        />
        <KpiCard
          icon={Timer}
          label="Tiempo promedio por etapa"
          value={minutesLabel(avgEtapaMinutes)}
          sublabel={`${totalEtapasCompletadas} etapas completadas`}
        />
        <KpiCard
          icon={Package}
          label="Kilos producidos"
          value={`${kg(kgProducidos30d)} kg`}
          sublabel="Últimos 30 días"
        />
        <KpiCard
          icon={PackageCheck}
          label="Kilos empacados"
          value={`${kg(kgEmpacados30d)} kg`}
          sublabel="Últimos 30 días"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Producción vs. empaque por semana</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.some((d) => d.producido > 0 || d.empacado > 0) ? (
            <TrendChart data={trendData} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Duración promedio por etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {duracionPorEtapa.length > 0 ? (
              <OperarioBarChart data={duracionPorEtapa} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin etapas completadas todavía.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materia prima más consumida</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Consumo (30 días)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topInsumos.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{kg(i.total)} kg</TableCell>
                  </TableRow>
                ))}
                {topInsumos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Sin consumo registrado en los últimos 30 días.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas de bache por operario</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operario</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Completadas</TableHead>
                <TableHead>Duración promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(etapaStats ?? []).map((row) => (
                <TableRow key={`${row.operario_id}-${row.stage_id}`}>
                  <TableCell className="font-medium">{row.operario_name}</TableCell>
                  <TableCell>{row.stage_name}</TableCell>
                  <TableCell>{row.etapas_completadas}</TableCell>
                  <TableCell>
                    {row.duracion_promedio_min != null
                      ? `${Math.round(row.duracion_promedio_min)} min`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {(etapaStats ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin etapas completadas todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envasado por operario</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {envasadoChartData.length > 0 && (
              <OperarioBarChart data={envasadoChartData} />
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operario</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Mermas</TableHead>
                  <TableHead>Tasa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(envasadoStats ?? []).map((row) => (
                  <TableRow key={row.operario_id}>
                    <TableCell className="font-medium">{row.operario_name}</TableCell>
                    <TableCell>{row.eventos_envasado}</TableCell>
                    <TableCell>{row.total_unidades}</TableCell>
                    <TableCell>{row.total_mermas}</TableCell>
                    <TableCell>
                      <Badge variant={row.tasa_merma_pct > 5 ? "destructive" : "outline"}>
                        {row.tasa_merma_pct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(envasadoStats ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin envasados todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enmangado por operario</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {enmangadoChartData.length > 0 && (
              <OperarioBarChart data={enmangadoChartData} />
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operario</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Mermas</TableHead>
                  <TableHead>Tasa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enmangadoStats.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.operario_name}</TableCell>
                    <TableCell>{row.eventos}</TableCell>
                    <TableCell>{row.total_unidades}</TableCell>
                    <TableCell>{row.total_mermas}</TableCell>
                    <TableCell>
                      <Badge variant={row.tasa_merma_pct > 5 ? "destructive" : "outline"}>
                        {row.tasa_merma_pct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {enmangadoStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin enmangados todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
