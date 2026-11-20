import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
import { Badge } from "@/components/ui/badge";
import { PEDIDO_ESTADO_LABELS } from "../estado-select";
import { ReenviarButton } from "../reenviar-button";

function formatFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "dd/MM/yyyy");
}

export default async function PedidoInsumosDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["jefe_planta", "asistente_adm", "planeacion"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos_insumos")
    .select("id, folio, program_id, fecha_requerida, observaciones, estado, enviado_por, enviado_at")
    .eq("id", id)
    .single();
  if (!pedido) notFound();

  const [
    { data: program },
    { data: solicitante },
    { data: ordenes },
    { data: lineas },
  ] = await Promise.all([
    supabase
      .from("production_programs")
      .select("week_start_date")
      .eq("id", pedido.program_id)
      .single(),
    supabase.from("profiles").select("full_name").eq("id", pedido.enviado_por).single(),
    supabase
      .from("pedidos_insumos_ordenes")
      .select("tipo, production_order_id, envasado_order_id")
      .eq("pedido_id", pedido.id),
    supabase
      .from("pedidos_insumos_lineas")
      .select("insumo_tipo, insumo_id, cantidad_requerida, cantidad_pedida")
      .eq("pedido_id", pedido.id),
  ]);

  const ordenBacheIds = (ordenes ?? [])
    .filter((o) => o.tipo === "bache" && o.production_order_id)
    .map((o) => o.production_order_id as string);
  const ordenEnvasadoIds = (ordenes ?? [])
    .filter((o) => o.tipo === "envasado" && o.envasado_order_id)
    .map((o) => o.envasado_order_id as string);
  const materiaPrimaIds = (lineas ?? [])
    .filter((l) => l.insumo_tipo === "materia_prima")
    .map((l) => l.insumo_id);
  const empaqueIds = (lineas ?? [])
    .filter((l) => l.insumo_tipo === "empaque")
    .map((l) => l.insumo_id);

  const [
    { data: ordenesBache },
    { data: ordenesEnvasado },
    { data: materiaPrimaInsumos },
    { data: empaqueInsumos },
  ] = await Promise.all([
    ordenBacheIds.length > 0
      ? supabase
          .from("production_orders")
          .select("id, product_id, scheduled_date, orden_codigo")
          .in("id", ordenBacheIds)
      : Promise.resolve({ data: [] as { id: string; product_id: string; scheduled_date: string; orden_codigo: string | null }[] }),
    ordenEnvasadoIds.length > 0
      ? supabase
          .from("envasado_orders")
          .select("id, referencia_id, scheduled_date")
          .in("id", ordenEnvasadoIds)
      : Promise.resolve({ data: [] as { id: string; referencia_id: string; scheduled_date: string }[] }),
    materiaPrimaIds.length > 0
      ? supabase.from("insumos").select("id, name, unit, codigo").in("id", materiaPrimaIds)
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string; codigo: string | null }[] }),
    empaqueIds.length > 0
      ? supabase.from("envasado_insumos").select("id, name, unit, codigo").in("id", empaqueIds)
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string; codigo: string | null }[] }),
  ]);

  const productIds = (ordenesBache ?? []).map((o) => o.product_id);
  const referenciaIds = (ordenesEnvasado ?? []).map((o) => o.referencia_id);
  const [{ data: products }, { data: referencias }] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    referenciaIds.length > 0
      ? supabase.from("envasado_referencias").select("id, sku, name").in("id", referenciaIds)
      : Promise.resolve({ data: [] as { id: string; sku: string; name: string }[] }),
  ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const referenciasById = new Map((referencias ?? []).map((r) => [r.id, r]));
  const materiaPrimaById = new Map((materiaPrimaInsumos ?? []).map((i) => [i.id, i]));
  const empaqueById = new Map((empaqueInsumos ?? []).map((i) => [i.id, i]));

  const ordenesDisplay = [
    ...(ordenesBache ?? []).map((o) => ({
      tipo: "Bache" as const,
      codigo: o.orden_codigo ?? "—",
      producto: productNames.get(o.product_id) ?? "—",
      fecha: formatFecha(o.scheduled_date),
    })),
    ...(ordenesEnvasado ?? []).map((o) => {
      const ref = referenciasById.get(o.referencia_id);
      return {
        tipo: "Envasado" as const,
        codigo: ref ? `${ref.sku} — ${ref.name}` : "—",
        producto: ref?.name ?? "—",
        fecha: formatFecha(o.scheduled_date),
      };
    }),
  ];

  const lineasDisplay = (lineas ?? []).map((l) => {
    const info = l.insumo_tipo === "materia_prima" ? materiaPrimaById.get(l.insumo_id) : empaqueById.get(l.insumo_id);
    return {
      categoria: l.insumo_tipo === "materia_prima" ? "Materia prima" : "Material de empaque",
      codigo: info?.codigo ?? "—",
      nombre: info?.name ?? "—",
      unidad: info?.unit ?? "—",
      cantidadRequerida: Math.round(l.cantidad_requerida * 100) / 100,
      cantidadPedida: l.cantidad_pedida,
    };
  });

  const semanaLabel = program
    ? format(new Date(`${program.week_start_date}T00:00:00`), "d 'de' MMMM, yyyy", { locale: es })
    : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pedido de insumos N.º {pedido.folio}</h1>
          <p className="text-muted-foreground">
            Semana del {semanaLabel} · Solicitó {solicitante?.full_name ?? "—"} ·{" "}
            {format(new Date(pedido.enviado_at), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{PEDIDO_ESTADO_LABELS[pedido.estado]}</Badge>
          <ReenviarButton pedidoId={pedido.id} />
        </div>
      </div>

      {(pedido.fecha_requerida || pedido.observaciones) && (
        <div className="flex flex-col gap-1 text-sm">
          {pedido.fecha_requerida && (
            <p>
              <span className="font-medium">Fecha requerida de entrega:</span>{" "}
              {formatFecha(pedido.fecha_requerida)}
            </p>
          )}
          {pedido.observaciones && (
            <p>
              <span className="font-medium">Observaciones:</span> {pedido.observaciones}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Órdenes incluidas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Orden / Referencia</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenesDisplay.map((o, i) => (
              <TableRow key={i}>
                <TableCell>{o.tipo}</TableCell>
                <TableCell className="font-medium">{o.codigo}</TableCell>
                <TableCell>{o.producto}</TableCell>
                <TableCell>{o.fecha}</TableCell>
              </TableRow>
            ))}
            {ordenesDisplay.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin órdenes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Insumos pedidos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Requerido</TableHead>
              <TableHead>Pedido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineasDisplay.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.categoria}</TableCell>
                <TableCell className="text-muted-foreground">{l.codigo}</TableCell>
                <TableCell className="font-medium">{l.nombre}</TableCell>
                <TableCell className="text-muted-foreground">{l.unidad}</TableCell>
                <TableCell>{l.cantidadRequerida}</TableCell>
                <TableCell>{l.cantidadPedida}</TableCell>
              </TableRow>
            ))}
            {lineasDisplay.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sin insumos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
