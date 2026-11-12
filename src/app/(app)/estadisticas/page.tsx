import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplet,
  Flame,
  Gauge,
  Layers,
  Package,
  PackageCheck,
  Percent,
  Target,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { StageRecordParameters } from "@/lib/supabase/types";
import { usosDeEquipos } from "@/lib/equipo-ocupacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperarioBarChart } from "./operario-bar-chart";
import { ExpandableCard } from "./expandable-card";
import { KpiCard } from "./kpi-card";
import { TrendChart, type TrendDatum } from "./trend-chart";
import { ShareChart } from "./share-chart";
import { EtapasPorOperario, type EtapaOperarioRow } from "./etapas-por-operario";
import { EtapaGantt, type EtapaHistorialRow } from "./etapa-gantt";
import { saturdayOfWeek } from "../programa/excel-utils";

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

function pct(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("es-CO");
}

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function daysAgoISO(days: number) {
  return format(new Date(Date.now() - days * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
}

// Resuelve el mes elegido (?mes=YYYY-MM) a un rango [inicio, fin) de
// fechas ISO, con mes anterior/siguiente ya calculados para la navegación.
// Sin parámetro (o uno inválido), cae en el mes calendario actual.
function monthRange(mesParam: string | undefined) {
  const now = new Date();
  const valid = mesParam && /^\d{4}-\d{2}$/.test(mesParam);
  const year = valid ? Number(mesParam.slice(0, 4)) : now.getFullYear();
  const month = valid ? Number(mesParam.slice(5, 7)) - 1 : now.getMonth();
  const start = new Date(year, month, 1);
  const label = format(start, "MMMM yyyy", { locale: es });
  return {
    mes: format(start, "yyyy-MM"),
    inicio: format(start, "yyyy-MM-dd"),
    fin: format(new Date(year, month + 1, 1), "yyyy-MM-dd"),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    prevMes: format(new Date(year, month - 1, 1), "yyyy-MM"),
    nextMes: format(new Date(year, month + 1, 1), "yyyy-MM"),
  };
}

function nowMs() {
  return Date.now();
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireRole(["jefe_planta", "supervisor", "planeacion", "asistente_adm"]);
  const { mes: mesParam } = await searchParams;
  const mesRango = monthRange(mesParam);
  const supabase = await createClient();

  const [
    [
      { data: vasosEnmangados },
      { data: profiles },
      { data: bachesCerrados },
      { data: todosBaches },
      { data: insumos },
      { data: envasados },
      { data: envasadoOrders },
      { data: productionOrders },
      { data: envasadoReferencias },
      { data: products },
      { data: stageTemplatesAll },
      { data: envasadoCortes },
      { data: envasadoEstibas },
      { data: equipos },
      { data: consumosServicios },
      { data: produccionHistorica },
      { data: consumosEnergia },
      { data: enmangadoReferencias },
    ],
    stageRecordsAll,
  ] = await Promise.all([
    Promise.all([
      supabase.from("vasos_enmangados").select("*"),
      supabase.from("profiles").select("*"),
      // batch_code hace falta para el histórico de tiempos por bache (debajo
      // del diagrama de Gantt de duración promedio).
      supabase
        .from("baches")
        .select("id, batch_code, product_id, started_at, completed_at")
        .eq("status", "completado")
        .not("completed_at", "is", null),
      // Para "kg producidos" hace falta CUALQUIER bache (no solo los ya
      // completados): la última etapa con checklist de insumos puede cerrarse
      // antes de que el bache entero se marque como terminado.
      supabase.from("baches").select("id, product_id, status, volumen_restante_litros"),
      supabase.from("insumos").select("id, name"),
      supabase
        .from("envasados")
        .select("id, bache_id, cantidad_unidades, referencia_id, presentacion, started_at, ended_at"),
      // Unidades programadas por semana (vs. las realmente empacadas) --
      // scheduled_date es la fecha planeada de la orden, no de ejecución.
      supabase.from("envasado_orders").select("scheduled_date, planned_quantity"),
      // Programado de "Bases (baches)", mismo origen que /cumplimiento:
      // baches_planeados x volumen_por_bache del producto.
      supabase.from("production_orders").select("product_id, scheduled_date, baches_planeados"),
      supabase.from("envasado_referencias").select("id, sku, name, peso_unitario"),
      supabase.from("products").select("id, name, requiere_envasado, volumen_por_bache"),
      supabase
        .from("process_stage_templates")
        .select("id, product_id, name, sequence_order, captures_insumos"),
      // Rendimiento por turno: cada corte tiene su propia ventana de tiempo
      // (no la del envasado completo, que puede tener huecos entre turnos) y
      // hasta dos operarios -- las unidades/hora se calculan por turno y se
      // le acreditan a los dos.
      supabase
        .from("envasado_cortes")
        .select("id, envasado_id, operario_id, operario_2_id, started_at, ended_at"),
      supabase.from("envasado_estibas").select("corte_id, unidades_por_estiba"),
      supabase.from("equipos").select("id, name").eq("active", true).order("name"),
      supabase
        .from("consumos_servicios")
        .select("fecha, gas_consumo_m3, agua_edificio_consumo_m3, agua_produccion_consumo_m3"),
      // Producción previa a la app (mayo-agosto 2026, cargada desde el Excel
      // que llevaba planta antes de este módulo) -- solo totales diarios, sin
      // desglose por producto/operario, para extender el histórico de abajo.
      supabase.from("produccion_historica").select("fecha, kilos_producidos, kilos_empacados"),
      // Energía: a diferencia de gas/agua (lectura diaria propia), viene
      // consolidada por mes de la factura compartida del edificio -- kwh_bodega
      // ya es la parte repartida que le toca a esta bodega.
      supabase.from("consumos_energia").select("mes, kwh_bodega"),
      supabase.from("enmangado_referencias").select("id, name"),
    ]),
    // bache_stage_records ya pasa de 1000 filas (el tope por pedido de
    // Supabase) -- sin paginar, esto se trunca solo y deja afuera los
    // baches más recientes de "kg producidos" y las demás estadísticas que
    // dependen de esta tabla.
    fetchAll<{
      bache_id: string;
      stage_template_id: string;
      operario_id: string;
      started_at: string;
      ended_at: string | null;
      parameters: StageRecordParameters;
    }>((from, to) =>
      supabase
        .from("bache_stage_records")
        .select("bache_id, stage_template_id, operario_id, started_at, ended_at, parameters")
        .range(from, to),
    ),
  ]);

  const operarioNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const requiereEnvasadoById = new Map((products ?? []).map((p) => [p.id, p.requiere_envasado]));
  const productVolumenById = new Map((products ?? []).map((p) => [p.id, p.volumen_por_bache]));
  const volumenRestanteById = new Map((todosBaches ?? []).map((b) => [b.id, b.volumen_restante_litros]));

  // -------------------------------------------------------------------
  // Ocupación de equipos: promedio POR DÍA (horas ocupado/desuso de un día
  // típico de 24 h), no el total acumulado de la semana -- se toman los
  // últimos 7 días como muestra para que un día suelto sin movimiento no
  // haga parecer que el equipo nunca se usa, pero el número que se
  // muestra es "por día", no "en la semana". usosDeEquipos ya suma la
  // hora de lavado después de cada uso (no cuenta como tiempo libre) y
  // extiende los tanques de almacenamiento hasta que termina de
  // envasarse el bache.
  // -------------------------------------------------------------------
  const DIAS_MUESTRA_OCUPACION = 7;
  const equiposCutoff = daysAgoISO(DIAS_MUESTRA_OCUPACION);
  const usosEquipos = await usosDeEquipos(supabase);
  const equiposCutoffMs = new Date(equiposCutoff).getTime();
  const ocupacionEquipos = (equipos ?? [])
    .map((equipo) => {
      const propios = usosEquipos.filter(
        (u) => u.equipoId === equipo.id && (u.enCurso || u.start >= equiposCutoff),
      );
      const horasOcupadoTotal = propios.reduce((sum, u) => {
        const start = new Date(u.start).getTime();
        const end = u.end ? new Date(u.end).getTime() : nowMs();
        return sum + Math.max(0, Math.min(end, nowMs()) - Math.max(start, equiposCutoffMs)) / 3_600_000;
      }, 0);
      const horasOcupado = horasOcupadoTotal / DIAS_MUESTRA_OCUPACION;
      const horasDesuso = Math.max(0, 24 - horasOcupado);
      return {
        equipoId: equipo.id,
        nombre: equipo.name,
        horasOcupado,
        horasDesuso,
        ocupacionPct: Math.min(100, Math.round((horasOcupado / 24) * 100)),
      };
    })
    .sort((a, b) => b.ocupacionPct - a.ocupacionPct);

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
  }

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

  // Histórico de tiempos por etapa y bache (para la tabla debajo del
  // Gantt de duración promedio): mismos datos de stageRecordsAll, pero sin
  // promediar -- un renglón por bache real, filtrable por producto ahí
  // mismo, mostrando los últimos 10 baches de ese producto.
  const bacheInfoById = new Map(
    (bachesCerrados ?? []).map((b) => [b.id, { batchCode: b.batch_code, startedAt: b.started_at }]),
  );
  const etapaHistorial: EtapaHistorialRow[] = [];
  for (const r of stageRecordsAll ?? []) {
    if (!r.ended_at) continue;
    const productId = bacheProductById.get(r.bache_id);
    const stage = stageInfoById.get(r.stage_template_id);
    const bacheInfo = bacheInfoById.get(r.bache_id);
    if (!productId || !stage || !bacheInfo) continue;
    const minutos = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000;
    etapaHistorial.push({
      productId,
      bacheId: r.bache_id,
      batchCode: bacheInfo.batchCode,
      startedAt: bacheInfo.startedAt,
      stageName: stage.name,
      sequenceOrder: stage.sequenceOrder,
      minutos,
    });
  }

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
    bacheId: string;
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
      const baseOtroBacheArr = record.parameters?.base_otro_bache;
      const kgTotal =
        insumosArr.reduce((s, i) => s + (Number(i.peso) || 0), 0) +
        (Array.isArray(baseOtroBacheArr)
          ? baseOtroBacheArr.reduce((s, b) => s + (Number(b.cantidad) || 0), 0)
          : 0);
      best = {
        order: stage.sequence_order,
        kg: kgTotal,
        date: record.ended_at.slice(0, 10),
        insumos: insumosArr,
      };
    }
    if (best) {
      kgProducidoEvents.push({
        bacheId: bache.id,
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

  // -------------------------------------------------------------------
  // Kilos producidos/empacados y las dos donas de participación se mueven
  // juntas con el mismo mes elegido (selector arriba, vía ?mes=YYYY-MM),
  // no una ventana móvil de 30 días -- es contra lo que se compara la
  // planeación mensual.
  // -------------------------------------------------------------------
  // Producción previa a septiembre 2026 no tiene baches/envasados en la app
  // (ver HISTORIAL_INICIO_MES más abajo) -- se completa con los totales
  // diarios cargados en produccion_historica. Sin solape con datos en vivo
  // (ese Excel llega hasta el 2026-08-29), así que sumar ambas fuentes no
  // duplica nada.
  function historicoEnRango(desde: string, hasta: string) {
    let producido = 0;
    let empacado = 0;
    for (const r of produccionHistorica ?? []) {
      if (r.fecha < desde || r.fecha >= hasta) continue;
      producido += r.kilos_producidos ?? 0;
      empacado += r.kilos_empacados ?? 0;
    }
    return { producido, empacado };
  }
  const historicoMesActual = historicoEnRango(mesRango.inicio, mesRango.fin);

  const kgProducidosMes =
    kgProducidoEvents
      .filter((e) => e.date >= mesRango.inicio && e.date < mesRango.fin)
      .reduce((s, e) => s + e.kg, 0) + historicoMesActual.producido;

  const kgEmpacadosMes =
    (envasados ?? [])
      .filter((e) => {
        const fecha = e.started_at.slice(0, 10);
        return fecha >= mesRango.inicio && fecha < mesRango.fin;
      })
      .reduce((s, e) => {
        const peso = pesoUnitarioDe(e);
        return peso ? s + (e.cantidad_unidades * peso) / 1000 : s;
      }, 0) + historicoMesActual.empacado;

  // Productos que no se envasan (ej. cremado, requiere_envasado = false) no
  // generan filas en "envasados" -- para ellos, "terminado" = el kg
  // resultante del balance de masa (mismo evento que kgProducidosMes). Se
  // suma aparte a "Kilos empacados" (es lo más parecido a su "producto
  // terminado") pero sin mezclarlo con el envasado real, para no perder la
  // distinción de qué es cada cosa.
  const kgCremadoMes = kgProducidoEvents
    .filter(
      (e) =>
        e.date >= mesRango.inicio &&
        e.date < mesRango.fin &&
        requiereEnvasadoById.get(e.productId) === false,
    )
    .reduce((s, e) => s + e.kg, 0);
  const kgEmpacadosTotalMes = kgEmpacadosMes + kgCremadoMes;
  const kgProducidosNormalMes = kgProducidosMes - kgCremadoMes;

  // -------------------------------------------------------------------
  // Merma de producción: balance de masa tipo inventario.
  //   inventario inicial del mes + producido el mes - empacado el mes
  //   = lo que debería quedar pendiente de empacar.
  // Si lo que REALMENTE queda pendiente (volumen_restante_litros de todos
  // los baches vivos, dato en vivo) es menos que eso, la diferencia es
  // masa perdida en el proceso (derrames, rechazos, diferencias de
  // pesaje). El cremado nunca cuenta como "pendiente" -- ya se cuenta
  // como terminado en cuanto se produce (no pasa por envasado).
  //
  // El inventario inicial del primer mes de esta métrica (octubre 2026) se
  // cargó a mano -- el sistema no tenía cómo saberlo antes de empezar a
  // medir esto -- con el inventario físico real reportado por planta al
  // cierre de septiembre 2026 (9.200 kg). De ahí en adelante se calcula
  // solo, arrastrando producido/empacado desde esa fecha de referencia.
  // -------------------------------------------------------------------
  const INVENTARIO_INICIAL_REFERENCIA_KG = 9200;
  const INVENTARIO_INICIAL_REFERENCIA_FECHA = "2026-10-01";

  function kgProducidoEnRango(desde: string, hasta: string) {
    const vivo = kgProducidoEvents
      .filter((e) => e.date >= desde && e.date < hasta)
      .reduce((s, e) => s + e.kg, 0);
    return vivo + historicoEnRango(desde, hasta).producido;
  }
  function kgEmpacadoEnRango(desde: string, hasta: string) {
    const envasado = (envasados ?? [])
      .filter((e) => {
        const fecha = e.started_at.slice(0, 10);
        return fecha >= desde && fecha < hasta;
      })
      .reduce((s, e) => {
        const peso = pesoUnitarioDe(e);
        return peso ? s + (e.cantidad_unidades * peso) / 1000 : s;
      }, 0);
    const cremado = kgProducidoEvents
      .filter(
        (e) => e.date >= desde && e.date < hasta && requiereEnvasadoById.get(e.productId) === false,
      )
      .reduce((s, e) => s + e.kg, 0);
    return envasado + cremado + historicoEnRango(desde, hasta).empacado;
  }

  const inventarioInicialMes =
    mesRango.inicio <= INVENTARIO_INICIAL_REFERENCIA_FECHA
      ? INVENTARIO_INICIAL_REFERENCIA_KG
      : INVENTARIO_INICIAL_REFERENCIA_KG +
        kgProducidoEnRango(INVENTARIO_INICIAL_REFERENCIA_FECHA, mesRango.inicio) -
        kgEmpacadoEnRango(INVENTARIO_INICIAL_REFERENCIA_FECHA, mesRango.inicio);

  const kgPendienteActual = (todosBaches ?? [])
    .filter((b) => b.status !== "cancelado" && requiereEnvasadoById.get(b.product_id) !== false)
    .reduce((s, b) => s + Math.max(0, b.volumen_restante_litros ?? 0), 0);

  // El balance "exacto" (inventario inicial arrastrado + pendiente EN VIVO)
  // solo tiene sentido para el mes actual -- el pendiente en vivo es "lo
  // que hay ahora", no "lo que había al cerrar" un mes que ya pasó. Si el
  // selector de mes apunta a un mes ya cerrado, usar el pendiente de hoy
  // mezcla movimiento de meses posteriores con ese mes y da una merma que
  // no corresponde. Para cualquier mes que no sea el actual se usa la
  // misma aproximación que el histórico de abajo (producido - empacado).
  const mesActualStr = format(new Date(), "yyyy-MM");
  const kgMermaMes =
    mesRango.mes === mesActualStr
      ? inventarioInicialMes + kgProducidosMes - kgPendienteActual - kgEmpacadosTotalMes
      : kgProducidosMes - kgEmpacadosTotalMes;
  const mermaPct = kgProducidosMes > 0 ? (kgMermaMes / kgProducidosMes) * 100 : null;

  // -------------------------------------------------------------------
  // Historial mes a mes para las 4 tarjetas de arriba -- independiente del
  // selector de mes (como la tendencia semanal de más abajo). Arranca en
  // mayo 2026 (primer mes con dato en produccion_historica, el Excel
  // previo a la app) y de ahí en más se extiende solo con cada mes que
  // pasa, mezclando el histórico de Excel con los datos en vivo desde que
  // existen (septiembre 2026 en adelante). La merma solo se puede calcular
  // "exacta" para el mes actual: los meses ya cerrados antes de octubre
  // 2026 no tienen un inventario inicial conocido (no existía esta
  // métrica todavía), así que usan la aproximación producido − empacado
  // más abajo. "Tiempo promedio de preparación" sigue arrancando en
  // septiembre 2026 nada más -- esa duración no está en el Excel
  // histórico, solo existe desde que la app registra baches.
  // -------------------------------------------------------------------
  const HISTORIAL_INICIO_MES = "2026-05";
  function mesesEntre(desde: string, hasta: string) {
    const out: string[] = [];
    let [y, m] = desde.split("-").map(Number);
    const [hy, hm] = hasta.split("-").map(Number);
    while (y < hy || (y === hy && m <= hm)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }
  function prepPromedioEnRango(desde: string, hasta: string) {
    const durs = (bachesCerrados ?? [])
      .filter((b) => b.completed_at)
      .filter((b) => {
        const fecha = b.completed_at!.slice(0, 10);
        return fecha >= desde && fecha < hasta;
      })
      .map((b) => (new Date(b.completed_at!).getTime() - new Date(b.started_at).getTime()) / 60000);
    return durs.length > 0 ? durs.reduce((s, v) => s + v, 0) / durs.length : null;
  }
  function bachesCerradosEnRango(desde: string, hasta: string) {
    return (bachesCerrados ?? []).filter(
      (b) => b.completed_at && b.completed_at.slice(0, 10) >= desde && b.completed_at.slice(0, 10) < hasta,
    ).length;
  }

  // -------------------------------------------------------------------
  // Cumplimiento del programa: unidades programadas (envasado_orders, por
  // fecha planeada) vs. unidades realmente empacadas (envasados, por fecha
  // de ejecución) -- mismo origen que el gráfico semanal de más abajo,
  // resumido en un solo %. Sin programa cargado para ese rango, null (no
  // "0%", que se leería como incumplimiento total).
  // -------------------------------------------------------------------
  function unidadesProgramadasEnRango(desde: string, hasta: string) {
    return (envasadoOrders ?? [])
      .filter((o) => o.scheduled_date >= desde && o.scheduled_date < hasta)
      .reduce((s, o) => s + (o.planned_quantity ?? 0), 0);
  }
  function unidadesEmpacadasEnRango(desde: string, hasta: string) {
    return (envasados ?? [])
      .filter((e) => {
        const fecha = e.started_at.slice(0, 10);
        return fecha >= desde && fecha < hasta;
      })
      .reduce((s, e) => s + e.cantidad_unidades, 0);
  }
  function pctCumplimiento(planned: number, executed: number) {
    if (planned > 0) return Math.round((executed / planned) * 100);
    return executed > 0 ? 100 : null;
  }
  const unidadesProgramadasMes = unidadesProgramadasEnRango(mesRango.inicio, mesRango.fin);
  const unidadesEmpacadasUnidMes = unidadesEmpacadasEnRango(mesRango.inicio, mesRango.fin);
  const cumplimientoPctMes = pctCumplimiento(unidadesProgramadasMes, unidadesEmpacadasUnidMes);

  const historialMeses = mesesEntre(HISTORIAL_INICIO_MES, mesActualStr).map((mesStr) => {
    const rango = monthRange(mesStr);
    const shortLabel = format(new Date(`${rango.inicio}T00:00:00`), "MMM", { locale: es });
    const kgProducido = kgProducidoEnRango(rango.inicio, rango.fin);
    const kgEmpacado = kgEmpacadoEnRango(rango.inicio, rango.fin);
    // El mes actual usa el balance completo (inventario inicial + pendiente
    // real en vivo, ver mermaPct arriba). Los meses anteriores no tienen
    // ese dato (no existía la métrica todavía), así que se aproxima con
    // producido - empacado nada más -- menos preciso, pero sirve para ver
    // la tendencia.
    const merma =
      mesStr === mesActualStr
        ? mermaPct
        : kgProducido > 0
          ? ((kgProducido - kgEmpacado) / kgProducido) * 100
          : null;
    const cumplimiento = pctCumplimiento(
      unidadesProgramadasEnRango(rango.inicio, rango.fin),
      unidadesEmpacadasEnRango(rango.inicio, rango.fin),
    );
    return {
      mes: mesStr,
      label: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
      avgPrepMin: prepPromedioEnRango(rango.inicio, rango.fin),
      kgProducido,
      kgEmpacado,
      merma,
      cumplimiento,
      baches: bachesCerradosEnRango(rango.inicio, rango.fin),
    };
  });

  // Baches cerrados antes de septiembre 2026 no existen en la app (ver
  // HISTORIAL_INICIO_MES arriba) -- se omiten esos meses en vez de mostrar
  // "0 baches", que se leería como que no se produjo nada.
  const bachesPorMes = historialMeses
    .filter((m) => m.baches > 0)
    .map((m) => {
      const label = format(new Date(`${m.mes}-01T00:00:00`), "MMMM yyyy", { locale: es });
      return { mes: m.mes, label: label.charAt(0).toUpperCase() + label.slice(1), baches: m.baches };
    })
    .reverse();

  const prepHistorialChart = historialMeses
    .filter((m): m is typeof m & { avgPrepMin: number } => m.avgPrepMin != null)
    .map((m) => ({ label: m.label, value: Math.round((m.avgPrepMin / 60) * 10) / 10 }));
  const producidoHistorialChart = historialMeses.map((m) => ({
    label: m.label,
    value: Math.round(m.kgProducido * 10) / 10,
  }));
  const empacadoHistorialChart = historialMeses.map((m) => ({
    label: m.label,
    value: Math.round(m.kgEmpacado * 10) / 10,
  }));
  const mermaHistorialChart = historialMeses
    .filter((m): m is typeof m & { merma: number } => m.merma != null)
    .map((m) => ({ label: m.label, value: Math.round(m.merma * 10) / 10 }));
  const cumplimientoHistorialChart = historialMeses
    .filter((m): m is typeof m & { cumplimiento: number } => m.cumplimiento != null)
    .map((m) => ({ label: m.label, value: m.cumplimiento }));

  const produccionPorProductoMap = new Map<string, number>();
  for (const e of kgProducidoEvents) {
    if (e.date < mesRango.inicio || e.date >= mesRango.fin) continue;
    produccionPorProductoMap.set(e.productId, (produccionPorProductoMap.get(e.productId) ?? 0) + e.kg);
  }
  const produccionPorProducto = Array.from(produccionPorProductoMap.entries())
    .map(([id, total]) => ({
      label: productNameById.get(id) ?? "Producto eliminado",
      value: Math.round(total * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  // -------------------------------------------------------------------
  // Bases (baches): programado vs. ejecutado por producto, mismo origen que
  // la tabla "Bases (baches)" de /cumplimiento (baches_planeados x
  // volumen_por_bache vs. el balance de masa de kgProducidoEvents), pero
  // resumido por producto nada más -- sin el desglose lote por lote.
  // -------------------------------------------------------------------
  const programadoBasesPorProductoMap = new Map<string, number>();
  for (const o of productionOrders ?? []) {
    if (o.scheduled_date < mesRango.inicio || o.scheduled_date >= mesRango.fin) continue;
    const volumen = productVolumenById.get(o.product_id);
    if (!o.baches_planeados || !volumen) continue;
    programadoBasesPorProductoMap.set(
      o.product_id,
      (programadoBasesPorProductoMap.get(o.product_id) ?? 0) + o.baches_planeados * volumen,
    );
  }
  const ejecutadoBasesPorProductoMap = new Map<string, { kg: number; baches: number }>();
  for (const e of kgProducidoEvents) {
    if (e.date < mesRango.inicio || e.date >= mesRango.fin) continue;
    const entry = ejecutadoBasesPorProductoMap.get(e.productId) ?? { kg: 0, baches: 0 };
    entry.kg += e.kg;
    entry.baches += 1;
    ejecutadoBasesPorProductoMap.set(e.productId, entry);
  }
  const basesCumplimientoIds = new Set([
    ...programadoBasesPorProductoMap.keys(),
    ...ejecutadoBasesPorProductoMap.keys(),
  ]);
  const basesCumplimientoPorProducto = Array.from(basesCumplimientoIds)
    .map((id) => {
      const planned = programadoBasesPorProductoMap.get(id) ?? 0;
      const ejecutado = ejecutadoBasesPorProductoMap.get(id) ?? { kg: 0, baches: 0 };
      return {
        id,
        nombre: productNameById.get(id) ?? "Producto eliminado",
        planned,
        executed: ejecutado.kg,
        baches: ejecutado.baches,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const basesTotalPlanned = basesCumplimientoPorProducto.reduce((s, r) => s + r.planned, 0);
  const basesTotalExecuted = basesCumplimientoPorProducto.reduce((s, r) => s + r.executed, 0);
  const basesTotalBaches = basesCumplimientoPorProducto.reduce((s, r) => s + r.baches, 0);
  function diffClass(diff: number) {
    if (diff < 0) return "text-destructive";
    if (diff > 0) return "text-emerald-600 dark:text-emerald-400";
    return "text-muted-foreground";
  }

  const empaquePorReferenciaMap = new Map<string, { nombre: string; total: number }>();
  for (const e of envasados ?? []) {
    const fecha = e.started_at.slice(0, 10);
    if (fecha < mesRango.inicio || fecha >= mesRango.fin) continue;
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
  // Top 5 insumos de materia prima más consumidos, del mes elegido arriba
  // (mismo selector que Kilos producidos/empacados) -- mismos eventos de
  // balance de masa de arriba, desglosados por insumo.
  // -------------------------------------------------------------------
  const topInsumosMap = new Map<string, number>();
  for (const e of kgProducidoEvents) {
    if (e.date < mesRango.inicio || e.date >= mesRango.fin) continue;
    for (const i of e.insumos) {
      topInsumosMap.set(i.insumo_id, (topInsumosMap.get(i.insumo_id) ?? 0) + (Number(i.peso) || 0));
    }
  }
  const topInsumos = Array.from(topInsumosMap.entries())
    .map(([id, total]) => ({ id, nombre: insumoNames.get(id) ?? "—", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // -------------------------------------------------------------------
  // Tendencia semanal (últimas 8 semanas, sábado a viernes): kg producidos
  // vs. kg empacados.
  // -------------------------------------------------------------------
  const currentWeek = saturdayOfWeek(todayISO());
  const weekStarts: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(`${currentWeek}T00:00:00`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weekStarts.push(d.toISOString().slice(0, 10));
  }
  const trendData: TrendDatum[] = weekStarts.map((weekStart) => {
    const producido = kgProducidoEvents
      .filter((e) => saturdayOfWeek(e.date) === weekStart)
      .reduce((s, e) => s + e.kg, 0);
    const empacado = (envasados ?? [])
      .filter((e) => saturdayOfWeek(e.started_at.slice(0, 10)) === weekStart)
      .reduce((s, e) => {
        const peso = pesoUnitarioDe(e);
        return peso ? s + (e.cantidad_unidades * peso) / 1000 : s;
      }, 0);
    return {
      label: format(new Date(`${weekStart}T00:00:00`), "d MMM", { locale: es }),
      a: Math.round(producido * 10) / 10,
      b: Math.round(empacado * 10) / 10,
    };
  });

  // Unidades programadas (envasado_orders, por fecha planeada) vs.
  // unidades realmente empacadas (envasados, por fecha de ejecución) --
  // mismas 8 semanas que el trend de kg de arriba, para comparar
  // cumplimiento del programa.
  const unidadesTrendData: TrendDatum[] = weekStarts.map((weekStart) => {
    const programado = (envasadoOrders ?? [])
      .filter((o) => saturdayOfWeek(o.scheduled_date) === weekStart)
      .reduce((s, o) => s + (o.planned_quantity ?? 0), 0);
    const empacado = (envasados ?? [])
      .filter((e) => saturdayOfWeek(e.started_at.slice(0, 10)) === weekStart)
      .reduce((s, e) => s + e.cantidad_unidades, 0);
    return {
      label: format(new Date(`${weekStart}T00:00:00`), "d MMM", { locale: es }),
      a: programado,
      b: empacado,
    };
  });

  // -------------------------------------------------------------------
  // Consumo de servicios públicos (gas, agua edificio, agua producción) por
  // mes -- independiente del selector de mes de arriba, muestra todo el
  // histórico cargado en /servicios (lecturas diarias de medidor).
  // -------------------------------------------------------------------
  const serviciosPorMesMap = new Map<
    string,
    { gas: number; aguaEdificio: number; aguaProduccion: number }
  >();
  for (const r of consumosServicios ?? []) {
    const mes = r.fecha.slice(0, 7);
    const entry = serviciosPorMesMap.get(mes) ?? {
      gas: 0,
      aguaEdificio: 0,
      aguaProduccion: 0,
    };
    entry.gas += r.gas_consumo_m3 ?? 0;
    entry.aguaEdificio += r.agua_edificio_consumo_m3 ?? 0;
    entry.aguaProduccion += r.agua_produccion_consumo_m3 ?? 0;
    serviciosPorMesMap.set(mes, entry);
  }
  // Tarjeta y gráficas van acordes al mismo selector de mes de arriba (no al
  // mes calendario actual), igual que Kilos producidos/empacados.
  const serviciosMesActual = serviciosPorMesMap.get(mesRango.mes) ?? {
    gas: 0,
    aguaEdificio: 0,
    aguaProduccion: 0,
  };
  function mesCorto(mes: string) {
    const s = format(new Date(`${mes}-01T00:00:00`), "MMM", { locale: es });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const serviciosHistorialAsc = Array.from(serviciosPorMesMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const gasHistorialChart = serviciosHistorialAsc.map(([mes, e]) => ({
    label: mesCorto(mes),
    value: Math.round(e.gas * 10) / 10,
  }));
  const aguaEdificioHistorialChart = serviciosHistorialAsc.map(([mes, e]) => ({
    label: mesCorto(mes),
    value: Math.round(e.aguaEdificio * 10) / 10,
  }));
  const aguaProduccionHistorialChart = serviciosHistorialAsc.map(([mes, e]) => ({
    label: mesCorto(mes),
    value: Math.round(e.aguaProduccion * 10) / 10,
  }));

  // -------------------------------------------------------------------
  // Energía: consolidada por mes de la factura (no por día), ver nota de la
  // consulta arriba. kwh_bodega es la parte ya repartida que le toca a esta
  // bodega -- null (no "0 kWh") cuando todavía no se carga la factura de ese
  // mes, para no leerse como "no se consumió nada".
  // -------------------------------------------------------------------
  const energiaPorMesMap = new Map<string, number>();
  for (const r of consumosEnergia ?? []) {
    if (r.kwh_bodega == null) continue;
    energiaPorMesMap.set(r.mes.slice(0, 7), r.kwh_bodega);
  }
  const energiaMesActual = energiaPorMesMap.get(mesRango.mes) ?? null;
  const energiaHistorialChart = Array.from(energiaPorMesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, kwh]) => ({ label: mesCorto(mes), value: Math.round(kwh * 10) / 10 }));

  // -------------------------------------------------------------------
  // Enmangado: unidades y unidades/hora por mes, directo de vasos_enmangados
  // (ya tiene el detalle real turno por turno, agosto 2026 en adelante) --
  // no de enmangado_historico_mensual (ese resumen quedó obsoleto apenas se
  // cargó el detalle real). Las horas sólo cuentan vasos con ended_at (todo
  // lo histórico lo tiene; un enmangado en vivo todavía sin cerrar, no).
  // -------------------------------------------------------------------
  const enmangadoReferenciaNameById = new Map(
    (enmangadoReferencias ?? []).map((r) => [r.id, r.name]),
  );
  const enmangadoPorMesMap = new Map<string, { unidades: number; horas: number }>();
  for (const v of vasosEnmangados ?? []) {
    if (!v.ended_at) continue;
    const mes = v.started_at.slice(0, 7);
    const horas = (new Date(v.ended_at).getTime() - new Date(v.started_at).getTime()) / 3_600_000;
    const entry = enmangadoPorMesMap.get(mes) ?? { unidades: 0, horas: 0 };
    entry.unidades += v.cantidad_unidades;
    if (horas > 0) entry.horas += horas;
    enmangadoPorMesMap.set(mes, entry);
  }
  const enmangadoMesActualRaw = enmangadoPorMesMap.get(mesRango.mes) ?? null;
  const enmangadoMesActual = enmangadoMesActualRaw
    ? {
        unidades: enmangadoMesActualRaw.unidades,
        unidadesPorHora:
          enmangadoMesActualRaw.horas > 0
            ? enmangadoMesActualRaw.unidades / enmangadoMesActualRaw.horas
            : null,
      }
    : null;
  const enmangadoHistorialAsc = Array.from(enmangadoPorMesMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const enmangadoUnidadesHistorialChart = enmangadoHistorialAsc.map(([mes, e]) => ({
    label: mesCorto(mes),
    value: e.unidades,
  }));
  const enmangadoPorHoraHistorialChart = enmangadoHistorialAsc
    .filter(([, e]) => e.horas > 0)
    .map(([mes, e]) => ({ label: mesCorto(mes), value: Math.round((e.unidades / e.horas) * 10) / 10 }));

  // Participación por referencia enmangada del mes elegido arriba (mismo
  // selector que Kilos producidos/empacados).
  const enmangadoPorReferenciaMap = new Map<string, number>();
  for (const v of vasosEnmangados ?? []) {
    const mes = v.started_at.slice(0, 7);
    if (mes !== mesRango.mes) continue;
    enmangadoPorReferenciaMap.set(
      v.referencia_id,
      (enmangadoPorReferenciaMap.get(v.referencia_id) ?? 0) + v.cantidad_unidades,
    );
  }
  const enmangadoPorReferencia = Array.from(enmangadoPorReferenciaMap.entries())
    .map(([id, total]) => ({
      label: enmangadoReferenciaNameById.get(id) ?? "Referencia eliminada",
      value: total,
    }))
    .sort((a, b) => b.value - a.value);

  // -------------------------------------------------------------------
  // Eficiencia por kilo empacado: agua de producción, gas y energía sobre
  // los kg empacados de ESE mes (mismo kgEmpacadoEnRango de la merma de
  // arriba, ya mezcla histórico de Excel + datos en vivo). El agua de
  // edificio queda afuera -- no es consumo de producción.
  // -------------------------------------------------------------------
  function ratioPorKg(valor: number | null, kgEmp: number) {
    if (valor == null || kgEmp <= 0) return null;
    return valor / kgEmp;
  }
  function fmtRatio(valor: number) {
    return (Math.round(valor * 1000) / 1000).toLocaleString("es-CO");
  }
  const kgEmpacadosMesActual = kgEmpacadoEnRango(mesRango.inicio, mesRango.fin);
  const aguaPorKgMes = ratioPorKg(serviciosMesActual.aguaProduccion * 1000, kgEmpacadosMesActual);
  const gasPorKgMes = ratioPorKg(serviciosMesActual.gas, kgEmpacadosMesActual);
  const energiaPorKgMes = ratioPorKg(energiaMesActual, kgEmpacadosMesActual);

  const mesesParaRatio = Array.from(
    new Set([...serviciosPorMesMap.keys(), ...energiaPorMesMap.keys()]),
  ).sort();
  const aguaPorKgHistorialChart: { label: string; value: number }[] = [];
  const gasPorKgHistorialChart: { label: string; value: number }[] = [];
  const energiaPorKgHistorialChart: { label: string; value: number }[] = [];
  for (const mesStr of mesesParaRatio) {
    const rango = monthRange(mesStr);
    const kgEmp = kgEmpacadoEnRango(rango.inicio, rango.fin);
    const servicios = serviciosPorMesMap.get(mesStr);
    const agua = servicios ? ratioPorKg(servicios.aguaProduccion * 1000, kgEmp) : null;
    const gas = servicios ? ratioPorKg(servicios.gas, kgEmp) : null;
    const energia = ratioPorKg(energiaPorMesMap.get(mesStr) ?? null, kgEmp);
    if (agua != null) aguaPorKgHistorialChart.push({ label: mesCorto(mesStr), value: Math.round(agua * 1000) / 1000 });
    if (gas != null) gasPorKgHistorialChart.push({ label: mesCorto(mesStr), value: Math.round(gas * 1000) / 1000 });
    if (energia != null) energiaPorKgHistorialChart.push({ label: mesCorto(mesStr), value: Math.round(energia * 1000) / 1000 });
  }

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

  // -------------------------------------------------------------------
  // Tiempo promedio de empaque por bache: duración completa de cada
  // envasado (inicio a fin), planta completa -- del mes elegido arriba
  // (mismo selector que Kilos producidos/empacados).
  // -------------------------------------------------------------------
  const empaqueDurations = (envasados ?? [])
    .filter((e) => {
      if (!e.ended_at) return false;
      const fecha = e.started_at.slice(0, 10);
      return fecha >= mesRango.inicio && fecha < mesRango.fin;
    })
    .map((e) => (new Date(e.ended_at!).getTime() - new Date(e.started_at).getTime()) / 60000);
  const avgEmpaqueMinutes =
    empaqueDurations.length > 0
      ? empaqueDurations.reduce((s, v) => s + v, 0) / empaqueDurations.length
      : null;

  // -------------------------------------------------------------------
  // Unidades por hora por operario: se calcula por TURNO (envasado_cortes),
  // no por el envasado completo -- mide qué tan rápido produce cada
  // operario mientras está activamente trabajando. Cada turno acredita sus
  // unidades/hora a los dos operarios que lo trabajaron (operario_id y
  // operario_2_id), no solo a quien arrancó la máquina.
  // -------------------------------------------------------------------
  const unidadesPorCorte = new Map<string, number>();
  for (const es of envasadoEstibas ?? []) {
    unidadesPorCorte.set(
      es.corte_id,
      (unidadesPorCorte.get(es.corte_id) ?? 0) + (es.unidades_por_estiba ?? 0),
    );
  }
  // Para saber de qué REFERENCIA de envasado (presentación, ej. 450g vs
  // 1000g) es cada turno: corte -> envasado -> referencia (misma
  // resolución que el resto de la página: por referencia_id, si no por el
  // texto de la presentación, y si no por el nombre de la referencia).
  const referenciaByEnvasadoId = new Map((envasados ?? []).map((e) => [e.id, referenciaDe(e)]));

  const rendimientoPorOperario = new Map<
    string,
    { horas: number; unidades: number; eventos: number }
  >();
  const rendimientoPorReferencia = new Map<
    string,
    { nombre: string; horas: number; unidades: number; eventos: number }
  >();
  for (const c of envasadoCortes ?? []) {
    if (!c.ended_at) continue;
    const fechaCorte = c.started_at.slice(0, 10);
    if (fechaCorte < mesRango.inicio || fechaCorte >= mesRango.fin) continue;
    const horas = (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 3_600_000;
    if (horas <= 0) continue;
    const unidades = unidadesPorCorte.get(c.id) ?? 0;
    for (const opId of [c.operario_id, c.operario_2_id]) {
      if (!opId) continue;
      const entry = rendimientoPorOperario.get(opId) ?? { horas: 0, unidades: 0, eventos: 0 };
      entry.horas += horas;
      entry.unidades += unidades;
      entry.eventos += 1;
      rendimientoPorOperario.set(opId, entry);
    }
    const referencia = referenciaByEnvasadoId.get(c.envasado_id);
    if (referencia) {
      const entry = rendimientoPorReferencia.get(referencia.id) ?? {
        nombre: referencia.name,
        horas: 0,
        unidades: 0,
        eventos: 0,
      };
      entry.horas += horas;
      entry.unidades += unidades;
      entry.eventos += 1;
      rendimientoPorReferencia.set(referencia.id, entry);
    }
  }
  const rendimientoTurnos = Array.from(rendimientoPorOperario.entries())
    .map(([operarioId, e]) => ({
      operarioId,
      nombre: operarioNames.get(operarioId) ?? "—",
      horas: e.horas,
      unidades: e.unidades,
      unidadesPorHora: e.horas > 0 ? e.unidades / e.horas : 0,
    }))
    .sort((a, b) => b.unidadesPorHora - a.unidadesPorHora);

  // Mismo cálculo que arriba, pero por referencia de envasado (presentación,
  // ej. 450g vs 1000g) en vez de por operario -- para comparar cuál rinde
  // más rápido.
  const rendimientoPorReferenciaArr = Array.from(rendimientoPorReferencia.entries())
    .map(([referenciaId, e]) => ({
      referenciaId,
      nombre: e.nombre,
      eventos: e.eventos,
      horas: e.horas,
      unidades: e.unidades,
      unidadesPorHora: e.horas > 0 ? e.unidades / e.horas : 0,
    }))
    .sort((a, b) => b.unidadesPorHora - a.unidadesPorHora);

  // Envasado por operario: mismo origen que "unidades/hora por turno"
  // (envasado_cortes + envasado_estibas), no el envasado completo -- cada
  // turno acredita sus unidades a los dos operarios que lo trabajaron, en
  // vez de cargarle todo el envasado a quien lo inició.
  const envasadoPorOperario = Array.from(rendimientoPorOperario.entries())
    .map(([operarioId, e]) => ({
      operarioId,
      nombre: operarioNames.get(operarioId) ?? "—",
      eventos: e.eventos,
      unidades: e.unidades,
    }))
    .sort((a, b) => b.unidades - a.unidades);

  // -------------------------------------------------------------------
  // Unidades por hora de planta: acá sí se mide el ciclo completo -- desde
  // que arranca el primer envasado del bache hasta que se cierra el último
  // marcando "no queda más base" (volumen_restante_litros en 0), incluidos
  // los huecos entre turnos, porque es el tiempo real que tarda la planta
  // en terminar de envasar un bache. Del mes elegido arriba.
  // -------------------------------------------------------------------
  const envasadosPorBache = new Map<
    string,
    { starts: string[]; ends: (string | null)[]; unidades: number }
  >();
  for (const e of envasados ?? []) {
    const fecha = e.started_at.slice(0, 10);
    if (fecha < mesRango.inicio || fecha >= mesRango.fin) continue;
    const entry = envasadosPorBache.get(e.bache_id) ?? { starts: [], ends: [], unidades: 0 };
    entry.starts.push(e.started_at);
    entry.ends.push(e.ended_at);
    entry.unidades += e.cantidad_unidades;
    envasadosPorBache.set(e.bache_id, entry);
  }
  let horasPlanta = 0;
  let unidadesPlanta = 0;
  for (const [bacheId, data] of envasadosPorBache) {
    if (data.ends.some((end) => !end)) continue; // todavía hay envasado en curso
    if (volumenRestanteById.get(bacheId) !== 0) continue; // no confirmaron "no queda más base"
    const start = Math.min(...data.starts.map((s) => new Date(s).getTime()));
    const end = Math.max(...data.ends.map((e) => new Date(e!).getTime()));
    const horas = (end - start) / 3_600_000;
    if (horas <= 0) continue;
    horasPlanta += horas;
    unidadesPlanta += data.unidades;
  }
  const unidadesPorHoraPlanta = horasPlanta > 0 ? unidadesPlanta / horasPlanta : null;

  const envasadoChartData = envasadoPorOperario.map((s) => ({
    label: s.nombre,
    value: s.unidades,
  }));
  const enmangadoChartData = enmangadoStats.map((s) => ({
    label: s.operario_name,
    value: s.total_unidades,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Estadísticas</h1>
          <p className="text-muted-foreground">
            Indicadores de planta y desempeño por operario y por proceso.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          icon={<Clock className="size-5" />}
          label="Tiempo promedio de preparación"
          value={minutesLabel(avgPrepMinutes)}
          sublabel={`${prepDurations.length} bache${prepDurations.length === 1 ? "" : "s"} cerrados`}
          data={prepHistorialChart}
          unit="h"
        />
        <KpiCard
          icon={<Percent className="size-5" />}
          label="Merma de producción"
          value={mermaPct != null ? `${pct(mermaPct)}%` : "—"}
          sublabel={`${kg(kgMermaMes)} kg sobre ${kg(kgProducidosMes)} kg producidos`}
          data={mermaHistorialChart}
          unit="%"
        />
        <KpiCard
          icon={<Target className="size-5" />}
          label="Cumplimiento del programa"
          value={cumplimientoPctMes != null ? `${cumplimientoPctMes}%` : "—"}
          sublabel={`${kg(unidadesEmpacadasUnidMes)} und sobre ${kg(unidadesProgramadasMes)} und programadas`}
          data={cumplimientoHistorialChart}
          unit="%"
        />
        <KpiCard
          icon={<Package className="size-5" />}
          label="Kilos producidos"
          value={`${kg(kgProducidosMes)} kg`}
          sublabel={
            kgCremadoMes > 0 ? (
              <>
                {mesRango.label} · Producción {kg(kgProducidosNormalMes)} kg + Cremado{" "}
                {kg(kgCremadoMes)} kg
              </>
            ) : (
              mesRango.label
            )
          }
          data={producidoHistorialChart}
          unit="kg"
        />
        <KpiCard
          icon={<PackageCheck className="size-5" />}
          label="Kilos empacados"
          value={`${kg(kgEmpacadosTotalMes)} kg`}
          sublabel={
            kgCremadoMes > 0 ? (
              <>
                {mesRango.label} · Envasado {kg(kgEmpacadosMes)} kg + Cremado {kg(kgCremadoMes)} kg
              </>
            ) : (
              mesRango.label
            )
          }
          data={empacadoHistorialChart}
          unit="kg"
        />
      </div>

      <div className="flex items-center justify-end gap-2 print:hidden">
        <Link
          href={`/estadisticas?mes=${mesRango.prevMes}`}
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          title="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-36 text-center text-sm font-medium">{mesRango.label}</span>
        <Link
          href={`/estadisticas?mes=${mesRango.nextMes}`}
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          title="Mes siguiente"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Producción vs. empaque por semana</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.some((d) => d.a > 0 || d.b > 0) ? (
            <TrendChart data={trendData} nameA="Kg producidos" nameB="Kg empacados" unit="kg" />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unidades programadas vs. empacadas por semana</CardTitle>
        </CardHeader>
        <CardContent>
          {unidadesTrendData.some((d) => d.a > 0 || d.b > 0) ? (
            <TrendChart
              data={unidadesTrendData}
              nameA="Und. programadas"
              nameB="Und. empacadas"
              unit="u"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Consumo de servicios públicos ({mesRango.label})</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={<Flame className="size-5" />}
            label="Gas"
            value={`${kg(serviciosMesActual.gas)} m³`}
            sublabel={mesRango.label}
            data={gasHistorialChart}
            unit="m³"
          />
          <KpiCard
            icon={<Building2 className="size-5" />}
            label="Agua edificio"
            value={`${kg(serviciosMesActual.aguaEdificio)} m³`}
            sublabel={mesRango.label}
            data={aguaEdificioHistorialChart}
            unit="m³"
          />
          <KpiCard
            icon={<Droplet className="size-5" />}
            label="Agua producción"
            value={`${kg(serviciosMesActual.aguaProduccion)} m³`}
            sublabel={mesRango.label}
            data={aguaProduccionHistorialChart}
            unit="m³"
          />
          <KpiCard
            icon={<Zap className="size-5" />}
            label="Energía"
            value={energiaMesActual != null ? `${kg(energiaMesActual)} kWh` : "—"}
            sublabel={mesRango.label}
            data={energiaHistorialChart}
            unit="kWh"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Eficiencia por kilo empacado ({mesRango.label})
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <KpiCard
            icon={<Droplet className="size-5" />}
            label="Agua de producción"
            value={aguaPorKgMes != null ? `${fmtRatio(aguaPorKgMes)} L/kg` : "—"}
            sublabel={mesRango.label}
            data={aguaPorKgHistorialChart}
            unit="L/kg"
          />
          <KpiCard
            icon={<Flame className="size-5" />}
            label="Gas"
            value={gasPorKgMes != null ? `${fmtRatio(gasPorKgMes)} m³/kg` : "—"}
            sublabel={mesRango.label}
            data={gasPorKgHistorialChart}
            unit="m³/kg"
          />
          <KpiCard
            icon={<Zap className="size-5" />}
            label="Energía"
            value={energiaPorKgMes != null ? `${fmtRatio(energiaPorKgMes)} kWh/kg` : "—"}
            sublabel={mesRango.label}
            data={energiaPorKgHistorialChart}
            unit="kWh/kg"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Enmangado ({mesRango.label})</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <KpiCard
            icon={<Layers className="size-5" />}
            label="Unidades enmangadas"
            value={enmangadoMesActual != null ? `${kg(enmangadoMesActual.unidades)} und` : "—"}
            sublabel={mesRango.label}
            data={enmangadoUnidadesHistorialChart}
            unit="und"
          />
          <KpiCard
            icon={<Gauge className="size-5" />}
            label="Unidades por hora"
            value={
              enmangadoMesActual?.unidadesPorHora != null
                ? `${kg(enmangadoMesActual.unidadesPorHora)} und/h`
                : "—"
            }
            sublabel={mesRango.label}
            data={enmangadoPorHoraHistorialChart}
            unit="und/h"
          />
        </div>
        <ExpandableCard
          title={`Participación por referencia enmangada (${mesRango.label})`}
          expanded={
            enmangadoPorReferencia.length > 0 ? (
              <ShareChart data={enmangadoPorReferencia} unit="und" height={420} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin enmangados registrados este mes.</p>
            )
          }
        >
          {enmangadoPorReferencia.length > 0 ? (
            <ShareChart data={enmangadoPorReferencia} unit="und" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin enmangados registrados este mes.
            </p>
          )}
        </ExpandableCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bases (baches) — {mesRango.label}</CardTitle>
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
              {basesCumplimientoPorProducto.map((r) => {
                const diff = Math.round((r.executed - r.planned) * 10) / 10;
                const rowPct = pctCumplimiento(r.planned, r.executed);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{kg(r.planned)} kg</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kg(r.executed)} kg
                      {r.baches > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({r.baches} bache{r.baches === 1 ? "" : "s"})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${diffClass(diff)}`}>
                      {diff > 0 ? "+" : ""}
                      {kg(diff)} kg
                    </TableCell>
                    <TableCell className="text-right">
                      {rowPct != null ? (
                        <Badge variant={rowPct >= 100 ? "default" : "outline"}>{rowPct}%</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {basesCumplimientoPorProducto.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Sin baches programados ni producidos este mes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {basesCumplimientoPorProducto.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{kg(basesTotalPlanned)} kg</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {kg(basesTotalExecuted)} kg
                    {basesTotalBaches > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({basesTotalBaches} bache{basesTotalBaches === 1 ? "" : "s"})
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${diffClass(Math.round((basesTotalExecuted - basesTotalPlanned) * 10) / 10)}`}
                  >
                    {basesTotalExecuted - basesTotalPlanned > 0 ? "+" : ""}
                    {kg(basesTotalExecuted - basesTotalPlanned)} kg
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const totalPct = pctCumplimiento(basesTotalPlanned, basesTotalExecuted);
                      return totalPct != null ? (
                        <Badge variant={totalPct >= 100 ? "default" : "outline"}>{totalPct}%</Badge>
                      ) : (
                        "—"
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpandableCard
          title={`Participación por producto (${mesRango.label})`}
          expanded={
            produccionPorProducto.length > 0 ? (
              <ShareChart data={produccionPorProducto} unit="kg" height={420} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin producción registrada este mes.</p>
            )
          }
        >
          {produccionPorProducto.length > 0 ? (
            <ShareChart data={produccionPorProducto} unit="kg" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin producción registrada este mes.
            </p>
          )}
        </ExpandableCard>

        <ExpandableCard
          title={`Participación por referencia de envasado (${mesRango.label})`}
          expanded={
            empaquePorReferencia.length > 0 ? (
              <ShareChart data={empaquePorReferencia} unit="kg" height={420} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin envasado registrado este mes.</p>
            )
          }
        >
          {empaquePorReferencia.length > 0 ? (
            <ShareChart data={empaquePorReferencia} unit="kg" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin envasado registrado este mes.
            </p>
          )}
        </ExpandableCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpandableCard title="Baches cerrados por mes">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Baches cerrados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bachesPorMes.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.baches}</TableCell>
                </TableRow>
              ))}
              {bachesPorMes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin baches cerrados todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ExpandableCard>

        <ExpandableCard title="Tiempo de preparación por producto">
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
        </ExpandableCard>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materia prima más consumida ({mesRango.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Consumo</TableHead>
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
                      Sin consumo registrado este mes.
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
          <EtapaGantt rows={duracionPorEtapaYProducto} historial={etapaHistorial} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ocupación de equipos (promedio diario)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-right">Ocupación</TableHead>
                <TableHead className="text-right">Horas ocupado/día</TableHead>
                <TableHead className="text-right">Horas en desuso/día</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ocupacionEquipos.map((o) => (
                <TableRow key={o.equipoId}>
                  <TableCell className="font-medium">{o.nombre}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={o.ocupacionPct > 70 ? "default" : "outline"}>
                      {o.ocupacionPct}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(Math.round(o.horasOcupado * 10) / 10).toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(Math.round(o.horasDesuso * 10) / 10).toLocaleString("es-CO")}
                  </TableCell>
                </TableRow>
              ))}
              {ocupacionEquipos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin equipos configurados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            Promedio de un día típico (24 h), calculado sobre los últimos 7 días para que un
            día suelto sin movimiento no distorsione el número. Incluye 1 hora de lavado
            después de cada uso (no cuenta como tiempo libre) y, para tanques de
            almacenamiento, el tiempo hasta que se termina de envasar todo el bache (no solo la
            etapa donde se eligió el tanque). Detalle y línea de tiempo en Equipos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rendimiento de envasado ({mesRango.label})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col rounded-lg border p-3">
              <span className="text-xs text-muted-foreground">Tiempo promedio de empaque por bache</span>
              <span className="text-xl font-semibold tabular-nums">
                {minutesLabel(avgEmpaqueMinutes)}
              </span>
              <span className="text-xs text-muted-foreground">
                {empaqueDurations.length} envasado{empaqueDurations.length === 1 ? "" : "s"} finalizados
              </span>
            </div>
            <div className="flex flex-col rounded-lg border p-3">
              <span className="text-xs text-muted-foreground">Unidades promedio por hora (planta)</span>
              <span className="text-xl font-semibold tabular-nums">
                {unidadesPorHoraPlanta != null ? Math.round(unidadesPorHoraPlanta).toLocaleString("es-CO") : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                Desde que arranca el envasado hasta que se cierra el bache
              </span>
            </div>
          </div>

          <p className="text-sm font-medium">Por operario</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operario</TableHead>
                <TableHead className="text-right">Horas activas</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Unidades/hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rendimientoTurnos.map((r) => (
                <TableRow key={r.operarioId}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(Math.round(r.horas * 10) / 10).toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.unidades.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(r.unidadesPorHora).toLocaleString("es-CO")}
                  </TableCell>
                </TableRow>
              ))}
              {rendimientoTurnos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin turnos de envasado cerrados todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <p className="text-sm font-medium">Por referencia de envasado</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Turnos</TableHead>
                <TableHead className="text-right">Horas activas</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Unidades/hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rendimientoPorReferenciaArr.map((r) => (
                <TableRow key={r.referenciaId}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.eventos}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(Math.round(r.horas * 10) / 10).toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.unidades.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(r.unidadesPorHora).toLocaleString("es-CO")}
                  </TableCell>
                </TableRow>
              ))}
              {rendimientoPorReferenciaArr.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Sin turnos de envasado cerrados todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Las unidades/hora se calculan por turno (no por el envasado completo, que puede tener
            huecos entre turnos); por operario se acreditan a los dos que lo trabajaron, y por
            referencia, a la presentación que se estaba envasando en ese turno.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envasado por operario ({mesRango.label})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {envasadoChartData.length > 0 && (
              <OperarioBarChart data={envasadoChartData} />
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operario</TableHead>
                  <TableHead>Turnos</TableHead>
                  <TableHead>Unidades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envasadoPorOperario.map((row) => (
                  <TableRow key={row.operarioId}>
                    <TableCell className="font-medium">{row.nombre}</TableCell>
                    <TableCell>{row.eventos}</TableCell>
                    <TableCell>{row.unidades}</TableCell>
                  </TableRow>
                ))}
                {envasadoPorOperario.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Sin turnos de envasado cerrados todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Se cuenta por turno (envasado_cortes), no por el envasado completo: cada turno
              acredita sus unidades a los dos operarios que lo trabajaron.
            </p>
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
