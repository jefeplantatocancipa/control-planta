import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NuevoPedidoForm } from "./nuevo-pedido-form";

export default async function NuevoPedidoInsumosPage() {
  const profile = await requireRole(["jefe_planta", "asistente_adm", "planeacion"]);
  const supabase = await createClient();

  const [
    { data: programs },
    { data: orders },
    { data: envasadoOrders },
    { data: products },
    { data: envasadoReferencias },
    { data: productInsumos },
    { data: envasadoReferenciaInsumos },
    { data: insumos },
    { data: envasadoInsumos },
    { data: stock },
    { data: pedidos },
    { data: pedidosOrdenes },
    { data: config },
  ] = await Promise.all([
    supabase
      .from("production_programs")
      .select("id, week_start_date")
      .order("week_start_date", { ascending: false }),
    supabase
      .from("production_orders")
      .select("id, program_id, product_id, scheduled_date, baches_planeados, orden_codigo, tanque")
      .order("scheduled_date"),
    supabase
      .from("envasado_orders")
      .select("id, program_id, referencia_id, scheduled_date, planned_quantity, linea")
      .order("scheduled_date"),
    supabase.from("products").select("id, name").order("name"),
    supabase.from("envasado_referencias").select("id, sku, name, product_id"),
    supabase.from("product_insumos").select("product_id, insumo_id, cantidad_kg_por_bache"),
    supabase
      .from("envasado_referencia_insumos")
      .select("referencia_id, envasado_insumo_id, cantidad_por_unidad"),
    supabase
      .from("insumos")
      .select("id, name, unit, codigo, excluir_pedido_programa")
      .eq("active", true),
    supabase.from("envasado_insumos").select("id, name, unit, codigo").eq("active", true),
    supabase
      .from("v_inventario_stock")
      .select("insumo_tipo, insumo_id, stock_actual")
      .in("insumo_tipo", ["materia_prima", "empaque"]),
    supabase.from("pedidos_insumos").select("id, folio, enviado_at"),
    supabase.from("pedidos_insumos_ordenes").select("pedido_id, production_order_id, envasado_order_id"),
    supabase.from("pedido_insumos_config").select("destinatario_email").maybeSingle(),
  ]);

  // Qué órdenes ya aparecieron en un pedido anterior -- no bloquea, solo
  // avisa (ver plan: "nunca bloqueo, solo aviso").
  const pedidoById = new Map((pedidos ?? []).map((p) => [p.id, p]));
  const pedidoPorOrdenBache = new Map<string, { folio: number; enviado_at: string }>();
  const pedidoPorOrdenEnvasado = new Map<string, { folio: number; enviado_at: string }>();
  for (const po of pedidosOrdenes ?? []) {
    const pedido = pedidoById.get(po.pedido_id);
    if (!pedido) continue;
    if (po.production_order_id) {
      pedidoPorOrdenBache.set(po.production_order_id, pedido);
    }
    if (po.envasado_order_id) {
      pedidoPorOrdenEnvasado.set(po.envasado_order_id, pedido);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Pedido de insumos</h1>
        <p className="text-muted-foreground">
          Elegí la semana y las órdenes a cubrir -- la cantidad de insumos se
          calcula sola a partir de las recetas.
        </p>
      </div>
      <NuevoPedidoForm
        profileEmail={profile.email}
        programs={programs ?? []}
        orders={orders ?? []}
        envasadoOrders={envasadoOrders ?? []}
        products={products ?? []}
        envasadoReferencias={envasadoReferencias ?? []}
        productInsumos={productInsumos ?? []}
        envasadoReferenciaInsumos={envasadoReferenciaInsumos ?? []}
        insumos={insumos ?? []}
        envasadoInsumos={envasadoInsumos ?? []}
        stock={stock ?? []}
        pedidoPorOrdenBache={Object.fromEntries(pedidoPorOrdenBache)}
        pedidoPorOrdenEnvasado={Object.fromEntries(pedidoPorOrdenEnvasado)}
        destinatarioEmail={config?.destinatario_email ?? null}
      />
    </div>
  );
}
