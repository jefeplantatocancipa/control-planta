import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";

const HEADERS = [
  "Orden de Producción",
  "sku",
  "Nombres",
  "TANQUE",
  "Baches",
  "FECHA",
  "HORA INICIO",
  "HORA FINAL",
  "HORA INICIO REAL",
  "HORA FINAL REAL",
];

export async function GET() {
  await requireRole(["jefe_planta", "supervisor"]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programa Baches");

  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6B2D5C" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const exampleRow = sheet.addRow([
    "OPB35-005 01 T",
    "16256611235",
    "ENTERO DE LA CUESTA",
    "2",
    5,
    new Date(2026, 7, 28),
    new Date(2026, 7, 28, 14, 0),
    new Date(2026, 7, 29, 10, 0),
    "",
    "",
  ]);
  exampleRow.getCell(6).numFmt = "dddd, mmmm d, yyyy";
  exampleRow.getCell(7).numFmt = "ddd d mmm - hh:mm AM/PM";
  exampleRow.getCell(8).numFmt = "ddd d mmm - hh:mm AM/PM";
  exampleRow.font = { italic: true, color: { argb: "FF888888" } };

  sheet.columns = [
    { width: 18 },
    { width: 16 },
    { width: 26 },
    { width: 10 },
    { width: 8 },
    { width: 26 },
    { width: 24 },
    { width: 24 },
    { width: 20 },
    { width: 20 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-programa-baches.xlsx"',
    },
  });
}
