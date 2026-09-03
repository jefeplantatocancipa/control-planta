import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";

const HEADERS = ["Nombre del insumo", "Presentación por caja", "Marca o marcas"];

export async function GET() {
  await requireRole(["jefe_planta"]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Material de empaque");

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

  const exampleRow = sheet.addRow(["Vaso 450 g", "500 unidades x caja", "Plastienvases"]);
  exampleRow.font = { italic: true, color: { argb: "FF888888" } };

  sheet.columns = [{ width: 28 }, { width: 26 }, { width: 24 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-insumos-empaque.xlsx"',
    },
  });
}
