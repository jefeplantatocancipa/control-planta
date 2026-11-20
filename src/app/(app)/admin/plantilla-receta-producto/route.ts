import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";

const HEADERS = [
  "Producto",
  "Insumo",
  "Cantidad kg/1000L",
  "Tolerancia inferior %",
  "Tolerancia superior %",
  "Obligatorio (Si/No)",
];

export async function GET() {
  await requireRole(["jefe_planta"]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Receta");

  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF005240" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const exampleRow = sheet.addRow([
    "Yogurt Griego Entero Natural De La Cuesta 450 g",
    "Leche entera",
    "920",
    "5",
    "5",
    "Si",
  ]);
  exampleRow.font = { italic: true, color: { argb: "FF888888" } };

  sheet.columns = [{ width: 36 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-receta-producto.xlsx"',
    },
  });
}
