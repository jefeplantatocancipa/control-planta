// Cálculo de insumos requeridos a partir de órdenes del programa y las
// recetas de bache/envasado. Función pura (mismo espíritu que
// duracion-estandar.ts/pronostico-bache.ts) para reusarla tanto en la vista
// previa del cliente como en el recálculo server-side de la Server Action
// (nunca se confía en las cantidades que mande el cliente).

export interface RecetaBacheInsumo {
  product_id: string;
  insumo_id: string;
  cantidad_kg_por_bache: number | null;
}

export interface RecetaEnvasadoInsumo {
  referencia_id: string;
  envasado_insumo_id: string;
  cantidad_por_unidad: number | null;
}

export interface OrdenBacheSeleccionada {
  id: string;
  product_id: string;
  baches_planeados: number | null;
}

export interface OrdenEnvasadoSeleccionada {
  id: string;
  referencia_id: string;
  planned_quantity: number;
}

export type PedidoInsumoTipo = "materia_prima" | "empaque";

export interface InsumoCalculado {
  insumoTipo: PedidoInsumoTipo;
  insumoId: string;
  cantidadRequerida: number;
}

export function calcularPedidoInsumos(input: {
  ordenesBache: OrdenBacheSeleccionada[];
  ordenesEnvasado: OrdenEnvasadoSeleccionada[];
  recetaBache: RecetaBacheInsumo[];
  recetaEnvasado: RecetaEnvasadoInsumo[];
  insumosExcluidos: Set<string>;
}): InsumoCalculado[] {
  const totales = new Map<string, InsumoCalculado>();
  function sumar(tipo: PedidoInsumoTipo, id: string, cantidad: number) {
    if (!(cantidad > 0)) return;
    const key = `${tipo}:${id}`;
    const existente = totales.get(key);
    if (existente) existente.cantidadRequerida += cantidad;
    else totales.set(key, { insumoTipo: tipo, insumoId: id, cantidadRequerida: cantidad });
  }

  const recetaBachePorProducto = new Map<string, RecetaBacheInsumo[]>();
  for (const r of input.recetaBache) {
    const list = recetaBachePorProducto.get(r.product_id) ?? [];
    list.push(r);
    recetaBachePorProducto.set(r.product_id, list);
  }
  for (const orden of input.ordenesBache) {
    if (!orden.baches_planeados) continue;
    for (const r of recetaBachePorProducto.get(orden.product_id) ?? []) {
      if (r.cantidad_kg_por_bache == null) continue;
      if (input.insumosExcluidos.has(r.insumo_id)) continue;
      sumar("materia_prima", r.insumo_id, r.cantidad_kg_por_bache * orden.baches_planeados);
    }
  }

  const recetaEnvasadoPorReferencia = new Map<string, RecetaEnvasadoInsumo[]>();
  for (const r of input.recetaEnvasado) {
    const list = recetaEnvasadoPorReferencia.get(r.referencia_id) ?? [];
    list.push(r);
    recetaEnvasadoPorReferencia.set(r.referencia_id, list);
  }
  for (const orden of input.ordenesEnvasado) {
    for (const r of recetaEnvasadoPorReferencia.get(orden.referencia_id) ?? []) {
      if (r.cantidad_por_unidad == null) continue;
      sumar("empaque", r.envasado_insumo_id, r.cantidad_por_unidad * orden.planned_quantity);
    }
  }

  return Array.from(totales.values());
}
