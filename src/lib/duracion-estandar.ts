// Tiempo estándar por producto+etapa, calculado como la MEDIANA de las
// duraciones de etapas cerradas en los últimos 90 días (solo si hay al
// menos 5 registros -- si no, no hay estándar calculado y por lo tanto no
// hay alarma). Mismo agrupamiento `${product_id}:${stage_template_id}` que
// ya usa src/lib/pronostico-bache.ts, para no tener dos nociones distintas
// de "cuánto tarda esta etapa para este producto". Funciones puras (reciben
// los datos ya consultados) para reusarlas en Administración, Baches,
// Proceso y en finishStage sin duplicar las consultas a Supabase.

const MIN_REGISTROS = 5;
const DIAS_VENTANA = 90;

// Date.now() envuelto en una función con nombre -- llamarlo directo en el
// cuerpo de un componente/render dispara la regla react-hooks/purity
// (impure call). Mismo truco que ya usa timeSince() en proceso/page.tsx.
export function minutosDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

export function fechaHaceNDiasISO(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

export interface RegistroDuracion {
  product_id: string;
  stage_template_id: string;
  started_at: string;
  ended_at: string;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 !== 0
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

// Filtra a los últimos `DIAS_VENTANA` días -- el caller puede ya traer solo
// ese rango desde la consulta (más eficiente), pero este filtro extra
// protege si no lo hizo.
export interface EstandarCalculado {
  medianaMin: number | null;
  cantidad: number;
}

export function medianaMinutosPorProductoEtapa(
  registros: RegistroDuracion[],
): Map<string, EstandarCalculado> {
  const limite = Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000;
  const minutosPorClave = new Map<string, number[]>();

  for (const r of registros) {
    const endedMs = new Date(r.ended_at).getTime();
    if (endedMs < limite) continue;
    const minutos = (endedMs - new Date(r.started_at).getTime()) / 60000;
    if (minutos <= 0) continue;
    const clave = `${r.product_id}:${r.stage_template_id}`;
    const arr = minutosPorClave.get(clave) ?? [];
    arr.push(minutos);
    minutosPorClave.set(clave, arr);
  }

  const resultado = new Map<string, EstandarCalculado>();
  for (const [clave, minutos] of minutosPorClave) {
    resultado.set(clave, {
      medianaMin: minutos.length >= MIN_REGISTROS ? mediana(minutos) : null,
      cantidad: minutos.length,
    });
  }
  return resultado;
}

// El estándar manual siempre gana sobre el calculado.
export function estandarEfectivo(input: {
  manualOverrideMin: number | null;
  calculadoMin: number | null;
}): number | null {
  return input.manualOverrideMin ?? input.calculadoMin;
}

export type BandaAlarma = "ok" | "amarillo" | "rojo";

// Amarillo al 90% del límite superior, rojo al pasarlo. "ok" también cuando
// no hay estándar o la alarma está desactivada (nunca se inventa un límite).
export function bandaAlarma(input: {
  elapsedMin: number;
  standardMin: number | null;
  toleranceLowPct: number;
  toleranceHighPct: number;
  alarmEnabled: boolean;
}): BandaAlarma {
  if (!input.alarmEnabled || input.standardMin == null) return "ok";
  const limiteSuperior = input.standardMin * (1 + input.toleranceHighPct / 100);
  if (input.elapsedMin >= limiteSuperior) return "rojo";
  if (input.elapsedMin >= limiteSuperior * 0.9) return "amarillo";
  return "ok";
}

export function limitesDuracion(input: {
  standardMin: number;
  toleranceLowPct: number;
  toleranceHighPct: number;
}) {
  return {
    limiteInferior: input.standardMin * (1 - input.toleranceLowPct / 100),
    limiteSuperior: input.standardMin * (1 + input.toleranceHighPct / 100),
  };
}
