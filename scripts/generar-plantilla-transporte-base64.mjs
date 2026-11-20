// Regenera src/lib/transportes/plantilla-transporte-base64.ts a partir del
// .xlsx oficial. Se embebe en base64 como módulo JS en vez de leerlo con fs
// en runtime, para no depender de que Vercel incluya el binario en el
// bundle del Server Action (outputFileTracingIncludes es poco confiable
// para archivos leídos por ruta fija fuera de un import).
//
// Uso: node scripts/generar-plantilla-transporte-base64.mjs
// Correr de nuevo cada vez que cambie Formato_Solicitud_de_Transporte.xlsx.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const plantillaPath = path.join(
  root,
  "src/lib/transportes/Formato_Solicitud_de_Transporte.xlsx",
);
const salidaPath = path.join(
  root,
  "src/lib/transportes/plantilla-transporte-base64.ts",
);

const buffer = readFileSync(plantillaPath);
const base64 = buffer.toString("base64");

const contenido = `// Generado por scripts/generar-plantilla-transporte-base64.mjs a partir de
// Formato_Solicitud_de_Transporte.xlsx -- no editar a mano. Si cambia la
// plantilla oficial, reemplazá el .xlsx y volvé a correr el script.
export const PLANTILLA_TRANSPORTE_BASE64 = "${base64}";
`;

writeFileSync(salidaPath, contenido);
console.log(`Escrito ${salidaPath} (${buffer.length} bytes -> ${base64.length} caracteres base64)`);
