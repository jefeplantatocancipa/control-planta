export interface PronosticoEnvasado {
  envasadoId: string;
  bacheId: string;
  presentacion: string;
  unidadesHechas: number;
  estimadoFin: string | null;
  faltaDato: boolean;
}

interface ReferenciaInput {
  id: string;
  sku: string;
  name: string;
  peso_unitario: number;
}

interface EnvasadoCerradoInput {
  referencia_id: string | null;
  presentacion: string;
  started_at: string;
  ended_at: string | null;
  cantidad_unidades: number;
}

interface EnvasadoAbiertoInput {
  id: string;
  bache_id: string;
  referencia_id: string | null;
  presentacion: string;
}

interface BacheInput {
  id: string;
  volumen_restante_litros: number | null;
}

export interface PronosticoEnvasadoInput {
  referencias: ReferenciaInput[];
  // Envasados YA cerrados de cualquier bache -- base de la velocidad
  // promedio histórica (unidades por hora) de cada referencia.
  envasadosCerrados: EnvasadoCerradoInput[];
  envasadosAbiertos: EnvasadoAbiertoInput[];
  baches: BacheInput[];
  // Unidades ya envasadas de cada envasado abierto (de envasado_estibas, en
  // vivo) -- no está en la tabla envasados mientras sigue en curso.
  unidadesHechasPorEnvasado: Map<string, number>;
}

// Pronóstico de cuándo termina de envasarse cada envasado en curso. La
// "meta" de unidades es el volumen que le queda al bache
// (volumen_restante_litros, en kg) convertido a unidades con el peso
// unitario de la referencia (presentación), y la velocidad es el promedio
// histórico de unidades por hora de esa misma referencia (igual idea que
// "Rendimiento de envasado por referencia" en Estadísticas). Si falta el
// peso unitario, el volumen restante del bache o datos históricos de esa
// referencia, el pronóstico queda sin estimar (se avisa) en vez de
// inventar un número.
export function pronosticosEnvasado(input: PronosticoEnvasadoInput): PronosticoEnvasado[] {
  const { referencias, envasadosCerrados, envasadosAbiertos, baches, unidadesHechasPorEnvasado } = input;

  const referenciaById = new Map(referencias.map((r) => [r.id, r]));
  const referenciaByLabel = new Map(referencias.map((r) => [`${r.sku} — ${r.name}`, r]));
  const referenciaByName = new Map(referencias.map((r) => [r.name, r]));
  function resolveReferencia(referenciaId: string | null, presentacion: string) {
    if (referenciaId && referenciaById.has(referenciaId)) return referenciaById.get(referenciaId)!;
    const byLabel = referenciaByLabel.get(presentacion);
    if (byLabel) return byLabel;
    const parts = presentacion.split(" — ");
    const nameGuess = (parts.length > 1 ? parts.slice(1).join(" — ") : presentacion).trim();
    return referenciaByName.get(nameGuess) ?? null;
  }

  const horasPorReferencia = new Map<string, number>();
  const unidadesPorReferencia = new Map<string, number>();
  for (const e of envasadosCerrados) {
    if (!e.ended_at) continue;
    const referencia = resolveReferencia(e.referencia_id, e.presentacion);
    if (!referencia) continue;
    const horas = (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 3_600_000;
    if (horas <= 0) continue;
    horasPorReferencia.set(referencia.id, (horasPorReferencia.get(referencia.id) ?? 0) + horas);
    unidadesPorReferencia.set(
      referencia.id,
      (unidadesPorReferencia.get(referencia.id) ?? 0) + e.cantidad_unidades,
    );
  }
  function unidadesPorHoraDe(referenciaId: string) {
    const horas = horasPorReferencia.get(referenciaId);
    const unidades = unidadesPorReferencia.get(referenciaId);
    return horas && horas > 0 && unidades != null ? unidades / horas : null;
  }

  const bacheById = new Map(baches.map((b) => [b.id, b]));

  return envasadosAbiertos.map((e) => {
    const referencia = resolveReferencia(e.referencia_id, e.presentacion);
    const unidadesHechas = unidadesHechasPorEnvasado.get(e.id) ?? 0;
    const bache = bacheById.get(e.bache_id);
    const tasa = referencia ? unidadesPorHoraDe(referencia.id) : null;
    const volumenRestante = bache?.volumen_restante_litros ?? null;

    if (!referencia || tasa == null || volumenRestante == null) {
      return {
        envasadoId: e.id,
        bacheId: e.bache_id,
        presentacion: e.presentacion,
        unidadesHechas,
        estimadoFin: null,
        faltaDato: true,
      };
    }

    const unidadesMeta = volumenRestante / referencia.peso_unitario;
    const unidadesFaltantes = Math.max(0, unidadesMeta - unidadesHechas);
    const horasFaltantes = unidadesFaltantes / tasa;
    const estimadoFin = new Date(Date.now() + horasFaltantes * 3_600_000).toISOString();

    return {
      envasadoId: e.id,
      bacheId: e.bache_id,
      presentacion: e.presentacion,
      unidadesHechas,
      estimadoFin,
      faltaDato: false,
    };
  });
}
