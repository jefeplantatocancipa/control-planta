import { format } from "date-fns";
import Link from "next/link";
import { Printer } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { StartEnvasadoDialog } from "./start-envasado-dialog";
import { EnvasadoCard, type CorteDisplay, type ParadaDisplay } from "./envasado-card";
import { DeleteButton } from "@/components/delete-button";
import { ReabrirEnvasadoButton } from "./reabrir-envasado-button";
import { deleteEnvasado } from "./actions";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_CLASSES } from "../programa/order-status-styles";

export default async function EnvasadoPage() {
  const profile = await requireRole(["jefe_planta", "supervisor", "calidad", "asistente_adm"]);
  const canDelete = profile.role === "jefe_planta";
  const canExecute = profile.role === "jefe_planta" || profile.role === "supervisor";
  const canFirmar = profile.role === "jefe_planta" || profile.role === "calidad";
  const supabase = await createClient();

  const [
    { data: envasados },
    { data: baches },
    { data: products },
    { data: operarios },
    { data: insumosStages },
    { data: allStages },
    { data: stageRecords },
    { data: envasadoOrders },
    { data: envasadoReferencias },
    { data: envasadoInsumos },
    { data: envasadoReferenciaInsumos },
    { data: turnos },
    { data: cortes },
    { data: calidadLecturas },
    { data: estibas },
    { data: paradas },
    { data: insumosUso },
    { data: corteFirmas },
  ] = await Promise.all([
    supabase
      .from("envasados")
      .select("*")
      .order("started_at", { ascending: false }),
    supabase
      .from("baches")
      .select("*")
      .neq("status", "cancelado")
      .order("started_at", { ascending: false }),
    supabase.from("products").select("*"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
    supabase
      .from("process_stage_templates")
      .select("id, sequence_order")
      .eq("captures_insumos", true),
    supabase
      .from("process_stage_templates")
      .select("id, product_id, name")
      .eq("active", true),
    supabase
      .from("bache_stage_records")
      .select("bache_id, stage_template_id, parameters"),
    // "en_proceso" se incluye porque una orden puede necesitar varios
    // baches/envasados hasta completar sus unidades planeadas -- no debe
    // desaparecer del selector solo porque ya se usó una vez.
    supabase
      .from("envasado_orders")
      .select("*")
      .in("status", ["pendiente", "en_proceso"])
      .order("scheduled_date"),
    supabase.from("envasado_referencias").select("*"),
    supabase.from("envasado_insumos").select("*").eq("active", true).order("name"),
    supabase.from("envasado_referencia_insumos").select("*"),
    supabase.from("turnos").select("*").eq("active", true).order("hora_inicio"),
    supabase.from("envasado_cortes").select("*").order("started_at"),
    supabase.from("envasado_calidad_lecturas").select("*").order("created_at"),
    supabase.from("envasado_estibas").select("*").order("inicio_estiba"),
    supabase.from("envasado_paradas").select("*").order("started_at"),
    supabase
      .from("envasado_insumos_uso")
      .select("id, envasado_id, envasado_insumo_id"),
    supabase.from("envasado_corte_firmas").select("*"),
  ]);

  const firmasByCorte = new Map((corteFirmas ?? []).map((f) => [f.corte_id, f]));

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const productRequiresEnvasado = new Map(
    (products ?? []).map((p) => [p.id, p.requiere_envasado]),
  );

  // Un bache no debería poder envasarse hasta que arrancó Enfriamiento (no
  // tiene sentido empacar leche todavía caliente/sin procesar). Se resuelve
  // la etapa "Enfriamiento" según las etapas propias del producto del bache
  // (o las compartidas si el producto no tiene etapas propias), igual que
  // en /baches/[id]. Si el producto no tiene una etapa llamada así, no se
  // bloquea (evita romper productos con un flujo distinto).
  const stagesByProduct = new Map<string, { id: string; name: string }[]>();
  for (const stage of allStages ?? []) {
    const key = stage.product_id ?? "__default__";
    const list = stagesByProduct.get(key) ?? [];
    list.push({ id: stage.id, name: stage.name });
    stagesByProduct.set(key, list);
  }
  function enfriamientoStageId(productId: string): string | null {
    const own = stagesByProduct.get(productId) ?? [];
    const pool = own.length > 0 ? own : (stagesByProduct.get("__default__") ?? []);
    return pool.find((s) => s.name.trim().toLowerCase() === "enfriamiento")?.id ?? null;
  }
  const startedStageKeys = new Set(
    (stageRecords ?? []).map((r) => `${r.bache_id}:${r.stage_template_id}`),
  );
  function hasReachedEnfriamiento(bache: { id: string; product_id: string }) {
    const stageId = enfriamientoStageId(bache.product_id);
    if (!stageId) return true;
    return startedStageKeys.has(`${bache.id}:${stageId}`);
  }

  // El desplegable de "Iniciar envasado" se filtra por si queda producto sin
  // envasar (volumen_restante_litros), NO por el estado del bache: "el bache
  // ya terminó de producirse" (status) y "no queda producto para envasar"
  // (volumen restante) son cosas distintas — un bache recién "completado"
  // (todas sus etapas listas) es justo el que hay que poder envasar. Además
  // debe haber llegado al menos a Enfriamiento.
  const bacheOptions = (baches ?? [])
    .filter(
      (bache) =>
        bache.status !== "cancelado" &&
        bache.volumen_restante_litros !== 0 &&
        hasReachedEnfriamiento(bache) &&
        productRequiresEnvasado.get(bache.product_id) !== false,
    )
    .map((bache) => ({
      id: bache.id,
      productId: bache.product_id,
      label: [
        bache.batch_code,
        productNames.get(bache.product_id) ?? "—",
        bache.volumen_restante_litros != null
          ? `quedan ${bache.volumen_restante_litros} L`
          : null,
      ]
        .filter(Boolean)
        .join(" — "),
    }));
  // Candidatos para "agregar base de otro bache" al iniciar un envasado:
  // cualquier bache con algo de volumen todavía sin envasar (se filtra por
  // producto y se excluye el propio bache ya en el diálogo).
  const bachesConBaseOptions = (baches ?? [])
    .filter((bache) => bache.status !== "cancelado" && (bache.volumen_restante_litros ?? 0) > 0)
    .map((bache) => ({
      id: bache.id,
      productId: bache.product_id,
      batchCode: bache.batch_code,
      volumenRestante: bache.volumen_restante_litros,
    }));

  const bacheLabels = new Map(
    (baches ?? []).map((bache) => [
      bache.id,
      `${bache.batch_code} — ${productNames.get(bache.product_id) ?? "—"}`,
    ]),
  );
  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));
  // Solo operario/supervisor son seleccionables como "operario responsable";
  // jefe_planta y planeación no aparecen en el desplegable (pero sí se
  // siguen resolviendo sus nombres arriba, por si quedaron en registros
  // viejos de antes de este filtro).
  const operariosSeleccionables = (operarios ?? []).filter(
    (o) => o.role === "operario" || o.role === "supervisor",
  );

  const turnoNames = new Map((turnos ?? []).map((t) => [t.id, t.name]));

  // Insumos usados por envasado, para pedir el desperdicio extra de
  // material al cerrar (el consumo normal se descuenta solo por unidades).
  const envasadoInsumoNames = new Map((envasadoInsumos ?? []).map((i) => [i.id, i.name]));
  const insumosUsoByEnvasado = new Map<string, { id: string; nombre: string }[]>();
  for (const uso of insumosUso ?? []) {
    const list = insumosUsoByEnvasado.get(uso.envasado_id) ?? [];
    list.push({
      id: uso.id,
      nombre: envasadoInsumoNames.get(uso.envasado_insumo_id) ?? "—",
    });
    insumosUsoByEnvasado.set(uso.envasado_id, list);
  }

  const lecturasByCorte = new Map<string, CorteDisplay["lecturas"]>();
  for (const lectura of calidadLecturas ?? []) {
    const pesos = [lectura.peso_1, lectura.peso_2, lectura.peso_3].filter(
      (p): p is number => p !== null,
    );
    const list = lecturasByCorte.get(lectura.corte_id) ?? [];
    list.push({
      id: lectura.id,
      timestamp: lectura.created_at,
      pesoPromedio: pesos.length === 3 ? (pesos[0] + pesos[1] + pesos[2]) / 3 : null,
      selladoCumple: lectura.sellado_cumple,
      fechadoCumple: lectura.fechado_cumple,
      observaciones: lectura.observaciones,
    });
    lecturasByCorte.set(lectura.corte_id, list);
  }

  const estibasByCorte = new Map<string, CorteDisplay["estibas"]>();
  for (const estiba of estibas ?? []) {
    const list = estibasByCorte.get(estiba.corte_id) ?? [];
    list.push({
      id: estiba.id,
      inicioEstiba: estiba.inicio_estiba,
      finalEstiba: estiba.final_estiba,
      unidadesPorEstiba: estiba.unidades_por_estiba,
    });
    estibasByCorte.set(estiba.corte_id, list);
  }

  const cortesByEnvasado = new Map<string, CorteDisplay[]>();
  for (const corte of cortes ?? []) {
    const operariosLabel = [
      operarioNames.get(corte.operario_id),
      corte.operario_2_id ? operarioNames.get(corte.operario_2_id) : null,
    ]
      .filter(Boolean)
      .join(" y ");
    const display: CorteDisplay = {
      id: corte.id,
      turnoName: turnoNames.get(corte.turno_id) ?? "—",
      operarios: operariosLabel || "—",
      startedAt: corte.started_at,
      endedAt: corte.ended_at,
      unidadesInicio: corte.unidades_inicio,
      unidadesFinal: corte.unidades_final,
      desperdicio: corte.desperdicio,
      observaciones: corte.observaciones,
      lecturas: lecturasByCorte.get(corte.id) ?? [],
      estibas: estibasByCorte.get(corte.id) ?? [],
      closedByNombre: corte.closed_by ? (operarioNames.get(corte.closed_by) ?? "—") : null,
      firma: (() => {
        const f = firmasByCorte.get(corte.id);
        if (!f) return null;
        return {
          aprobado: f.aprobado,
          observaciones: f.observaciones,
          firmadoPorNombre: operarioNames.get(f.firmado_por) ?? "—",
          firmadoAt: f.firmado_at,
        };
      })(),
    };
    const list = cortesByEnvasado.get(corte.envasado_id) ?? [];
    list.push(display);
    cortesByEnvasado.set(corte.envasado_id, list);
  }

  const paradasByEnvasado = new Map<string, ParadaDisplay[]>();
  for (const parada of paradas ?? []) {
    const list = paradasByEnvasado.get(parada.envasado_id) ?? [];
    list.push({
      id: parada.id,
      motivo: parada.motivo,
      startedAt: parada.started_at,
      endedAt: parada.ended_at,
    });
    paradasByEnvasado.set(parada.envasado_id, list);
  }

  // Unidades ya envasadas por orden: se suma TODO envasado ligado a la
  // orden (puede haber más de uno, si un solo bache no alcanza a cubrir lo
  // planeado) para saber cuánto queda pendiente.
  const unidadesProducidasPorOrden = new Map<string, number>();
  for (const e of envasados ?? []) {
    if (!e.envasado_order_id) continue;
    unidadesProducidasPorOrden.set(
      e.envasado_order_id,
      (unidadesProducidasPorOrden.get(e.envasado_order_id) ?? 0) + e.cantidad_unidades,
    );
  }

  const referenciasById = new Map((envasadoReferencias ?? []).map((r) => [r.id, r]));
  const ordenesConPendiente = (envasadoOrders ?? [])
    .map((order) => ({
      ...order,
      producidas: unidadesProducidasPorOrden.get(order.id) ?? 0,
      pendientes: order.planned_quantity - (unidadesProducidasPorOrden.get(order.id) ?? 0),
    }))
    // Salvedad: si una orden "en_proceso" ya llegó a lo planeado pero por
    // algún motivo no se marcó "completada" (falló esa actualización, por
    // ejemplo), no debe seguir ofreciéndose para elegir.
    .filter((order) => order.pendientes > 0);

  const envasadoOrderOptions = ordenesConPendiente.map((order) => {
    const referencia = referenciasById.get(order.referencia_id);
    const fecha = format(new Date(`${order.scheduled_date}T00:00:00`), "dd/MM/yyyy");
    const presentacion = referencia ? `${referencia.sku} — ${referencia.name}` : "—";
    // El producto (nombre) va primero para identificar qué se va a envasar;
    // línea/fecha/cantidad, que es lo que distingue órdenes de un mismo
    // producto, van antes de que se trunque; el sku (solo un código) queda
    // al final, igual que el código de orden en "Nuevo bache". Las
    // unidades pendientes (no las planeadas) para saber de un vistazo
    // cuánto falta, sobre todo en órdenes que ya tuvieron un bache.
    const label = [
      referencia?.name ?? "—",
      order.linea,
      fecha,
      order.producidas > 0
        ? `${order.pendientes} und. pendientes (de ${order.planned_quantity})`
        : `${order.planned_quantity} und.`,
      referencia?.sku,
    ]
      .filter(Boolean)
      .join(" — ");
    return {
      id: order.id,
      label,
      presentacion,
      referenciaId: order.referencia_id,
      productId: referencia?.product_id ?? null,
    };
  });

  // Receta de material de empaque por referencia: filtra el checklist de
  // "Iniciar envasado" a solo los insumos que corresponden, en vez de
  // mostrar todo el catálogo.
  const recipeByReferencia: Record<string, string[]> = {};
  for (const row of envasadoReferenciaInsumos ?? []) {
    const list = recipeByReferencia[row.referencia_id] ?? [];
    list.push(row.envasado_insumo_id);
    recipeByReferencia[row.referencia_id] = list;
  }

  // Balance de masa por bache: se toma la última etapa con checklist de
  // insumos (ej. Mezcla) en vez de Alistamiento, porque ahí queda
  // confirmado lo que realmente se agregó al proceso (no todo lo
  // prealistado necesariamente termina en la mezcla).
  const insumosStageOrder = new Map(
    (insumosStages ?? []).map((s) => [s.id, s.sequence_order]),
  );
  const massBalanceByBache = new Map<string, { order: number; kg: number }>();
  for (const record of stageRecords ?? []) {
    const order = insumosStageOrder.get(record.stage_template_id);
    if (order === undefined) continue;
    const insumos = Array.isArray(record.parameters?.insumos)
      ? record.parameters.insumos
      : [];
    const baseOtroBache = Array.isArray(record.parameters?.base_otro_bache)
      ? record.parameters.base_otro_bache
      : [];
    const kg =
      insumos.reduce((sum, i) => sum + (Number(i.peso) || 0), 0) +
      baseOtroBache.reduce((sum, b) => sum + (Number(b.cantidad) || 0), 0);
    const current = massBalanceByBache.get(record.bache_id);
    if (!current || order > current.order) {
      massBalanceByBache.set(record.bache_id, { order, kg });
    }
  }

  const open = (envasados ?? []).filter((e) => !e.ended_at);
  const closed = (envasados ?? []).filter((e) => e.ended_at);

  // Aviso de órdenes que ya arrancaron pero no llegaron a las unidades
  // planeadas: la orden "pendiente" recién programada no necesita aviso, lo
  // que hay que resaltar es la que un bache dejó incompleta y sigue
  // necesitando otro bache/envasado para cerrarse.
  const ordenesIncompletas = ordenesConPendiente
    .filter((o) => o.status === "en_proceso")
    .map((order) => ({
      ...order,
      referenciaNombre: referenciasById.get(order.referencia_id)?.name ?? "—",
    }))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Envasado del bache</h1>
          <p className="text-muted-foreground">
            Iniciar el envasado de un bache y actualizar el avance durante el
            día.
          </p>
        </div>
        {canExecute && (
          <StartEnvasadoDialog
            baches={bacheOptions}
            envasadoOrders={envasadoOrderOptions}
            envasadoInsumos={envasadoInsumos ?? []}
            recipeByReferencia={recipeByReferencia}
            bachesConBase={bachesConBaseOptions}
          />
        )}
      </div>

      {ordenesIncompletas.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Órdenes con unidades pendientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Ya tuvieron al menos un bache/envasado pero no llegaron a la cantidad planeada.
              Elegilas de nuevo en &quot;Iniciar envasado&quot; para completarlas.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Planeadas</TableHead>
                  <TableHead className="text-right">Envasadas</TableHead>
                  <TableHead className="text-right">Pendientes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenesIncompletas.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.referenciaNombre}</TableCell>
                    <TableCell>{order.linea ?? "—"}</TableCell>
                    <TableCell>{formatDate(order.scheduled_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.planned_quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{order.producidas}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={ORDER_STATUS_CLASSES.pendiente}>
                        {order.pendientes} und.
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">En curso</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((envasado) => (
            <EnvasadoCard
              key={envasado.id}
              recordId={envasado.id}
              bacheLabel={bacheLabels.get(envasado.bache_id) ?? "—"}
              presentacion={envasado.presentacion}
              lote={envasado.lote}
              operarioName={operarioNames.get(envasado.operario_id) ?? "—"}
              massBalanceKg={massBalanceByBache.get(envasado.bache_id)?.kg}
              turnos={turnos ?? []}
              operarios={operariosSeleccionables}
              cortes={cortesByEnvasado.get(envasado.id) ?? []}
              paradas={paradasByEnvasado.get(envasado.id) ?? []}
              insumosUso={insumosUsoByEnvasado.get(envasado.id) ?? []}
              canDelete={canDelete}
              canExecute={canExecute}
              canFirmar={canFirmar}
            />
          ))}
          {open.length === 0 && (
            <p className="text-muted-foreground">Sin envasados en curso.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Finalizados</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bache</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Insumos (kg)</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead>Mermas</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Finalizado</TableHead>
              <TableHead />
              {canDelete && <TableHead className="sticky right-0 bg-background" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {closed.map((envasado) => (
              <TableRow key={envasado.id} className="group">
                <TableCell className="font-medium">
                  {bacheLabels.get(envasado.bache_id) ?? "—"}
                </TableCell>
                <TableCell>{envasado.presentacion}</TableCell>
                <TableCell>{envasado.lote ?? "—"}</TableCell>
                <TableCell>
                  {massBalanceByBache.get(envasado.bache_id)?.kg ?? "—"}
                </TableCell>
                <TableCell>{envasado.cantidad_unidades}</TableCell>
                <TableCell>{envasado.cantidad_mermas}</TableCell>
                <TableCell>{operarioNames.get(envasado.operario_id) ?? "—"}</TableCell>
                <TableCell>
                  {envasado.ended_at && formatDateTime(envasado.ended_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/envasado/${envasado.id}/imprimir`}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      title="Imprimir informe"
                    >
                      <Printer className="size-4" />
                    </Link>
                    {canExecute && <ReabrirEnvasadoButton id={envasado.id} />}
                  </div>
                </TableCell>
                {canDelete && (
                  <TableCell className="sticky right-0 bg-background text-right group-hover:bg-muted/50">
                    <DeleteButton
                      action={deleteEnvasado}
                      id={envasado.id}
                      title="Eliminar envasado"
                      description="Borra este envasado con todos sus turnos, lecturas, estibas y su encajado."
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {closed.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canDelete ? 10 : 9}
                  className="text-center text-muted-foreground"
                >
                  Sin envasados finalizados todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
