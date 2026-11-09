import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/delete-button";
import { RegistroConsumoDialog } from "./registro-dialog";
import { borrarConsumoServicio } from "./actions";
import { format } from "date-fns";

function fmt(n: number | null) {
  if (n === null) return "—";
  return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

// fecha es una columna `date` (sin hora) -- hay que anclarla a medianoche
// local, si no new Date("2026-11-04") se interpreta en UTC y el huso de
// Bogotá (UTC-5) la corre un día para atrás.
function fmtFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "dd/MM/yyyy");
}

export default async function ServiciosPage() {
  const profile = await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);
  const canRegistrar = profile.role !== "asistente_adm";
  const canBorrar = profile.role === "jefe_planta";

  const supabase = await createClient();
  const { data: registros } = await supabase
    .from("consumos_servicios")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(60);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Servicios públicos</h1>
          <p className="text-muted-foreground">
            Lectura diaria de los medidores de gas, agua del edificio y agua
            de producción. El consumo del día se calcula solo contra la
            última lectura registrada de cada medidor.
          </p>
        </div>
        {canRegistrar && <RegistroConsumoDialog />}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Lecturas recientes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Gas (m³)</TableHead>
              <TableHead>Agua edificio (m³)</TableHead>
              <TableHead>Agua producción (m³)</TableHead>
              <TableHead>Notas</TableHead>
              {canBorrar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(registros ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {fmtFecha(r.fecha)}
                  {r.estimado && (
                    <Badge variant="outline" className="ml-2">
                      Estimado
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {fmt(r.gas_consumo_m3)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    (lect. {fmt(r.gas_lectura_m3)})
                  </span>
                </TableCell>
                <TableCell>
                  {fmt(r.agua_edificio_consumo_m3)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    (lect. {fmt(r.agua_edificio_lectura_m3)})
                  </span>
                </TableCell>
                <TableCell>
                  {fmt(r.agua_produccion_consumo_m3)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    (lect. {fmt(r.agua_produccion_lectura_m3)})
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.observaciones ?? "—"}
                </TableCell>
                {canBorrar && (
                  <TableCell className="text-right">
                    <DeleteButton
                      action={borrarConsumoServicio}
                      id={r.id}
                      title="Eliminar lectura"
                      description={`Borra la lectura del ${fmtFecha(r.fecha)}. Esto puede afectar el cálculo de consumo del día siguiente registrado.`}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(registros ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={canBorrar ? 6 : 5} className="text-center text-muted-foreground">
                  Sin lecturas todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
