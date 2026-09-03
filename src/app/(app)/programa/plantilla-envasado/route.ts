import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";

const HEADERS = [
  "FECHA",
  "Linea",
  "SKU",
  "Descripción",
  "Und Programadas",
  "Total Empacado",
  "Pendiente por envasar Unds.",
  "Gramaje x UND",
  "Kg. TOTALES PEDIDO",
];

export async function GET() {
  await requireRole(["jefe_planta", "supervisor"]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programa Envasado");

  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F6FC5" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const exampleRow = sheet.addRow([
    new Date(2026, 7, 29),
    "EMPACADORA N° 1",
    "15256711188",
    "YOGURT GRIEGO ENTERO NATURAL DE LA CUESTA 450 g",
    13000,
    0,
    -13000,
    450,
    0,
  ]);
  exampleRow.getCell(1).numFmt = "m/d/yyyy";
  exampleRow.font = { italic: true, color: { argb: "FF888888" } };

  sheet.columns = [
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 40 },
    { width: 16 },
    { width: 14 },
    { width: 22 },
    { width: 14 },
    { width: 18 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-programa-envasado.xlsx"',
    },
  });
}
