import { redirect, notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { puedeVerTransportes } from "@/lib/transportes-acceso";
import { isTransportesEnabled } from "@/lib/feature-flags";
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
import { TransporteForm } from "./transporte-form";
import { FiltrosForm } from "./filtros-form";
import { ReenviarButton } from "./reenviar-button";
import { URGENCIA } from "./constants";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function formatFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "d MMM yyyy", { locale: es });
}

export default async function TransportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    area?: string;
    urgencia?: string;
    origen?: string;
    destino?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const profile = await requireProfile();
  if (!isTransportesEnabled()) notFound();
  if (!puedeVerTransportes(profile.email)) redirect("/");

  const filtros = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("solicitudes_transporte")
    .select("*")
    .order("fecha_traslado", { ascending: false })
    .order("hora_traslado", { ascending: false });
  if (filtros.area) query = query.eq("area_solicitante", filtros.area);
  if (filtros.urgencia && (URGENCIA as readonly string[]).includes(filtros.urgencia)) {
    query = query.eq("urgencia", filtros.urgencia as (typeof URGENCIA)[number]);
  }
  if (filtros.origen) query = query.ilike("origen", `%${filtros.origen}%`);
  if (filtros.destino) query = query.ilike("destino", `%${filtros.destino}%`);
  if (filtros.desde) query = query.gte("fecha_traslado", filtros.desde);
  if (filtros.hasta) query = query.lte("fecha_traslado", filtros.hasta);

  const { data: solicitudes } = await query;

  const hayFiltros = Object.values(filtros).some(Boolean);
  const queryString = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Transportes</h1>
        <p className="text-muted-foreground">
          Solicitar un traslado entre sedes. Al enviar, se manda un correo con el detalle en
          Excel y queda registrada acá abajo.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Nueva solicitud de transporte</CardTitle>
        </CardHeader>
        <CardContent>
          <TransporteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Solicitudes</CardTitle>
            <a
              href={`/transportes/exportar${queryString ? `?${queryString}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Exportar a Excel
            </a>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FiltrosForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha sol.</TableHead>
                <TableHead>Solicita</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Objeto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Peso</TableHead>
                <TableHead>Refrig.</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Fecha traslado</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Recibe</TableHead>
                <TableHead>Urgencia</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(solicitudes ?? []).map((s) => (
                <TableRow
                  key={s.id}
                  className={cn(
                    s.urgencia === "Urgente" && "bg-destructive/5",
                  )}
                >
                  <TableCell>{formatFecha(s.fecha_solicitud)}</TableCell>
                  <TableCell className="font-medium">{s.solicitante_nombre}</TableCell>
                  <TableCell>{s.area_solicitante}</TableCell>
                  <TableCell>{s.descripcion_objeto}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.cantidad}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.peso_aprox_kg ?? "—"}
                  </TableCell>
                  <TableCell>
                    {s.requiere_refrigeracion ? (
                      <Badge variant="secondary">Sí</Badge>
                    ) : (
                      "No"
                    )}
                  </TableCell>
                  <TableCell>{s.origen}</TableCell>
                  <TableCell>{s.destino}</TableCell>
                  <TableCell>{formatFecha(s.fecha_traslado)}</TableCell>
                  <TableCell>{s.hora_traslado.slice(0, 5)}</TableCell>
                  <TableCell>{s.quien_recibe}</TableCell>
                  <TableCell>
                    <Badge variant={s.urgencia === "Urgente" ? "destructive" : "outline"}>
                      {s.urgencia}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ReenviarButton id={s.id} />
                  </TableCell>
                </TableRow>
              ))}
              {(solicitudes ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground">
                    {hayFiltros
                      ? "Sin solicitudes para estos filtros."
                      : "Sin solicitudes todavía."}
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
