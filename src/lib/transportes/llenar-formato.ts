import "server-only";
import JSZip from "jszip";
import { PLANTILLA_TRANSPORTE_BASE64 } from "./plantilla-transporte-base64";

const SHEET_PATH = "xl/worksheets/sheet1.xml";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Excel guarda fechas y horas como número de serie (días desde 1899-12-30).
export function serialFecha(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}

export function serialHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60 + m) / 1440;
}

// Escribe valores en la fila 2 de Formato_Solicitud_de_Transporte.xlsx
// conservando el estilo (s="...") de cada celda -- nunca reconstruye el
// libro con ExcelJS, porque eso cambia estilos y duplica las validaciones
// de datos de la plantilla oficial. Solo toca xl/worksheets/sheet1.xml
// dentro del .zip; todo lo demás (estilos, hoja de cálculo, 8
// validaciones, protección) queda byte a byte igual al original.
export async function llenarFormatoTransporte(
  valores: Record<string, string | number | null | undefined>,
): Promise<Buffer> {
  const plantilla = Buffer.from(PLANTILLA_TRANSPORTE_BASE64, "base64");
  const zip = await JSZip.loadAsync(plantilla);
  const sheetFile = zip.file(SHEET_PATH);
  if (!sheetFile) {
    throw new Error(`No se encontró ${SHEET_PATH} en la plantilla.`);
  }
  let xml = await sheetFile.async("string");

  for (const [col, v] of Object.entries(valores)) {
    if (v === null || v === undefined || v === "") continue;
    const re = new RegExp(`<c r="${col}2" s="(\\d+)"\\s*/>`);
    const match = xml.match(re);
    if (!match) {
      throw new Error(`Celda ${col}2 no encontrada en la plantilla.`);
    }
    const style = match[1];
    const cell =
      typeof v === "number"
        ? `<c r="${col}2" s="${style}"><v>${v}</v></c>`
        : `<c r="${col}2" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    xml = xml.replace(re, cell);
  }

  // createFolders: false -- sin esto, JSZip agrega entradas de carpeta
  // ("xl/", "xl/worksheets/") que no existen en el .xlsx original.
  zip.file(SHEET_PATH, xml, { createFolders: false });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return buffer;
}
