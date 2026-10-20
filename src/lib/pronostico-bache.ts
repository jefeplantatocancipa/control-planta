export interface PronosticoBache {
  bacheId: string;
  batchCode: string;
  productName: string;
  etapaActual: string;
  estimadoFin: string;
  faltaDato: boolean;
}

interface StageTemplateInput {
  id: string;
  product_id: string | null;
  name: string;
  sequence_order: number;
}

interface BacheInput {
  id: string;
  batch_code: string;
  product_id: string;
  status: string;
}

interface StageRecordInput {
  bache_id: string;
  stage_template_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface PronosticoInput {
  baches: BacheInput[];
  stageTemplates: StageTemplateInput[];
  products: { id: string; name: string }[];
  // Etapas ya cerradas de CUALQUIER bache -- base de la duración promedio
  // histórica por producto + etapa.
  registrosCerrados: StageRecordInput[];
  // La etapa EN CURSO de cada bache (no viene en registrosCerrados).
  registrosEnCurso: { bache_id: string; stage_template_id: string; started_at: string }[];
}

// Pronóstico de cuándo termina cada bache en proceso: desde la etapa actual
// (o la siguiente a iniciar) hasta el final de la secuencia, sumando la
// duración promedio histórica de cada etapa restante para ese mismo
// producto. Si falta dato histórico para alguna etapa, el pronóstico queda
// parcial (se avisa) en vez de inventar un número. Función pura (recibe los
// datos ya consultados) para poder reusarla en Equipos y en Proceso sin
// duplicar las consultas a Supabase.
export function pronosticosTerminacion(input: PronosticoInput): PronosticoBache[] {
  const { baches, stageTemplates, products, registrosCerrados, registrosEnCurso } = input;

  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  const stagesByProduct = new Map<string, StageTemplateInput[]>();
  const defaultStages: StageTemplateInput[] = [];
  for (const s of stageTemplates) {
    if (s.product_id) {
      const arr = stagesByProduct.get(s.product_id) ?? [];
      arr.push(s);
      stagesByProduct.set(s.product_id, arr);
    } else {
      defaultStages.push(s);
    }
  }
  function stagesFor(productId: string) {
    const own = stagesByProduct.get(productId);
    return (own && own.length > 0 ? own : defaultStages)
      .slice()
      .sort((a, b) => a.sequence_order - b.sequence_order);
  }
  const stageNameById = new Map(stageTemplates.map((s) => [s.id, s.name]));

  const bacheProductById = new Map(baches.map((b) => [b.id, b.product_id]));
  const promedioPorProductoEtapa = new Map<string, { sumaMin: number; cantidad: number }>();
  for (const r of registrosCerrados) {
    if (!r.ended_at) continue;
    const productId = bacheProductById.get(r.bache_id);
    if (!productId) continue;
    const minutos = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000;
    const key = `${productId}:${r.stage_template_id}`;
    const entry = promedioPorProductoEtapa.get(key) ?? { sumaMin: 0, cantidad: 0 };
    entry.sumaMin += minutos;
    entry.cantidad += 1;
    promedioPorProductoEtapa.set(key, entry);
  }
  function promedioMinDe(productId: string, stageTemplateId: string) {
    const entry = promedioPorProductoEtapa.get(`${productId}:${stageTemplateId}`);
    return entry && entry.cantidad > 0 ? entry.sumaMin / entry.cantidad : null;
  }

  const registrosPorBache = new Map<string, StageRecordInput[]>();
  for (const r of registrosCerrados) {
    const arr = registrosPorBache.get(r.bache_id) ?? [];
    arr.push(r);
    registrosPorBache.set(r.bache_id, arr);
  }
  const enCursoPorBache = new Map(registrosEnCurso.map((r) => [r.bache_id, r]));

  return baches
    .filter((b) => b.status === "en_proceso")
    .map((bache) => {
      const secuencia = stagesFor(bache.product_id);
      if (secuencia.length === 0) return null;
      const propios = registrosPorBache.get(bache.id) ?? [];
      const cerradasIds = new Set(propios.filter((r) => r.ended_at).map((r) => r.stage_template_id));
      const enCurso = enCursoPorBache.get(bache.id);

      let desde: number;
      let etapasRestantes: StageTemplateInput[];
      if (enCurso) {
        const stage = secuencia.find((s) => s.id === enCurso.stage_template_id);
        if (!stage) return null;
        etapasRestantes = secuencia.filter((s) => s.sequence_order >= stage.sequence_order);
        desde = new Date(enCurso.started_at).getTime();
      } else {
        etapasRestantes = secuencia.filter((s) => !cerradasIds.has(s.id));
        if (etapasRestantes.length === 0) return null;
        desde = Date.now();
      }

      let acumuladoMin = 0;
      let faltaDato = false;
      for (const stage of etapasRestantes) {
        const prom = promedioMinDe(bache.product_id, stage.id);
        if (prom == null) {
          faltaDato = true;
          continue;
        }
        acumuladoMin += prom;
      }
      const estimadoFin = new Date(desde + acumuladoMin * 60000).toISOString();
      return {
        bacheId: bache.id,
        batchCode: bache.batch_code,
        productName: productNameById.get(bache.product_id) ?? "—",
        etapaActual: enCurso ? stageNameById.get(enCurso.stage_template_id) ?? "—" : "Sin iniciar",
        estimadoFin,
        faltaDato,
      };
    })
    .filter((p): p is PronosticoBache => p !== null)
    .sort((a, b) => a.estimadoFin.localeCompare(b.estimadoFin));
}
