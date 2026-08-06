import Link from "next/link";
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
import { NewBacheDialog } from "./new-bache-dialog";
import type { BacheStatus } from "@/lib/supabase/types";

const STATUS_LABELS: Record<BacheStatus, string> = {
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

const STATUS_VARIANTS: Record<BacheStatus, "default" | "outline" | "secondary"> = {
  en_proceso: "default",
  completado: "secondary",
  cancelado: "outline",
};

export default async function BachesPage() {
  await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const [{ data: baches }, { data: products }, { data: orders }] =
    await Promise.all([
      supabase
        .from("baches")
        .select("*")
        .order("started_at", { ascending: false }),
      supabase.from("products").select("*").order("name"),
      supabase
        .from("production_orders")
        .select("*")
        .in("status", ["pendiente", "en_proceso"])
        .order("scheduled_date"),
    ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Preparación de baches</h1>
          <p className="text-muted-foreground">
            Crear baches y capturar cada una de las 8 etapas.
          </p>
        </div>
        <NewBacheDialog products={(products ?? []).filter((p) => p.active)} orders={orders ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Volumen</TableHead>
            <TableHead>Iniciado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(baches ?? []).map((bache) => (
            <TableRow key={bache.id}>
              <TableCell className="font-medium">{bache.batch_code}</TableCell>
              <TableCell>{productNames.get(bache.product_id) ?? "—"}</TableCell>
              <TableCell>
                {bache.volumen_total_litros
                  ? `${bache.volumen_total_litros} L`
                  : "—"}
              </TableCell>
              <TableCell>
                {new Date(bache.started_at).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[bache.status]}>
                  {STATUS_LABELS[bache.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/baches/${bache.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {(baches ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin baches todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
