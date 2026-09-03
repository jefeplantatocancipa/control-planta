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

// Solo la fecha (sin hora): las celdas de fecha de Excel se leen como Date
// con los componentes de calendario en los accesores UTC, independientemente
// de la zona horaria del servidor que corre el importador.
export function excelDateOnlyToISO(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Fecha+hora: se interpreta el valor de la celda como hora de Bogotá (que es
// la que escribió la planta) y se convierte a un instante UTC real para
// guardarlo en una columna timestamptz.
export function excelDateTimeToBogotaISO(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
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

// Lunes (UTC) de la semana ISO que contiene la fecha dada ("YYYY-MM-DD").
export function mondayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}
