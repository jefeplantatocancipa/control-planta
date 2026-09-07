import type ExcelJS from "exceljs";

// La planta opera en horario de Bogotá, sin horario de verano.
const BOGOTA_OFFSET_HOURS = 5;

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  if (typeof value === "object" && "result" in value) {
    return String(value.result ?? "").trim();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

const MONTHS_ES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// La planta a veces escribe la fecha como texto en español ("domingo,
// septiembre 06, 2026", "06 de septiembre de 2026") en vez de una celda de
// fecha real de Excel. Se intentan varios formatos comunes antes de darla
// por inválida.
function parseSpanishDateText(text: string): { y: number; m: number; d: number } | null {
  const norm = normalize(text);

  let match = norm.match(/,\s*([a-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (match) {
    const month = MONTHS_ES[match[1]];
    if (month) return { y: Number(match[3]), m: month, d: Number(match[2]) };
  }

  match = norm.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (match) {
    const month = MONTHS_ES[match[2]];
    if (month) return { y: Number(match[3]), m: month, d: Number(match[1]) };
  }

  match = norm.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };

  match = norm.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return { y: Number(match[3]), m: Number(match[2]), d: Number(match[1]) };

  return null;
}

// Igual que arriba pero para "HORA INICIO"/"HORA FINAL": texto como
// "dom 06 sept - 10:00 p. m." (sin año, se toma el de la FECHA de la misma
// fila porque esas columnas no lo incluyen).
function parseSpanishDateTimeText(
  text: string,
  fallbackYear: number,
): { y: number; m: number; d: number; h: number; min: number } | null {
  const norm = normalize(text);
  const match = norm.match(
    /(\d{1,2})\s+([a-z]+)\D*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/,
  );
  if (!match) return null;
  const month = MONTHS_ES[match[2]];
  if (!month) return null;

  let hour = Number(match[3]);
  const ampm = match[5];
  if (ampm === "p" && hour !== 12) hour += 12;
  if (ampm === "a" && hour === 12) hour = 0;

  return { y: fallbackYear, m: month, d: Number(match[1]), h: hour, min: Number(match[4]) };
}

// Solo la fecha (sin hora). Acepta tanto una celda de fecha real de Excel
// (Date, con los componentes de calendario en los accesores UTC) como texto
// en español (el formato que usa la plantilla real de la planta).
export function excelDateOnlyToISO(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  if (typeof value === "string") {
    const parsed = parseSpanishDateText(value);
    if (parsed) return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
  }
  return null;
}

// Fecha+hora: se interpreta el valor de la celda como hora de Bogotá (que es
// la que escribió la planta) y se convierte a un instante UTC real para
// guardarlo en una columna timestamptz. Igual que excelDateOnlyToISO, acepta
// tanto una celda de fecha real como texto en español; el texto no trae año
// propio, así que se usa el de la FECHA de la fila (fallbackYear).
export function excelDateTimeToBogotaISO(
  value: unknown,
  fallbackYear?: number,
): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const utcMs = Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours() + BOGOTA_OFFSET_HOURS,
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    );
    return new Date(utcMs).toISOString();
  }
  if (typeof value === "string" && fallbackYear) {
    const parsed = parseSpanishDateTimeText(value, fallbackYear);
    if (parsed) {
      const utcMs = Date.UTC(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.h + BOGOTA_OFFSET_HOURS,
        parsed.min,
      );
      return new Date(utcMs).toISOString();
    }
  }
  return null;
}

// Lunes (UTC) de la semana ISO que contiene la fecha dada ("YYYY-MM-DD").
export function mondayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}
