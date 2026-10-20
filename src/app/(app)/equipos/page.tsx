import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { usosDeEquipos } from "@/lib/equipo-ocupacion";
import { pronosticosTerminacion } from "@/lib/pronostico-bache";
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
    { data: activeRecords },
    { data: registrosHistoricos },
    { data: baches },
    { data: stageTemplates },
    { data: products },
  ] = await Promise.all([
    supabase.from("equipos").select("*").eq("active", true).order("name"),
    // Etapas activas en CUALQUIER bache, para saber la etapa actual de cada
    // bache en proceso (pronóstico) -- la ocupación de equipos en sí viene
    // de usosDeEquipos, más abajo.
    supabase
      .from("bache_stage_records")
      .select("bache_id, stage_template_id, started_at, ended_at")
      .is("ended_at", null),
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

  // Fuente única de "qué equipo está usando cada etapa, desde cuándo hasta
  // cuándo" -- ya incluye la extensión de los tanques hasta que termina de
  // envasarse el bache, y la hora de lavado al final de cualquier uso.
  const usos = await usosDeEquipos(supabase);

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
  // Estado actual + segmentos del Gantt: se muestran los usos de los
  // últimos 7 días, más cualquiera que siga en curso aunque sea más viejo.
  // -------------------------------------------------------------------
  const usosVisibles = usos.filter((u) => u.enCurso || u.start >= cutoff);
  const segmentos: GanttSegment[] = usosVisibles.flatMap((u) => {
    const bache = bacheById.get(u.bacheId);
    if (!bache) return [];
    return [
      {
        equipoId: u.equipoId,
        bacheId: u.bacheId,
        bacheLabel: bache.batch_code,
        stageName: stageNameById.get(u.stageTemplateId) ?? "—",
        start: u.start,
        end: u.end,
      },
    ];
  });

  const enCursoPorEquipo = new Map<string, GanttSegment>();
  for (const s of segmentos) {
    if (!s.end) enCursoPorEquipo.set(s.equipoId, s);
  }

  // -------------------------------------------------------------------
  // Ocupación: % del tiempo (últimos 7 días, ya con la hora de lavado y la
  // extensión de tanques incluidas) y aprovechamiento de capacidad
  // promedio (volumen del bache vs. capacidad del equipo).
  // -------------------------------------------------------------------
  const ventanaHoras = 7 * 24;
  const ocupacionPorEquipo = (equipos ?? []).map((equipo) => {
    const propios = usosVisibles.filter((u) => u.equipoId === equipo.id);
    const horasOcupado = propios.reduce((sum, u) => {
      const start = new Date(u.start).getTime();
      const end = u.end ? new Date(u.end).getTime() : nowMs();
      return sum + Math.max(0, Math.min(end, nowMs()) - Math.max(start, new Date(cutoff).getTime())) / 3_600_000;
    }, 0);
    const volumenes = propios
      .map((u) => bacheById.get(u.bacheId)?.volumen_total_litros ?? null)
      .filter((v): v is number => v != null && v > 0);
    const capacidadPromedioPct =
      equipo.capacidad && volumenes.length > 0
        ? (volumenes.reduce((s, v) => s + v, 0) / volumenes.length / equipo.capacidad) * 100
        : null;
    return {
      equipo,
      horasOcupado,
      ocupacionPct: Math.min(100, Math.round((horasOcupado / ventanaHoras) * 100)),
      usosRegistrados: propios.length,
      capacidadPromedioPct,
    };
  });

  // -------------------------------------------------------------------
  // Pronóstico de terminación para baches en proceso (misma lógica que usa
  // el módulo Proceso, ver src/lib/pronostico-bache.ts).
  // -------------------------------------------------------------------
  const pronosticos = pronosticosTerminacion({
    baches: baches ?? [],
    stageTemplates: stageTemplates ?? [],
    products: products ?? [],
    registrosCerrados: registrosHistoricos ?? [],
    registrosEnCurso: activeRecords ?? [],
  });

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
