import "server-only";

const PAGE_SIZE = 1000;

// PostgREST (y por lo tanto Supabase) devuelve como mucho 1000 filas por
// pedido si la consulta no trae .range()/.limit() propio -- cualquier
// select sin filtrar por bache/fecha puede superar eso a medida que crece
// la planta (bache_stage_records ya pasó de 1000 filas) y se trunca en
// silencio, dejando afuera justo los registros más nuevos. Esta función
// pagina con .range() hasta traer todas las filas.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}
