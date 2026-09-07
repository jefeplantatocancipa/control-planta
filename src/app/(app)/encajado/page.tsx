import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EncajadoCard, type EstibaDisplay } from "./encajado-card";
import { formatDateTime } from "@/lib/format-date";

export default async function EncajadoPage() {
  await requireRole(["jefe_planta", "supervisor"]);
  const supabase = await createClient();

  const [
    { data: encajados },
    { data: envasados },
    { data: baches },
    { data: products },
    { data: estibas },
  ] = await Promise.all([
    supabase.from("encajados").select("*").order("created_at", { ascending: false }),
    supabase.from("envasados").select("id, presentacion"),
    supabase.from("baches").select("id, batch_code, product_id"),
    supabase.from("products").select("id, name"),
    supabase.from("encajado_estibas").select("*").order("inicio_estiba"),
  ]);

  const envasadosById = new Map((envasados ?? []).map((e) => [e.id, e]));
  const bachesById = new Map((baches ?? []).map((b) => [b.id, b]));
  const productNames = new Map((products ?? []).map((p) => [p.id, p.name]));

  const estibasByEncajado = new Map<string, EstibaDisplay[]>();
  for (const estiba of estibas ?? []) {
    const list = estibasByEncajado.get(estiba.encajado_id) ?? [];
    list.push({
      id: estiba.id,
      inicioEstiba: estiba.inicio_estiba,
      finalEstiba: estiba.final_estiba,
    });
    estibasByEncajado.set(estiba.encajado_id, list);
  }

  function bacheLabel(bacheId: string) {
    const bache = bachesById.get(bacheId);
    if (!bache) return "—";
    return `${bache.batch_code} — ${productNames.get(bache.product_id) ?? "—"}`;
  }

  const cards = (encajados ?? []).map((encajado) => ({
    id: encajado.id,
    bacheLabel: bacheLabel(encajado.bache_id),
    presentacion: envasadosById.get(encajado.envasado_id)?.presentacion ?? "—",
    lote: encajado.lote,
    startedAt: encajado.started_at,
    endedAt: encajado.ended_at,
    estibas: estibasByEncajado.get(encajado.id) ?? [],
  }));

  const pendientes = cards.filter((c) => !c.startedAt);
  const enCurso = cards.filter((c) => c.startedAt && !c.endedAt);
  const finalizados = cards.filter((c) => c.endedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Encajado</h1>
        <p className="text-muted-foreground">
          Empacar en cajas las unidades ya envasadas. Se genera automáticamente
          al cerrar cada envasado — no hace falta programarlo a mano.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Pendientes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pendientes.map((c) => (
            <EncajadoCard key={c.id} {...c} />
          ))}
          {pendientes.length === 0 && (
            <p className="text-muted-foreground">Sin encajados pendientes.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">En curso</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enCurso.map((c) => (
            <EncajadoCard key={c.id} {...c} />
          ))}
          {enCurso.length === 0 && (
            <p className="text-muted-foreground">Sin encajados en curso.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Finalizados</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bache</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Estibas</TableHead>
              <TableHead>Iniciado</TableHead>
              <TableHead>Finalizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finalizados.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.bacheLabel}</TableCell>
                <TableCell>{c.presentacion}</TableCell>
                <TableCell>{c.lote ?? "—"}</TableCell>
                <TableCell>{c.estibas.length}</TableCell>
                <TableCell>{c.startedAt && formatDateTime(c.startedAt)}</TableCell>
                <TableCell>{c.endedAt && formatDateTime(c.endedAt)}</TableCell>
              </TableRow>
            ))}
            {finalizados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sin encajados finalizados todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
