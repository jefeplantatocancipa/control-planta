import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewEnmangadoDialog } from "./new-enmangado-dialog";
import { NewEnmangadoProgramDialog } from "./new-enmangado-program-dialog";
import { EnmangadoProgramCard } from "./enmangado-program-card";
import { VasosBlancosPanel } from "./vasos-blancos-panel";
import { ReferenciasPanel } from "./referencias-panel";
import { formatDateTime } from "@/lib/format-date";

export default async function EnmangadoPage() {
  const profile = await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const [
    { data: vasosEnmangados },
    { data: programs },
    { data: orders },
    { data: referencias },
    { data: vasosBlancos },
    { data: entradas },
    { data: operarios },
  ] = await Promise.all([
    supabase
      .from("vasos_enmangados")
      .select("*")
      .order("started_at", { ascending: false }),
    supabase
      .from("enmangado_programs")
      .select("*")
      .order("week_start_date", { ascending: false }),
    supabase.from("enmangado_orders").select("*").order("scheduled_date"),
    supabase.from("enmangado_referencias").select("*").order("name"),
    supabase.from("vasos_blancos").select("*").order("name"),
    supabase.from("vasos_blancos_entradas").select("*"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
  ]);

  const canWrite = profile.role === "jefe_planta";
  const referenciaList = referencias ?? [];
  const referenciaNames = new Map(referenciaList.map((r) => [r.id, r.name]));
  const operarioNames = new Map((operarios ?? []).map((o) => [o.id, o.full_name]));

  const openOrders = (orders ?? []).filter((o) =>
    ["pendiente", "en_proceso"].includes(o.status),
  );
  const orderOptions = openOrders.map((order) => ({
    id: order.id,
    label: `${referenciaNames.get(order.referencia_id) ?? "—"} — ${order.scheduled_date}`,
  }));

  const stockByVaso = new Map<string, number>();
  for (const entrada of entradas ?? []) {
    stockByVaso.set(
      entrada.vaso_blanco_id,
      (stockByVaso.get(entrada.vaso_blanco_id) ?? 0) + entrada.cantidad,
    );
  }
  for (const vaso of vasosEnmangados ?? []) {
    const referencia = referenciaList.find((r) => r.id === vaso.referencia_id);
    if (!referencia) continue;
    stockByVaso.set(
      referencia.vaso_blanco_id,
      (stockByVaso.get(referencia.vaso_blanco_id) ?? 0) - vaso.cantidad_unidades,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Enmangado</h1>
        <p className="text-muted-foreground">
          Etiquetado de vasos blancos por referencia: es un proceso propio, sin
          relación con los baches de yogurt.
        </p>
      </div>

      <Tabs defaultValue="captura">
        <TabsList>
          <TabsTrigger value="captura">Captura</TabsTrigger>
          <TabsTrigger value="programa">Programa</TabsTrigger>
          <TabsTrigger value="stock">Stock de vasos blancos</TabsTrigger>
          {canWrite && <TabsTrigger value="referencias">Referencias</TabsTrigger>}
        </TabsList>

        <TabsContent value="captura" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <NewEnmangadoDialog
              referencias={referenciaList.filter((r) => r.active)}
              orders={orderOptions}
              operarios={operarios ?? []}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referencia</TableHead>
                <TableHead>Lote / etiqueta</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Mermas</TableHead>
                <TableHead>Operario</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vasosEnmangados ?? []).map((vaso) => (
                <TableRow key={vaso.id}>
                  <TableCell className="font-medium">
                    {referenciaNames.get(vaso.referencia_id) ?? "—"}
                  </TableCell>
                  <TableCell>{vaso.lote_etiqueta ?? "—"}</TableCell>
                  <TableCell>{vaso.cantidad_unidades}</TableCell>
                  <TableCell>{vaso.cantidad_mermas}</TableCell>
                  <TableCell>{operarioNames.get(vaso.operario_id) ?? "—"}</TableCell>
                  <TableCell>
                    {formatDateTime(vaso.started_at)}
                  </TableCell>
                </TableRow>
              ))}
              {(vasosEnmangados ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Sin enmangados todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="programa" className="flex flex-col gap-4">
          {canWrite && (
            <div className="flex justify-end">
              <NewEnmangadoProgramDialog />
            </div>
          )}
          <div className="flex flex-col gap-4">
            {(programs ?? []).map((program) => (
              <EnmangadoProgramCard
                key={program.id}
                program={program}
                orders={(orders ?? []).filter((o) => o.program_id === program.id)}
                vasos={vasosEnmangados ?? []}
                referencias={referenciaList}
                canWrite={canWrite}
              />
            ))}
            {(programs ?? []).length === 0 && (
              <p className="text-center text-muted-foreground">
                Sin programas de enmangado todavía.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stock">
          <VasosBlancosPanel
            vasosBlancos={vasosBlancos ?? []}
            stockByVaso={stockByVaso}
            canManage={canWrite}
          />
        </TabsContent>

        {canWrite && (
          <TabsContent value="referencias">
            <ReferenciasPanel
              referencias={referenciaList}
              vasosBlancos={vasosBlancos ?? []}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
