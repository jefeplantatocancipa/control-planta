import ExcelJS from "exceljs";

export interface PedidoExcelOrden {
  tipo: "bache" | "envasado";
  codigo: string;
  producto: string;
  fecha: string;
}

export interface PedidoExcelLinea {
  categoria: "Materia prima" | "Material de empaque";
  codigo: string;
  nombre: string;
  unidad: string;
  cantidadRequerida: number;
  cantidadPedida: number;
}

function estiloEncabezado(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Poppins" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF005240" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

// Filas alternas con la marca fasalact (#f0eee9) -- la fuente Poppins se
// aplica a todas las filas de datos, el fondo alterno solo a una sí y una no.
function estiloFilas(sheet: ExcelJS.Worksheet) {
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    row.font = { name: "Poppins" };
    if (r % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0EEE9" } };
      });
    }
  }
}

export async function generarExcelPedidoInsumos(input: {
  ordenes: PedidoExcelOrden[];
  lineas: PedidoExcelLinea[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const ordenesSheet = workbook.addWorksheet("Órdenes incluidas");
  ordenesSheet.addRow(["Tipo", "Orden / Referencia", "Producto", "Fecha"]);
  estiloEncabezado(ordenesSheet.getRow(1));
  for (const o of input.ordenes) {
    ordenesSheet.addRow([o.tipo === "bache" ? "Bache" : "Envasado", o.codigo, o.producto, o.fecha]);
  }
  ordenesSheet.columns = [{ width: 14 }, { width: 26 }, { width: 36 }, { width: 14 }];
  estiloFilas(ordenesSheet);

  const lineasSheet = workbook.addWorksheet("Insumos a pedir");
  lineasSheet.addRow([
    "Categoría",
    "Código",
    "Insumo",
    "Unidad",
    "Cantidad requerida",
    "Cantidad a pedir",
  ]);
  estiloEncabezado(lineasSheet.getRow(1));
  for (const l of input.lineas) {
    lineasSheet.addRow([
      l.categoria,
      l.codigo,
      l.nombre,
      l.unidad,
      l.cantidadRequerida,
      l.cantidadPedida,
    ]);
  }
  lineasSheet.columns = [
    { width: 20 },
    { width: 14 },
    { width: 32 },
    { width: 12 },
    { width: 18 },
    { width: 16 },
  ];
  estiloFilas(lineasSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
