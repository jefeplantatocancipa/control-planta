// Verifica que llenar la plantilla de Transportes solo toca
// xl/worksheets/sheet1.xml dentro del .zip, que las demás partes del
// paquete quedan byte a byte idénticas, y que las 8 validaciones de datos y
// los estilos (atributo s="...") de las celdas de la fila 2 no cambian.
//
// Duplica (en JS plano, sin TS) la misma lógica de llenado que
// src/lib/transportes/llenar-formato.ts para poder correr este chequeo con
// node sin pasar por el build de Next.js.
//
// Uso: node scripts/verificar-plantilla-transporte.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const plantillaPath = path.join(
  root,
  "src/lib/transportes/Formato_Solicitud_de_Transporte.xlsx",
);
const SHEET_PATH = "xl/worksheets/sheet1.xml";

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function llenar(plantillaBuffer, valores) {
  const zip = await JSZip.loadAsync(plantillaBuffer);
  let xml = await zip.file(SHEET_PATH).async("string");
  for (const [col, v] of Object.entries(valores)) {
    if (v === null || v === undefined || v === "") continue;
    const re = new RegExp(`<c r="${col}2" s="(\\d+)"\\s*/>`);
    const m = xml.match(re);
    if (!m) throw new Error(`Celda ${col}2 no encontrada`);
    const cell =
      typeof v === "number"
        ? `<c r="${col}2" s="${m[1]}"><v>${v}</v></c>`
        : `<c r="${col}2" s="${m[1]}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    xml = xml.replace(re, cell);
  }
  zip.file(SHEET_PATH, xml, { createFolders: false });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

const ejemplo = {
  A: 45500, // fecha serial de ejemplo
  B: 0.375, // 09:00
  C: "Juan Pérez",
  D: "Planta Tocancipá",
  E: "Canecas de leche & \"muestras\" <especiales>",
  F: 5,
  G: 120,
  H: "Sí",
  I: "Planta Tocancipá",
  J: "Bodega Chía",
  K: 45501,
  L: 0.5,
  M: "María Gómez",
  N: "Urgente",
};

const original = readFileSync(plantillaPath);
const generado = await llenar(original, ejemplo);

const zipOriginal = await JSZip.loadAsync(original);
const zipGenerado = await JSZip.loadAsync(generado);

const nombresOriginal = Object.keys(zipOriginal.files).sort();
const nombresGenerado = Object.keys(zipGenerado.files).sort();

let ok = true;

if (JSON.stringify(nombresOriginal) !== JSON.stringify(nombresGenerado)) {
  ok = false;
  console.error("FALLÓ: la lista de archivos dentro del .zip cambió.");
  console.error("Original:", nombresOriginal);
  console.error("Generado:", nombresGenerado);
}

for (const nombre of nombresOriginal) {
  if (nombre === SHEET_PATH) continue;
  const bufOriginal = await zipOriginal.file(nombre).async("nodebuffer");
  const bufGenerado = await zipGenerado.file(nombre).async("nodebuffer");
  if (!bufOriginal.equals(bufGenerado)) {
    ok = false;
    console.error(`FALLÓ: ${nombre} cambió y no debería.`);
  }
}

const sheetGenerado = await zipGenerado.file(SHEET_PATH).async("string");
const sheetOriginal = await zipOriginal.file(SHEET_PATH).async("string");

const countMatch = sheetGenerado.match(/<dataValidations count="(\d+)">/);
if (!countMatch || countMatch[1] !== "8") {
  ok = false;
  console.error(`FALLÓ: se esperaban 8 validaciones de datos, hay ${countMatch?.[1] ?? "ninguna"}.`);
}

// Los estilos (s="...") de cada celda de la fila 2 tienen que ser los
// mismos antes y después de llenar -- solo cambia el contenido/tipo de la
// celda, nunca su formato.
for (const col of Object.keys(ejemplo)) {
  const estiloOriginal = sheetOriginal.match(new RegExp(`<c r="${col}2" s="(\\d+)"`))?.[1];
  const estiloGenerado = sheetGenerado.match(new RegExp(`<c r="${col}2" s="(\\d+)"`))?.[1];
  if (estiloOriginal !== estiloGenerado) {
    ok = false;
    console.error(`FALLÓ: el estilo de ${col}2 cambió (${estiloOriginal} -> ${estiloGenerado}).`);
  }
}

if (ok) {
  console.log("OK: solo cambió xl/worksheets/sheet1.xml, 8 validaciones intactas, estilos sin cambios.");
} else {
  process.exitCode = 1;
}
