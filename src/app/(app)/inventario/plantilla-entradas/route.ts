import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";

const HEADERS = ["Codigo", "Cantidad", "Lote", "Proveedor"];

export async function GET() {
  await requireRole(["jefe_planta", "supervisor"]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Entradas");

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

  const exampleRow = sheet.addRow(["13101010218", "30", "L-2026-045", "Distribuidora XYZ"]);
  exampleRow.font = { italic: true, color: { argb: "FF888888" } };

  sheet.columns = [{ width: 20 }, { width: 14 }, { width: 18 }, { width: 26 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-entradas-inventario.xlsx"',
    },
  });
}
