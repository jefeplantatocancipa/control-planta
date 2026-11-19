import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "../constants";

const HEADERS = ["Nombre", "Apellido", "Rol"];

export async function GET() {
  await requireRole(["jefe_planta"]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usuarios");

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

  const exampleRow = sheet.addRow(["Juan", "Pérez", "Operario"]);
  exampleRow.font = { italic: true, color: { argb: "FF888888" } };

  sheet.addRow([]);
  const noteRow = sheet.addRow([
    `Roles válidos: ${Object.values(ROLE_LABELS).join(", ")}`,
  ]);
  noteRow.font = { italic: true, size: 9, color: { argb: "FFAAAAAA" } };

  sheet.columns = [{ width: 24 }, { width: 24 }, { width: 20 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-usuarios.xlsx"',
    },
  });
}
