import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Cuánto tiempo queda un equipo indisponible después de terminar de usarse,
// por el lavado entre baches. Se suma al final de CUALQUIER uso (no solo
// tanques) tanto para las estadísticas de ocupación como para saber si un
// equipo está realmente libre para arrancar un bache nuevo.
const HORAS_LAVADO = 1;

export interface EquipoUso {
  equipoId: string;
  bacheId: string;
  stageRecordId: string;
  stageTemplateId: string;
  start: string;
  // Ya incluye la hora de lavado y, para tanques de almacenamiento, la
  // extensión hasta que termina de envasarse todo el bache. null = todavía
  // ocupado (la etapa sigue abierta, o el bache no terminó de envasarse).
  end: string | null;
  enCurso: boolean;
}

// El "uso" real de un equipo no siempre coincide con la ventana de la etapa
// donde se eligió: un tanque de almacenamiento (equipos.tipo = 'tanque')
// sigue con el producto adentro desde que arranca la etapa de enfriamiento
// hasta que se termina de envasar TODO el bache, aunque esa etapa puntual
// ya se haya cerrado hace rato -- el resto de los equipos sí liberan justo
// al cerrar su etapa. Esta función es la única fuente de verdad para "¿este
// equipo está libre?", usada tanto para reservar como para las estadísticas
// de ocupación, así los dos lugares nunca se desincronizan.
export async function usosDeEquipos(supabase: SupabaseServer): Promise<EquipoUso[]> {
  const { data: usos } = await supabase
    .from("bache_stage_record_equipos")
    .select("equipo_id, stage_record_id");
  if (!usos || usos.length === 0) return [];

  const recordIds = Array.from(new Set(usos.map((u) => u.stage_record_id)));
  const [{ data: equiposAll }, { data: records }] = await Promise.all([
    supabase.from("equipos").select("id, tipo"),
    supabase
      .from("bache_stage_records")
      .select("id, bache_id, stage_template_id, started_at, ended_at")
      .in("id", recordIds),
  ]);
  const tipoByEquipo = new Map((equiposAll ?? []).map((e) => [e.id, e.tipo]));
  const recordById = new Map((records ?? []).map((r) => [r.id, r]));

  const bacheIds = Array.from(new Set((records ?? []).map((r) => r.bache_id)));
  const [{ data: baches }, { data: envasados }] = await Promise.all([
    bacheIds.length > 0
      ? supabase.from("baches").select("id, volumen_restante_litros").in("id", bacheIds)
      : Promise.resolve({ data: [] as { id: string; volumen_restante_litros: number | null }[] }),
    bacheIds.length > 0
      ? supabase.from("envasados").select("bache_id, ended_at").in("bache_id", bacheIds)
      : Promise.resolve({ data: [] as { bache_id: string; ended_at: string | null }[] }),
  ]);
  const volRestanteByBache = new Map((baches ?? []).map((b) => [b.id, b.volumen_restante_litros]));
  const envasadosEndsPorBache = new Map<string, (string | null)[]>();
  for (const e of envasados ?? []) {
    const arr = envasadosEndsPorBache.get(e.bache_id) ?? [];
    arr.push(e.ended_at);
    envasadosEndsPorBache.set(e.bache_id, arr);
  }

  // "Terminó de envasarse todo el bache" = confirmaron "no queda más base"
  // (volumen_restante_litros en 0) Y todos sus envasados están cerrados --
  // mismo criterio que el resto de la app usa para esa misma pregunta.
  function finDeEmpaque(bacheId: string): string | null {
    if (volRestanteByBache.get(bacheId) !== 0) return null;
    const ends = envasadosEndsPorBache.get(bacheId) ?? [];
    if (ends.length === 0 || ends.some((e) => !e)) return null;
    return (ends as string[]).slice().sort().at(-1)!;
  }

  const out: EquipoUso[] = [];
  for (const u of usos) {
    const record = recordById.get(u.stage_record_id);
    if (!record) continue;
    const tipo = tipoByEquipo.get(u.equipo_id);
    const rawEnd = tipo === "tanque" ? finDeEmpaque(record.bache_id) : record.ended_at;
    const end = rawEnd
      ? new Date(new Date(rawEnd).getTime() + HORAS_LAVADO * 3_600_000).toISOString()
      : null;
    out.push({
      equipoId: u.equipo_id,
      bacheId: record.bache_id,
      stageRecordId: record.id,
      stageTemplateId: record.stage_template_id,
      start: record.started_at,
      end,
      enCurso: end === null,
    });
  }
  return out;
}
