import { sendMailWithAttachment } from "@/lib/email/send-mail";
import {
  generarExcelPedidoInsumos,
  type PedidoExcelOrden,
  type PedidoExcelLinea,
} from "./excel-pedido";

// Compartido entre crearPedidoInsumos y reenviarPedidoInsumos -- arma el
// mismo Excel/correo a partir de los datos ya normalizados (ver
// PedidoExcelOrden/PedidoExcelLinea), sin importar si vienen recién
// calculados o leídos de vuelta de la base.
export async function enviarCorreoPedido(input: {
  folio: number;
  semanaLabel: string;
  fechaRequeridaLabel: string | null;
  observaciones: string | null;
  solicitanteNombre: string;
  destinatario: string;
  cc?: string;
  ordenes: PedidoExcelOrden[];
  lineas: PedidoExcelLinea[];
}) {
  const excelBuffer = await generarExcelPedidoInsumos({
    ordenes: input.ordenes,
    lineas: input.lineas,
  });

  const filasHtml = input.lineas
    .map(
      (l) =>
        `<tr><td>${l.categoria}</td><td>${l.codigo}</td><td>${l.nombre}</td><td>${l.unidad}</td><td>${l.cantidadPedida}</td></tr>`,
    )
    .join("");
  const ordenesHtml = input.ordenes
    .map(
      (o) =>
        `<li>${o.tipo === "bache" ? "Bache" : "Envasado"} ${o.codigo} — ${o.producto} (${o.fecha})</li>`,
    )
    .join("");

  const html = `
    <p>Hola,</p>
    <p>Te comparto el pedido de insumos de la semana del ${input.semanaLabel}, planta Tocancipá.</p>
    <p><strong>Órdenes incluidas:</strong></p>
    <ul>${ordenesHtml}</ul>
    <p><strong>Insumos a pedir:</strong></p>
    <table border="1" cellpadding="4" cellspacing="0">
      <tr><th>Categoría</th><th>Código</th><th>Insumo</th><th>Unidad</th><th>Cantidad a pedir</th></tr>
      ${filasHtml}
    </table>
    ${input.fechaRequeridaLabel ? `<p><strong>Fecha requerida de entrega:</strong> ${input.fechaRequeridaLabel}</p>` : ""}
    ${input.observaciones ? `<p><strong>Observaciones:</strong> ${input.observaciones}</p>` : ""}
    <p>Solicita: ${input.solicitanteNombre}</p>
  `;
  const text = `Pedido de insumos N.º ${input.folio} -- semana del ${input.semanaLabel}. Detalle en el Excel adjunto. Solicita: ${input.solicitanteNombre}.`;

  await sendMailWithAttachment({
    to: input.destinatario,
    cc: input.cc,
    subject: `Pedido de insumos N.º ${input.folio} – Semana del ${input.semanaLabel} – Planta Tocancipá`,
    text,
    html,
    attachment: {
      filename: `pedido-insumos-${input.folio}.xlsx`,
      content: excelBuffer,
    },
  });
}
