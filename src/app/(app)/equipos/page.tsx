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
import { formatDateTime, formatTime } from "@/lib/format-date";
import { GanttChart, type GanttSegment } from "./gantt-chart";

function nowMs() {
  return Date.now();
}

function daysAgoISO(days: number) {
  return new Date(nowMs() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function EquiposPage() {
  await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);
  const supabase = await createClient();

  const cutoff = daysAgoISO(7);

  const [
    { data: equipos },
    { data: registrosEnVentana },
    { data: registrosHistoricos },
    { data: baches },
    { data: stageTemplates },
    { data: products },
  ] = await Promise.all([
    supabase.from("equipos").select("*").eq("active", true).order("name"),
    // Etapas dentro de la ventana (últimos 7 días + lo que siga en curso),
    // para cruzar después con los equipos que usó cada una.
    supabase
      .from("bache_stage_records")
      .select("id, bache_id, stage_template_id, started_at, ended_at")
      .or(`ended_at.is.null,started_at.gte.${cutoff}`),
    // Todas las etapas cerradas (sin filtrar por equipo) para calcular la
    // duración promedio histórica por producto + etapa, base del pronóstico.
    supabase
      .from("bache_stage_records")
      .select("bache_id, stage_template_id, started_at, ended_at")
      .not("ended_at", "is", null),
    supabase.from("baches").select("id, batch_code, product_id, status, volumen_total_litros"),
    supabase
      .from("process_stage_templates")
      .select("id, product_id, name, sequence_order")
      .eq("active", true),
    supabase.from("products").select("id, name"),
  ]);

  // Una etapa puede usar varios equipos a la vez: se trae la lista de
  // asignaciones para las etapas de la ventana y se cruza en memoria.
  const recordIdsEnVentana = (registrosEnVentana ?? []).map((r) => r.id);
  const { data: equiposDeRegistros } =
    recordIdsEnVentana.length > 0
      ? await supabase
          .from("bache_stage_record_equipos")
          .select("stage_record_id, equipo_id")
          .in("stage_record_id", recordIdsEnVentana)
      : { data: [] };
  const equipoIdsByRecordId = new Map<string, string[]>();
  for (const re of equiposDeRegistros ?? []) {
    const arr = equipoIdsByRecordId.get(re.stage_record_id) ?? [];
    arr.push(re.equipo_id);
    equipoIdsByRecordId.set(re.stage_record_id, arr);
  }

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const bacheById = new Map((baches ?? []).map((b) => [b.id, b]));

  const stagesByProduct = new Map<string, { id: string; name: string; sequence_order: number }[]>();
  const defaultStages: { id: string; name: string; sequence_order: number }[] = [];
  for (const s of stageTemplates ?? []) {
    if (s.product_id) {
      const arr = stagesByProduct.get(s.product_id) ?? [];
      arr.push(s);
      stagesByProduct.set(s.product_id, arr);
    } else {
      defaultStages.push(s);
    }
  }
  function stagesFor(productId: string) {
    const own = stagesByProduct.get(productId);
    return (own && own.length > 0 ? own : defaultStages).slice().sort(
      (a, b) => a.sequence_order - b.sequence_order,
    );
  }
  const stageNameById = new Map((stageTemplates ?? []).map((s) => [s.id, s.name]));

  // -------------------------------------------------------------------
  // Estado actual + segmentos del Gantt.
  // -------------------------------------------------------------------
  const segmentos: GanttSegment[] = (registrosEnVentana ?? []).flatMap((r) => {
    const bache = bacheById.get(r.bache_id);
    const equipoIds = equipoIdsByRecordId.get(r.id) ?? [];
    if (!bache || equipoIds.length === 0) return [];
    return equipoIds.map((equipoId) => ({
      equipoId,
      bacheId: r.bache_id,
      bacheLabel: bache.batch_code,
      stageName: stageNameById.get(r.stage_template_id) ?? "—",
      start: r.started_at,
      end: r.ended_at,
    }));
  });

  const enCursoPorEquipo = new Map<string, GanttSegment>();
  for (const s of segmentos) {
    if (!s.end) enCursoPorEquipo.set(s.equipoId, s);
  }

  // -------------------------------------------------------------------
  // Ocupación: % del tiempo (últimos 7 días) y aprovechamiento de
  // capacidad promedio (volumen del bache vs. capacidad del equipo).
  // -------------------------------------------------------------------
  const ventanaHoras = 7 * 24;
  const ocupacionPorEquipo = (equipos ?? []).map((equipo) => {
    const propios = segmentos.filter((s) => s.equipoId === equipo.id);
    const horasOcupado = propios.reduce((sum, s) => {
      const start = new Date(s.start).getTime();
      const end = s.end ? new Date(s.end).getTime() : nowMs();
      return sum + Math.max(0, end - start) / 3_600_000;
    }, 0);
    const usos = propios
      .map((s) => bacheById.get(s.bacheId)?.volumen_total_litros ?? null)
      .filter((v): v is number => v != null && v > 0);
    const capacidadPromedioPct =
      equipo.capacidad && usos.length > 0
        ? (usos.reduce((s, v) => s + v, 0) / usos.length / equipo.capacidad) * 100
        : null;
    return {
      equipo,
      horasOcupado,
      ocupacionPct: Math.min(100, Math.round((horasOcupado / ventanaHoras) * 100)),
      usosRegistrados: usos.length,
      capacidadPromedioPct,
    };
  });

  // -------------------------------------------------------------------
  // Duración promedio histórica por producto + etapa (base del pronóstico).
  // -------------------------------------------------------------------
  const bacheProductByIdAll = new Map((baches ?? []).map((b) => [b.id, b.product_id]));
  const promedioPorProductoEtapa = new Map<string, { sumaMin: number; cantidad: number }>();
  for (const r of registrosHistoricos ?? []) {
    if (!r.ended_at) continue;
    const productId = bacheProductByIdAll.get(r.bache_id);
    if (!productId) continue;
    const minutos = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000;
    const key = `${productId}:${r.stage_template_id}`;
    const entry = promedioPorProductoEtapa.get(key) ?? { sumaMin: 0, cantidad: 0 };
    entry.sumaMin += minutos;
    entry.cantidad += 1;
    promedioPorProductoEtapa.set(key, entry);
  }
  function promedioMinDe(productId: string, stageTemplateId: string) {
    const entry = promedioPorProductoEtapa.get(`${productId}:${stageTemplateId}`);
    return entry && entry.cantidad > 0 ? entry.sumaMin / entry.cantidad : null;
  }

  // -------------------------------------------------------------------
  // Pronóstico de terminación para baches en proceso: desde la etapa
  // actual (o la siguiente a iniciar) hasta el final de la secuencia,
  // sumando duración promedio histórica de cada etapa restante. Si no hay
  // dato histórico para alguna etapa, el pronóstico queda parcial (se
  // avisa) en vez de inventar un número.
  // -------------------------------------------------------------------
  const registrosPorBache = new Map<string, { stage_template_id: string; started_at: string; ended_at: string | null }[]>();
  for (const r of registrosHistoricos ?? []) {
    const arr = registrosPorBache.get(r.bache_id) ?? [];
    arr.push(r);
    registrosPorBache.set(r.bache_id, arr);
  }
  // También hace falta el registro EN CURSO de cada bache (no está en
  // registrosHistoricos porque ese solo trae etapas ya cerradas).
  const enCursoPorBache = new Map<string, { stage_template_id: string; started_at: string }>();
  for (const r of registrosEnVentana ?? []) {
    if (!r.ended_at) enCursoPorBache.set(r.bache_id, r);
  }

  const pronosticos = (baches ?? [])
    .filter((b) => b.status === "en_proceso")
    .map((bache) => {
      const secuencia = stagesFor(bache.product_id);
      if (secuencia.length === 0) return null;
      const propios = registrosPorBache.get(bache.id) ?? [];
      const cerradasIds = new Set(propios.filter((r) => r.ended_at).map((r) => r.stage_template_id));
      const enCurso = enCursoPorBache.get(bache.id);

      let desde: number; // now, o hora estimada de arranque de la próxima etapa
      let etapasRestantes: typeof secuencia;
      if (enCurso) {
        const stage = secuencia.find((s) => s.id === enCurso.stage_template_id);
        if (!stage) return null;
        etapasRestantes = secuencia.filter((s) => s.sequence_order >= stage.sequence_order);
        desde = new Date(enCurso.started_at).getTime();
      } else {
        etapasRestantes = secuencia.filter((s) => !cerradasIds.has(s.id));
        if (etapasRestantes.length === 0) return null; // ya deberían estar todas cerradas
        desde = nowMs();
      }

      let acumuladoMin = 0;
      let faltaDato = false;
      for (const stage of etapasRestantes) {
        const prom = promedioMinDe(bache.product_id, stage.id);
        if (prom == null) {
          faltaDato = true;
          continue;
        }
        acumuladoMin += prom;
      }
      const estimadoFin = new Date(desde + acumuladoMin * 60000).toISOString();
      return {
        bacheId: bache.id,
        batchCode: bache.batch_code,
        productName: productNameById.get(bache.product_id) ?? "—",
        etapaActual: enCurso ? stageNameById.get(enCurso.stage_template_id) ?? "—" : "Sin iniciar",
        estimadoFin,
        faltaDato,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.estimadoFin.localeCompare(b.estimadoFin));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipos</h1>
        <p className="text-muted-foreground">
          Ocupación en vivo, línea de tiempo y pronóstico de terminación por equipo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(equipos ?? []).map((equipo) => {
          const enCurso = enCursoPorEquipo.get(equipo.id);
          const bache = enCurso ? bacheById.get(enCurso.bacheId) : null;
          return (
            <Card key={equipo.id}>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{equipo.name}</span>
                  <Badge variant={enCurso ? "default" : "outline"}>
                    {enCurso ? "Ocupado" : "Libre"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {equipo.tipo}
                  {equipo.capacidad ? ` · ${equipo.capacidad} ${equipo.unidad}` : ""}
                </span>
                {enCurso && bache && (
                  <span className="text-sm text-muted-foreground">
                    {bache.batch_code} · {enCurso.stageName} · desde {formatTime(enCurso.start)}
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
        {(equipos ?? []).length === 0 && (
          <p className="text-muted-foreground">
            Sin equipos configurados. Cargalos en Administración → Insumos.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Línea de tiempo (últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {equipos && equipos.length > 0 ? (
            <GanttChart
              equipos={equipos.map((e) => ({ id: e.id, name: e.name }))}
              segments={segmentos}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin equipos configurados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ocupación por equipo (últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-right">Horas ocupado</TableHead>
                <TableHead className="text-right">% del tiempo</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead className="text-right">Capacidad aprovechada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ocupacionPorEquipo.map((o) => (
                <TableRow key={o.equipo.id}>
                  <TableCell className="font-medium">{o.equipo.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(Math.round(o.horasOcupado * 10) / 10).toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={o.ocupacionPct > 70 ? "default" : "outline"}>
                      {o.ocupacionPct}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.usosRegistrados}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.capacidadPromedioPct != null
                      ? `${Math.round(o.capacidadPromedioPct)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {ocupacionPorEquipo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Sin equipos configurados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            &quot;Capacidad aprovechada&quot; compara el volumen total del bache contra la
            capacidad cargada del equipo (solo para equipos con capacidad configurada).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pronóstico de terminación</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bache</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Etapa actual</TableHead>
                <TableHead className="text-right">Fin estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pronosticos.map((p) => (
                <TableRow key={p.bacheId}>
                  <TableCell className="font-medium">{p.batchCode}</TableCell>
                  <TableCell>{p.productName}</TableCell>
                  <TableCell>{p.etapaActual}</TableCell>
                  <TableCell className="text-right">
                    {formatDateTime(p.estimadoFin)}
                    {p.faltaDato && (
                      <span className="ml-1 text-xs text-muted-foreground">(parcial)</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {pronosticos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin baches en proceso.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            Estimado a partir de la duración promedio histórica de cada etapa restante, para
            ese mismo producto. &quot;(parcial)&quot; significa que alguna etapa todavía no
            tiene datos históricos suficientes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
