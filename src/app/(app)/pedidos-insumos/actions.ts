"use server";

import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { sendMailWithAttachment } from "@/lib/email/send-mail";
import { calcularPedidoInsumos } from "@/lib/pedido-insumos-calculo";
import { generarExcelPedidoInsumos, type PedidoExcelOrden, type PedidoExcelLinea } from "./excel-pedido";
import type { UserRole } from "@/lib/supabase/types";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const ROLES: UserRole[] = ["jefe_planta", "asistente_adm", "planeacion"];

// fecha_requerida/scheduled_date son columnas "date" planas (sin hora) --
// mismo cuidado que en transportes/actions.ts para no correrlas un día.
function formatFecha(fecha: string) {
  return format(new Date(`${fecha}T00:00:00`), "dd/MM/yyyy");
}

const PedidoOrdenSchema = z.object({
  tipo: z.enum(["bache", "envasado"]),
  id: z.string().uuid(),
});
const PedidoLineaSchema = z.object({
  insumo_tipo: z.enum(["materia_prima", "empaque"]),
  insumo_id: z.string().uuid(),
  cantidad_requerida: z.number(),
  cantidad_pedida: z.number().positive(),
});
const PedidoPayloadSchema = z.object({
  program_id: z.string().uuid({ message: "Elegí una semana." }),
  fecha_requerida: z.string().nullable(),
  observaciones: z.string().nullable(),
  ordenes: z.array(PedidoOrdenSchema).min(1, "Marcá al menos una orden."),
  lineas: z.array(PedidoLineaSchema).min(1, "No hay insumos para pedir."),
});

