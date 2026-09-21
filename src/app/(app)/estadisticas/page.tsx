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
import { ShareChart } from "./share-chart";
import { EtapasPorOperario, type EtapaOperarioRow } from "./etapas-por-operario";
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
    { data: envasadoStats },
    { data: vasosEnmangados },
    { data: profiles },
    { data: bachesCerrados },
    { data: todosBaches },
    { data: insumos },
    { data: envasados },
    { data: envasadoReferencias },
    { data: products },
    { data: stageRecordsAll },
    { data: stageTemplatesAll },
  ] = await Promise.all([
    supabase
      .from("v_estadisticas_envasado_operario")
      .select("*")
      .order("total_unidades", { ascending: false }),
    supabase.from("vasos_enmangados").select("*"),
    supabase.from("profiles").select("*"),
    supabase
      .from("baches")
      .select("id, product_id, started_at, completed_at")
      .eq("status", "completado")
      .not("completed_at", "is", null),
    // Para "kg producidos" hace falta CUALQUIER bache (no solo los ya
    // completados): la última etapa con checklist de insumos puede cerrarse
    // antes de que el bache entero se marque como terminado.
    supabase.from("baches").select("id, product_id"),
    supabase.from("insumos").select("id, name"),
    supabase.from("envasados").select("cantidad_unidades, referencia_id, presentacion, started_at"),
    supabase.from("envasado_referencias").select("id, sku, name, peso_unitario"),
    supabase.from("products").select("id, name"),
    supabase
      .from("bache_stage_records")
      .select("bache_id, stage_template_id, operario_id, started_at, ended_at, parameters"),
    supabase
      .from("process_stage_templates")
      .select("id, product_id, name, sequence_order, captures_insumos"),
  ]);

  const operarioNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  // -------------------------------------------------------------------
  // KPI: tiempo promedio de preparación de un bache (planta completa) +
  // desglose por producto, porque no todos tardan lo mismo.
  // -------------------------------------------------------------------
  const prepDurations = (bachesCerrados ?? [])
    .filter((b) => b.completed_at)
    .map((b) => (new Date(b.completed_at!).getTime() - new Date(b.started_at).getTime()) / 60000);
  const avgPrepMinutes =
    prepDurations.length > 0
      ? prepDurations.reduce((s, v) => s + v, 0) / prepDurations.length
      : null;

  const prepPorProducto = new Map<string, { sumaMin: number; cantidad: number }>();
  for (const b of bachesCerrados ?? []) {
    if (!b.completed_at) continue;
    const minutos = (new Date(b.completed_at).getTime() - new Date(b.started_at).getTime()) / 60000;
    const entry = prepPorProducto.get(b.product_id) ?? { sumaMin: 0, cantidad: 0 };
    entry.sumaMin += minutos;
    entry.cantidad += 1;
    prepPorProducto.set(b.product_id, entry);
  }
  const preparacionPorProducto = Array.from(prepPorProducto.entries())
    .map(([productId, e]) => ({
      productId,
      nombre: productNameById.get(productId) ?? "Producto eliminado",
      promedioMin: e.sumaMin / e.cantidad,
      cantidad: e.cantidad,
    }))
    .sort((a, b) => b.promedioMin - a.promedioMin);

  // -------------------------------------------------------------------
  // KPI: tiempo promedio por etapa (planta completa) + desglose por
  // producto y etapa -- se calcula directo de bache_stage_records (no de
  // v_estadisticas_operario, que solo trae operario x etapa) para poder
  // agrupar por producto.
  // -------------------------------------------------------------------
  const stageInfoById = new Map(
    (stageTemplatesAll ?? []).map((s) => [s.id, { name: s.name, sequenceOrder: s.sequence_order }]),
  );
  const bacheProductById = new Map((bachesCerrados ?? []).map((b) => [b.id, b.product_id]));

  const etapaPorProductoMap = new Map<
    string,
    Map<string, { stageName: string; sequenceOrder: number; sumaMin: number; cantidad: number }>
  >();
  let totalEtapasCompletadas = 0;
  let sumaEtapasMin = 0;
  for (const r of stageRecordsAll ?? []) {
    if (!r.ended_at) continue;
    const productId = bacheProductById.get(r.bache_id);
    const stage = stageInfoById.get(r.stage_template_id);
    if (!productId || !stage) continue;
    const minutos = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000;
    const porEtapa = etapaPorProductoMap.get(productId) ?? new Map();
    const entry = porEtapa.get(r.stage_template_id) ?? {
      stageName: stage.name,
      sequenceOrder: stage.sequenceOrder,
      sumaMin: 0,
      cantidad: 0,
    };
    entry.sumaMin += minutos;
    entry.cantidad += 1;
    porEtapa.set(r.stage_template_id, entry);
    etapaPorProductoMap.set(productId, porEtapa);
    totalEtapasCompletadas += 1;
    sumaEtapasMin += minutos;
  }
  const avgEtapaMinutes = totalEtapasCompletadas > 0 ? sumaEtapasMin / totalEtapasCompletadas : null;

  const duracionPorEtapaYProducto = Array.from(etapaPorProductoMap.entries())
    .sort(([a], [b]) =>
      (productNameById.get(a) ?? "").localeCompare(productNameById.get(b) ?? ""),
    )
    .flatMap(([productId, porEtapa]) =>
      Array.from(porEtapa.values())
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((e) => ({
          productId,
          productName: productNameById.get(productId) ?? "Producto eliminado",
          stageName: e.stageName,
          promedioMin: e.sumaMin / e.cantidad,
          cantidad: e.cantidad,
        })),
    );

  // -------------------------------------------------------------------
  // Kg producidos: se calcula igual que el balance de masa del reporte
  // impreso de cada bache (no del consumo de inventario, que solo existe
  // desde que existe el módulo de Inventario y deja afuera baches
  // anteriores) -- los kg de insumos de la última etapa con checklist de
  // insumos que quedó cerrada, para CUALQUIER bache (no solo los ya
  // completados, porque esa etapa puede cerrarse antes).
  // -------------------------------------------------------------------
  const insumoNames = new Map((insumos ?? []).map((i) => [i.id, i.name]));

  const stagesByProduct = new Map<
    string,
    { id: string; sequence_order: number; captures_insumos: boolean }[]
  >();
  const defaultStagesList: { id: string; sequence_order: number; captures_insumos: boolean }[] = [];
  for (const s of stageTemplatesAll ?? []) {
    if (s.product_id) {
      const arr = stagesByProduct.get(s.product_id) ?? [];
      arr.push(s);
      stagesByProduct.set(s.product_id, arr);
    } else {
      defaultStagesList.push(s);
    }
  }
  function stagesForProducto(productId: string) {
    const own = stagesByProduct.get(productId);
    return own && own.length > 0 ? own : defaultStagesList;
  }

  const recordsByBacheAll = new Map<string, NonNullable<typeof stageRecordsAll>>();
  for (const r of stageRecordsAll ?? []) {
    const arr = recordsByBacheAll.get(r.bache_id) ?? [];
    arr.push(r);
    recordsByBacheAll.set(r.bache_id, arr);
  }

  const kgProducidoEvents: {
    productId: string;
    kg: number;
    date: string;
    insumos: { insumo_id: string; peso: number }[];
  }[] = [];
  for (const bache of todosBaches ?? []) {
    const records = recordsByBacheAll.get(bache.id) ?? [];
    const stageById = new Map(stagesForProducto(bache.product_id).map((s) => [s.id, s]));
    let best: {
      order: number;
      kg: number;
      date: string;
      insumos: { insumo_id: string; peso: number }[];
    } | null = null;
    for (const record of records) {
      if (!record.ended_at) continue;
      const stage = stageById.get(record.stage_template_id);
      if (!stage || !stage.captures_insumos) continue;
      const insumosArr = record.parameters?.insumos;
      if (!Array.isArray(insumosArr)) continue;
      if (best && stage.sequence_order <= best.order) continue;
      const kgTotal = insumosArr.reduce((s, i) => s + (Number(i.peso) || 0), 0);
      best = {
        order: stage.sequence_order,
        kg: kgTotal,
        date: record.ended_at.slice(0, 10),
        insumos: insumosArr,
      };
    }
    if (best) {
      kgProducidoEvents.push({
        productId: bache.product_id,
        kg: best.kg,
        date: best.date,
        insumos: best.insumos,
      });
    }
  }

  // -------------------------------------------------------------------
  // Etapas de bache por operario Y producto -- v_estadisticas_operario no
  // trae el producto (una misma etapa por nombre puede repetirse por
  // producto), así que se recalcula directo de bache_stage_records para
  // poder filtrar por operario y por producto a la vez.
  // -------------------------------------------------------------------
  const bacheProductByIdAll = new Map((todosBaches ?? []).map((b) => [b.id, b.product_id]));
  const etapaOperarioAgg = new Map<
    string,
    {
      operario_id: string;
      product_id: string;
      stage_id: string;
      stage_name: string;
      sumaMin: number;
      cantidad: number;
    }
  >();
  for (const r of stageRecordsAll ?? []) {
    if (!r.ended_at) continue;
    const productId = bacheProductByIdAll.get(r.bache_id);
    const stage = stageInfoById.get(r.stage_template_id);
    if (!productId || !stage) continue;
    const minutos = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000;
    const key = `${r.operario_id}:${productId}:${r.stage_template_id}`;
    const entry = etapaOperarioAgg.get(key) ?? {
      operario_id: r.operario_id,
      product_id: productId,
      stage_id: r.stage_template_id,
      stage_name: stage.name,
      sumaMin: 0,
      cantidad: 0,
    };
    entry.sumaMin += minutos;
    entry.cantidad += 1;
    etapaOperarioAgg.set(key, entry);
  }
  const etapaOperarioRows: EtapaOperarioRow[] = Array.from(etapaOperarioAgg.values()).map((e) => ({
    operario_id: e.operario_id,
    operario_name: operarioNames.get(e.operario_id) ?? "—",
    product_id: e.product_id,
    product_name: productNameById.get(e.product_id) ?? "Producto eliminado",
    stage_id: e.stage_id,
    stage_name: e.stage_name,
    etapas_completadas: e.cantidad,
    duracion_promedio_min: e.cantidad > 0 ? e.sumaMin / e.cantidad : null,
  }));

  // -------------------------------------------------------------------
  // Kg empacados: unidades envasadas x peso unitario de la referencia
  // (mismo criterio de resolución que el reporte impreso de bache: por
  // referencia_id, si no por el texto congelado de la presentación, y si
  // no por el nombre de la referencia).
  // -------------------------------------------------------------------
  const referenciaById = new Map((envasadoReferencias ?? []).map((r) => [r.id, r]));
  const referenciaByLabel = new Map(
    (envasadoReferencias ?? []).map((r) => [`${r.sku} — ${r.name}`, r]),
  );
  const referenciaByName = new Map((envasadoReferencias ?? []).map((r) => [r.name, r]));
  function referenciaDe(e: { referencia_id: string | null; presentacion: string }) {
    if (e.referencia_id && referenciaById.has(e.referencia_id)) {
      return referenciaById.get(e.referencia_id)!;
    }
    if (referenciaByLabel.has(e.presentacion)) return referenciaByLabel.get(e.presentacion)!;
    const parts = e.presentacion.split(" — ");
    const nameGuess = (parts.length > 1 ? parts.slice(1).join(" — ") : e.presentacion).trim();
    return referenciaByName.get(nameGuess) ?? null;
  }
  function pesoUnitarioDe(e: { referencia_id: string | null; presentacion: string }) {
    return referenciaDe(e)?.peso_unitario ?? null;
  }

  const cutoff30d = daysAgoISO(30);

  const kgProducidos30d = kgProducidoEvents
    .filter((e) => e.date >= cutoff30d)
    .reduce((s, e) => s + e.kg, 0);

  const kgEmpacados30d = (envasados ?? [])
    .filter((e) => e.started_at.slice(0, 10) >= cutoff30d)
    .reduce((s, e) => {
      const peso = pesoUnitarioDe(e);
      return peso ? s + (e.cantidad_unidades * peso) / 1000 : s;
    }, 0);

  // -------------------------------------------------------------------
  // Participación por producto (kg producidos, últimos 30 días) y por
  // referencia de envasado (kg empacados, últimos 30 días).
  // -------------------------------------------------------------------
  const produccionPorProductoMap = new Map<string, number>();
  for (const e of kgProducidoEvents) {
    if (e.date < cutoff30d) continue;
    produccionPorProductoMap.set(e.productId, (produccionPorProductoMap.get(e.productId) ?? 0) + e.kg);
  }
  const produccionPorProducto = Array.from(produccionPorProductoMap.entries())
    .map(([id, total]) => ({
      label: productNameById.get(id) ?? "Producto eliminado",
      value: Math.round(total * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  const empaquePorReferenciaMap = new Map<string, { nombre: string; total: number }>();
  for (const e of envasados ?? []) {
    if (e.started_at.slice(0, 10) < cutoff30d) continue;
    const referencia = referenciaDe(e);
    if (!referencia) continue;
    const entry = empaquePorReferenciaMap.get(referencia.id) ?? { nombre: referencia.name, total: 0 };
    entry.total += (e.cantidad_unidades * referencia.peso_unitario) / 1000;
    empaquePorReferenciaMap.set(referencia.id, entry);
  }
  const empaquePorReferencia = Array.from(empaquePorReferenciaMap.values())
    .map((e) => ({ label: e.nombre, value: Math.round(e.total * 10) / 10 }))
    .sort((a, b) => b.value - a.value);

  // -------------------------------------------------------------------
  // Top 5 insumos de materia prima más consumidos (últimos 30 días) --
  // mismos eventos de balance de masa de arriba, desglosados por insumo.
  // -------------------------------------------------------------------
  const topInsumosMap = new Map<string, number>();
  for (const e of kgProducidoEvents) {
    if (e.date < cutoff30d) continue;
    for (const i of e.insumos) {
      topInsumosMap.set(i.insumo_id, (topInsumosMap.get(i.insumo_id) ?? 0) + (Number(i.peso) || 0));
    }
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
    const producido = kgProducidoEvents
      .filter((e) => fridayOfWeek(e.date) === weekStart)
      .reduce((s, e) => s + e.kg, 0);
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
            <CardTitle className="text-base">Participación por producto (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {produccionPorProducto.length > 0 ? (
              <ShareChart data={produccionPorProducto} unit="kg" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin producción registrada en los últimos 30 días.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participación por referencia de envasado (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {empaquePorReferencia.length > 0 ? (
              <ShareChart data={empaquePorReferencia} unit="kg" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin envasado registrado en los últimos 30 días.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempo de preparación por producto</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Baches cerrados</TableHead>
                  <TableHead className="text-right">Tiempo promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preparacionPorProducto.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell>{p.cantidad}</TableCell>
                    <TableCell className="text-right">{minutesLabel(p.promedioMin)}</TableCell>
                  </TableRow>
                ))}
                {preparacionPorProducto.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Sin baches cerrados todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
          <CardTitle className="text-base">Duración promedio por etapa y producto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Completadas</TableHead>
                <TableHead className="text-right">Duración promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duracionPorEtapaYProducto.map((e, i) => (
                <TableRow key={`${e.productId}-${e.stageName}-${i}`}>
                  <TableCell className="font-medium">{e.productName}</TableCell>
                  <TableCell>{e.stageName}</TableCell>
                  <TableCell>{e.cantidad}</TableCell>
                  <TableCell className="text-right">{minutesLabel(e.promedioMin)}</TableCell>
                </TableRow>
              ))}
              {duracionPorEtapaYProducto.length === 0 && (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas de bache por operario</CardTitle>
        </CardHeader>
        <CardContent>
          <EtapasPorOperario rows={etapaOperarioRows} />
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
