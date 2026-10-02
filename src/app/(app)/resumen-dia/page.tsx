import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTime } from "@/lib/format-date";
import { ORDER_STATUS_CLASSES } from "../programa/order-status-styles";

const TIME_ZONE = "America/Bogota";

function toISO(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function todayISO(): string {
  return toISO(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function horaBogota(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

interface TurnoRow {
  id: string;
  name: string;
  hora_inicio: string;
  hora_fin: string;
}

// Los turnos pueden cruzar medianoche (Turno C: 22:00–06:00), por eso no
// alcanza con comparar "inicio <= hora < fin" en todos los casos.
function turnoForHora(hhmm: string, turnos: TurnoRow[]): string | null {
  for (const t of turnos) {
    const inicio = t.hora_inicio.slice(0, 5);
    const fin = t.hora_fin.slice(0, 5);
    if (inicio <= fin) {
      if (hhmm >= inicio && hhmm < fin) return t.id;
    } else if (hhmm >= inicio || hhmm < fin) {
      return t.id;
    }
  }
  return null;
}

function pctBadgeClass(pct: number | null): string {
  if (pct == null) return "border-muted-foreground/30 bg-muted text-muted-foreground";
  if (pct >= 100) return ORDER_STATUS_CLASSES.completado;
  if (pct > 0) return ORDER_STATUS_CLASSES.en_proceso;
  return ORDER_STATUS_CLASSES.pendiente;
}

export default async function ResumenDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireRole(["jefe_planta", "supervisor"]);
  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : todayISO();

  const supabase = await createClient();

  const [
    { data: productionOrders },
    { data: envasadoOrders },
    { data: products },
    { data: envasadoReferencias },
    { data: turnos },
    { data: profiles },
    { data: cortes },
  ] = await Promise.all([
    supabase.from("production_orders").select("*").eq("scheduled_date", fecha),
    supabase.from("envasado_orders").select("*").eq("scheduled_date", fecha),
    supabase.from("products").select("id, name"),
    supabase.from("envasado_referencias").select("id, sku, name"),
    supabase.from("turnos").select("*").eq("active", true).order("hora_inicio"),
    supabase.from("profiles").select("id, full_name"),
    // Actividad REAL del día, por hora de inicio en Bogotá (NO por la
    // columna "fecha" de envasado_cortes: su default es current_date del
    // servidor, que corre en UTC -- un corte del Turno C que arranca
    // pasadas las 7pm Bogotá ya cae en el día siguiente en UTC, y quedaba
    // mal fechado). Así, un corte que arranca a las 11pm de "fecha" queda
    // en "fecha" aunque termine ya entrada la madrugada del día siguiente.
    supabase
      .from("envasado_cortes")
      .select("*")
      .gte("started_at", `${fecha}T05:00:00.000Z`)
      .lt("started_at", `${addDaysISO(fecha, 1)}T05:00:00.000Z`),
  ]);

  const productionOrderIds = (productionOrders ?? []).map((o) => o.id);
  const envasadoOrderIds = (envasadoOrders ?? []).map((o) => o.id);
  const corteEnvasadoIds = Array.from(new Set((cortes ?? []).map((c) => c.envasado_id)));
  const corteIds = (cortes ?? []).map((c) => c.id);

  const [
    { data: baches },
    { data: envasadosDeOrdenes },
    { data: envasadosDeCortes },
    { data: estibas },
  ] = await Promise.all([
    productionOrderIds.length > 0
      ? supabase
          .from("baches")
          .select("id, production_order_id, status, volumen_total_litros")
          .in("production_order_id", productionOrderIds)
      : Promise.resolve({ data: [] as { id: string; production_order_id: string | null; status: string; volumen_total_litros: number | null }[] }),
    envasadoOrderIds.length > 0
      ? supabase
          .from("envasados")
          .select("id, envasado_order_id, cantidad_unidades")
          .in("envasado_order_id", envasadoOrderIds)
      : Promise.resolve({ data: [] as { id: string; envasado_order_id: string | null; cantidad_unidades: number }[] }),
    corteEnvasadoIds.length > 0
      ? supabase
          .from("envasados")
          .select("id, bache_id, envasado_order_id, referencia_id, presentacion")
          .in("id", corteEnvasadoIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            bache_id: string;
            envasado_order_id: string | null;
            referencia_id: string | null;
            presentacion: string;
          }[],
        }),
    corteIds.length > 0
      ? supabase.from("envasado_estibas").select("corte_id, unidades_por_estiba").in("corte_id", corteIds)
      : Promise.resolve({ data: [] as { corte_id: string; unidades_por_estiba: number | null }[] }),
  ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const referenciasById = new Map((envasadoReferencias ?? []).map((r) => [r.id, r]));
  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const turnosList = turnos ?? [];

  // ---------------------------------------------------------------------
  // Baches: el turno se asigna según la HORA PLANEADA de inicio (no la
  // real), que es el dato que ya conoce el supervisor antes de que el
  // bache arranque.
  // ---------------------------------------------------------------------
  const bachesPorOrder = new Map<string, typeof baches>();
  for (const b of baches ?? []) {
    if (!b.production_order_id) continue;
    const arr = bachesPorOrder.get(b.production_order_id) ?? [];
    arr.push(b);
    bachesPorOrder.set(b.production_order_id, arr);
  }

  const bachesPlan = (productionOrders ?? []).map((order) => {
    const realList = bachesPorOrder.get(order.id) ?? [];
    const reales = realList.filter((b) => b.status !== "cancelado").length;
    const volumenReal = realList
      .filter((b) => b.status !== "cancelado")
      .reduce((sum, b) => sum + (b.volumen_total_litros ?? 0), 0);
    const planeados = order.baches_planeados;
    const pct =
      planeados && planeados > 0
        ? Math.round((reales / planeados) * 100)
        : order.planned_quantity && order.planned_quantity > 0
          ? Math.round((volumenReal / order.planned_quantity) * 100)
          : null;
    const turnoId = order.hora_inicio_planeada
      ? turnoForHora(horaBogota(order.hora_inicio_planeada), turnosList)
      : null;
    return {
      id: order.id,
      productName: productNames.get(order.product_id) ?? "—",
      ordenCodigo: order.orden_codigo,
      horaPlaneada: order.hora_inicio_planeada,
      planeados,
      plannedQuantity: order.planned_quantity,
      unit: order.unit,
      reales,
      pct,
      turnoId,
    };
  });
  const bachesSinHora = bachesPlan.filter((b) => !b.horaPlaneada);

  // ---------------------------------------------------------------------
  // Envasado: cumplido por orden (día completo, con todo lo capturado
  // contra ella), sin importar en qué turno se produjo cada unidad.
  // ---------------------------------------------------------------------
  const producidasPorOrdenEnvasado = new Map<string, number>();
  for (const e of envasadosDeOrdenes ?? []) {
    if (!e.envasado_order_id) continue;
    producidasPorOrdenEnvasado.set(
      e.envasado_order_id,
      (producidasPorOrdenEnvasado.get(e.envasado_order_id) ?? 0) + e.cantidad_unidades,
    );
  }
  const envasadoPlan = (envasadoOrders ?? []).map((order) => {
    const producidas = producidasPorOrdenEnvasado.get(order.id) ?? 0;
    const pct =
      order.planned_quantity > 0 ? Math.round((producidas / order.planned_quantity) * 100) : 0;
    const referencia = referenciasById.get(order.referencia_id);
    return {
      id: order.id,
      referenciaNombre: referencia?.name ?? "—",
      sku: referencia?.sku,
      linea: order.linea,
      planned: order.planned_quantity,
      producidas,
      pendientes: order.planned_quantity - producidas,
      pct,
    };
  });
  const envasadoSinIniciar = envasadoPlan.filter((o) => o.producidas === 0);

  // ---------------------------------------------------------------------
  // Actividad real de envasado por turno: viene de los cortes (turno ya
  // capturado), no de una hora planeada -- acá sí es dato real.
  // ---------------------------------------------------------------------
  const unidadesPorCorte = new Map<string, number>();
  for (const es of estibas ?? []) {
    unidadesPorCorte.set(
      es.corte_id,
      (unidadesPorCorte.get(es.corte_id) ?? 0) + (es.unidades_por_estiba ?? 0),
    );
  }
  const envasadosByIdParaCortes = new Map((envasadosDeCortes ?? []).map((e) => [e.id, e]));
  const cortesActividad = (cortes ?? [])
    .map((c) => {
      const envasado = envasadosByIdParaCortes.get(c.envasado_id);
      const referencia = envasado?.referencia_id ? referenciasById.get(envasado.referencia_id) : null;
      const ordenCumplido = envasado?.envasado_order_id
        ? envasadoPlan.find((o) => o.id === envasado.envasado_order_id)
        : null;
      return {
        id: c.id,
        turnoId: c.turno_id,
        startedAt: c.started_at,
        endedAt: c.ended_at,
        unidades: unidadesPorCorte.get(c.id) ?? 0,
        operarioNombres: [c.operario_id, c.operario_2_id]
          .filter((id): id is string => Boolean(id))
          .map((id) => profileNames.get(id) ?? "—"),
        presentacion: envasado?.presentacion ?? "—",
        referenciaNombre: referencia?.name,
        ordenCumplidoPct: ordenCumplido?.pct ?? null,
      };
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const fechaLabel = format(new Date(`${fecha}T12:00:00`), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Resumen del día</h1>
          <p className="text-muted-foreground capitalize">{fechaLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/resumen-dia?fecha=${addDaysISO(fecha, -1)}`}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            title="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <Link
            href={`/resumen-dia?fecha=${todayISO()}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Hoy
          </Link>
          <Link
            href={`/resumen-dia?fecha=${addDaysISO(fecha, 1)}`}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            title="Día siguiente"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {(bachesSinHora.length > 0 || envasadoSinIniciar.length > 0) && (
        <Card className="border-amber-300 dark:border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Pendientes de ubicar / iniciar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {bachesSinHora.length > 0 && (
              <p>
                <span className="font-medium">Sin hora planeada</span> (no se puede asignar
                turno): {bachesSinHora.map((b) => b.productName).join(", ")}.
              </p>
            )}
            {envasadoSinIniciar.length > 0 && (
              <p>
                <span className="font-medium">Envasado programado hoy sin iniciar</span>:{" "}
                {envasadoSinIniciar
                  .map((o) => `${o.referenciaNombre}${o.linea ? ` (${o.linea})` : ""}`)
                  .join(", ")}
                .
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {turnosList.map((turno) => {
        const bachesDelTurno = bachesPlan.filter((b) => b.turnoId === turno.id);
        const cortesDelTurno = cortesActividad.filter((c) => c.turnoId === turno.id);
        return (
          <Card key={turno.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {turno.name}{" "}
                <span className="font-normal text-muted-foreground">
                  ({turno.hora_inicio.slice(0, 5)}–{turno.hora_fin.slice(0, 5)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Baches programados</p>
                {bachesDelTurno.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Orden</TableHead>
                        <TableHead className="text-right">Planeados</TableHead>
                        <TableHead className="text-right">Reales</TableHead>
                        <TableHead className="text-right">Cumplido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bachesDelTurno.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="whitespace-nowrap">
                            {b.horaPlaneada ? formatTime(b.horaPlaneada) : "—"}
                          </TableCell>
                          <TableCell className="font-medium">{b.productName}</TableCell>
                          <TableCell>{b.ordenCodigo ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {b.planeados ?? (b.plannedQuantity ? `${b.plannedQuantity} ${b.unit}` : "—")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{b.reales}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={pctBadgeClass(b.pct)}>
                              {b.pct != null ? `${b.pct}%` : "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin baches programados en este turno.</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Envasado</p>
                {cortesDelTurno.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Operario(s)</TableHead>
                        <TableHead className="text-right">Unidades (turno)</TableHead>
                        <TableHead className="text-right">Cumplido orden (día)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cortesDelTurno.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatTime(c.startedAt)}
                            {c.endedAt ? `–${formatTime(c.endedAt)}` : " (en curso)"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {c.referenciaNombre ?? c.presentacion}
                          </TableCell>
                          <TableCell>{c.operarioNombres.join(" y ") || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.unidades}</TableCell>
                          <TableCell className="text-right">
                            {c.ordenCumplidoPct != null ? (
                              <Badge className={pctBadgeClass(c.ordenCumplidoPct)}>
                                {c.ordenCumplidoPct}%
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin actividad de envasado en este turno.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