export async function crearPedidoInsumos(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireRole(ROLES);

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") || ""));
  } catch {
    return { error: "Datos inválidos." };
  }
  const parsed = PedidoPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const { data: config } = await supabase
    .from("pedido_insumos_config")
    .select("destinatario_email")
    .maybeSingle();
  if (!config?.destinatario_email) {
    return { error: "No hay un destinatario configurado en Administración todavía." };
  }

  const ordenBacheIds = data.ordenes.filter((o) => o.tipo === "bache").map((o) => o.id);
  const ordenEnvasadoIds = data.ordenes.filter((o) => o.tipo === "envasado").map((o) => o.id);

  const [
    { data: ordenesBache },
    { data: ordenesEnvasado },
    { data: recetaBache },
    { data: recetaEnvasado },
    { data: insumosExcluidosRows },
  ] = await Promise.all([
    ordenBacheIds.length > 0
      ? supabase
          .from("production_orders")
          .select("id, program_id, product_id, scheduled_date, baches_planeados, orden_codigo")
          .in("id", ordenBacheIds)
      : Promise.resolve({ data: [] as never[] }),
    ordenEnvasadoIds.length > 0
      ? supabase
          .from("envasado_orders")
          .select("id, program_id, referencia_id, scheduled_date, planned_quantity")
          .in("id", ordenEnvasadoIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("product_insumos").select("product_id, insumo_id, cantidad_kg_por_bache"),
    supabase
      .from("envasado_referencia_insumos")
      .select("referencia_id, envasado_insumo_id, cantidad_por_unidad"),
    supabase.from("insumos").select("id").eq("excluir_pedido_programa", true),
  ]);

  // Todas las órdenes seleccionadas tienen que ser de la misma semana que
  // program_id -- si alguna no calza (programa borrado/cambiado entre que se
  // cargó la pantalla y que se envió), se corta acá en vez de guardar un
  // pedido inconsistente.
  const ordenesBacheValidas = (ordenesBache ?? []).filter((o) => o.program_id === data.program_id);
  const ordenesEnvasadoValidas = (ordenesEnvasado ?? []).filter(
    (o) => o.program_id === data.program_id,
  );
  if (
    ordenesBacheValidas.length !== ordenBacheIds.length ||
    ordenesEnvasadoValidas.length !== ordenEnvasadoIds.length
  ) {
    return { error: "Alguna orden seleccionada ya no pertenece a esta semana. Volvé a calcular." };
  }

  // Cantidad requerida siempre se recalcula server-side -- nunca se confía
  // en lo que mande el cliente, solo en la cantidad a pedir (editable).
  const calculado = calcularPedidoInsumos({
    ordenesBache: ordenesBacheValidas.map((o) => ({
      id: o.id,
      product_id: o.product_id,
      baches_planeados: o.baches_planeados,
    })),
    ordenesEnvasado: ordenesEnvasadoValidas.map((o) => ({
      id: o.id,
      referencia_id: o.referencia_id,
      planned_quantity: o.planned_quantity,
    })),
    recetaBache: recetaBache ?? [],
    recetaEnvasado: recetaEnvasado ?? [],
    insumosExcluidos: new Set((insumosExcluidosRows ?? []).map((i) => i.id)),
  });
  const requeridoPorClave = new Map(
    calculado.map((c) => [`${c.insumoTipo}:${c.insumoId}`, c.cantidadRequerida]),
  );

  const lineasFinales = data.lineas
    .map((l) => ({
      insumo_tipo: l.insumo_tipo,
      insumo_id: l.insumo_id,
      cantidad_requerida: requeridoPorClave.get(`${l.insumo_tipo}:${l.insumo_id}`) ?? 0,
      cantidad_pedida: l.cantidad_pedida,
    }))
    .filter((l) => l.cantidad_requerida > 0);

  if (lineasFinales.length === 0) {
    return { error: "No hay insumos para pedir con las órdenes seleccionadas." };
  }

  const { data: pedido, error: insertPedidoError } = await supabase
    .from("pedidos_insumos")
    .insert({
      program_id: data.program_id,
      fecha_requerida: data.fecha_requerida,
      observaciones: data.observaciones,
      enviado_por: profile.id,
    })
    .select("id, folio, enviado_at")
    .single();
  if (insertPedidoError || !pedido) {
    return { error: "No se pudo crear el pedido." };
  }

  const { error: ordenesError } = await supabase.from("pedidos_insumos_ordenes").insert([
    ...ordenesBacheValidas.map((o) => ({
      pedido_id: pedido.id,
      tipo: "bache" as const,
      production_order_id: o.id,
    })),
    ...ordenesEnvasadoValidas.map((o) => ({
      pedido_id: pedido.id,
      tipo: "envasado" as const,
      envasado_order_id: o.id,
    })),
  ]);
  if (ordenesError) {
    return { error: "No se pudo registrar las órdenes del pedido." };
  }

  const { error: lineasError } = await supabase
    .from("pedidos_insumos_lineas")
    .insert(lineasFinales.map((l) => ({ pedido_id: pedido.id, ...l })));
  if (lineasError) {
    return { error: "No se pudo registrar los insumos del pedido." };
  }

  // Nombres para el Excel/correo -- consultas separadas en vez de un join
  // embebido (mismo estilo que el resto del repo: queries planas + Map en
  // código de aplicación).
  const productIds = ordenesBacheValidas.map((o) => o.product_id);
  const referenciaIds = ordenesEnvasadoValidas.map((o) => o.referencia_id);
  const materiaPrimaIds = lineasFinales
    .filter((l) => l.insumo_tipo === "materia_prima")
    .map((l) => l.insumo_id);
  const empaqueIds = lineasFinales
    .filter((l) => l.insumo_tipo === "empaque")
    .map((l) => l.insumo_id);

  const [
    { data: products },
    { data: referencias },
    { data: materiaPrimaInsumos },
    { data: empaqueInsumos },
    { data: program },
  ] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    referenciaIds.length > 0
      ? supabase.from("envasado_referencias").select("id, sku, name").in("id", referenciaIds)
      : Promise.resolve({ data: [] as { id: string; sku: string; name: string }[] }),
    materiaPrimaIds.length > 0
      ? supabase.from("insumos").select("id, name, unit, codigo").in("id", materiaPrimaIds)
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string; codigo: string | null }[] }),
    empaqueIds.length > 0
      ? supabase.from("envasado_insumos").select("id, name, unit, codigo").in("id", empaqueIds)
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string; codigo: string | null }[] }),
    supabase.from("production_programs").select("week_start_date").eq("id", data.program_id).single(),
  ]);

  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));
  const referenciasById = new Map((referencias ?? []).map((r) => [r.id, r]));
  const materiaPrimaById = new Map((materiaPrimaInsumos ?? []).map((i) => [i.id, i]));
  const empaqueById = new Map((empaqueInsumos ?? []).map((i) => [i.id, i]));

  const ordenesExcel: PedidoExcelOrden[] = [
    ...ordenesBacheValidas.map((o) => ({
      tipo: "bache" as const,
      codigo: o.orden_codigo ?? "—",
      producto: productNames.get(o.product_id) ?? "—",
      fecha: formatFecha(o.scheduled_date),
    })),
    ...ordenesEnvasadoValidas.map((o) => {
      const ref = referenciasById.get(o.referencia_id);
      return {
        tipo: "envasado" as const,
        codigo: ref ? `${ref.sku} — ${ref.name}` : "—",
        producto: ref?.name ?? "—",
        fecha: formatFecha(o.scheduled_date),
      };
    }),
  ];

  const lineasExcel: PedidoExcelLinea[] = lineasFinales.map((l) => {
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

  const excelBuffer = await generarExcelPedidoInsumos({ ordenes: ordenesExcel, lineas: lineasExcel });

  const semanaLabel = program
    ? format(new Date(`${program.week_start_date}T00:00:00`), "d 'de' MMMM, yyyy", { locale: es })
    : "—";

  const filasHtml = lineasExcel
    .map(
      (l) =>
        `<tr><td>${l.categoria}</td><td>${l.codigo}</td><td>${l.nombre}</td><td>${l.unidad}</td><td>${l.cantidadPedida}</td></tr>`,
    )
    .join("");
  const ordenesHtml = ordenesExcel
    .map((o) => `<li>${o.tipo === "bache" ? "Bache" : "Envasado"} ${o.codigo} — ${o.producto} (${o.fecha})</li>`)
    .join("");

  const html = `
    <p>Hola,</p>
    <p>Te comparto el pedido de insumos de la semana del ${semanaLabel}, planta Tocancipá.</p>
    <p><strong>Órdenes incluidas:</strong></p>
    <ul>${ordenesHtml}</ul>
    <p><strong>Insumos a pedir:</strong></p>
    <table border="1" cellpadding="4" cellspacing="0">
      <tr><th>Categoría</th><th>Código</th><th>Insumo</th><th>Unidad</th><th>Cantidad a pedir</th></tr>
      ${filasHtml}
    </table>
    ${data.fecha_requerida ? `<p><strong>Fecha requerida de entrega:</strong> ${formatFecha(data.fecha_requerida)}</p>` : ""}
    ${data.observaciones ? `<p><strong>Observaciones:</strong> ${data.observaciones}</p>` : ""}
    <p>Solicita: ${profile.full_name}</p>
  `;
  const text = `Pedido de insumos N.º ${pedido.folio} -- semana del ${semanaLabel}. Detalle en el Excel adjunto. Solicita: ${profile.full_name}.`;

  try {
    await sendMailWithAttachment({
      to: config.destinatario_email,
      cc: profile.email ?? undefined,
      subject: `Pedido de insumos N.º ${pedido.folio} – Semana del ${semanaLabel} – Planta Tocancipá`,
      text,
      html,
      attachment: {
        filename: `pedido-insumos-${pedido.folio}.xlsx`,
        content: excelBuffer,
      },
    });
  } catch {
    return {
      error:
        "El pedido quedó registrado pero el correo no se pudo enviar. Avisá para revisarlo (podés reenviarlo desde el historial).",
    };
  }

  revalidatePath("/pedidos-insumos");
  return { success: true };
}
