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

export default async function EstadisticasPage() {
  await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const [
    { data: etapaStats },
    { data: envasadoStats },
    { data: vasosEnmangados },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("v_estadisticas_operario")
      .select("*")
      .order("operario_name"),
    supabase
      .from("v_estadisticas_envasado_operario")
      .select("*")
      .order("total_unidades", { ascending: false }),
    supabase.from("vasos_enmangados").select("*"),
    supabase.from("profiles").select("*"),
  ]);

  const operarioNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

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
          Desempeño por operario y por proceso.
        </p>
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
