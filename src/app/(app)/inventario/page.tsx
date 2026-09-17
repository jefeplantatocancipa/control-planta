import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MovimientoDialog } from "./movimiento-dialog";
import { formatDateTime } from "@/lib/format-date";
import type { InventarioInsumoTipo } from "@/lib/supabase/types";

const TIPO_LABELS: Record<InventarioInsumoTipo, string> = {
  materia_prima: "Materia prima",
  empaque: "Material de empaque",
  vaso_blanco: "Vasos blancos",
};

const MOVIMIENTO_TIPO_LABELS: Record<string, string> = {
  entrada: "Entrada",
  consumo: "Consumo",
  ajuste: "Ajuste",
};

const ORIGEN_LABELS: Record<string, string> = {
  bache: "Bache",
  envasado: "Envasado",
  enmangado: "Enmangado",
  manual: "Manual",
};

function StockTable({
  title,
  rows,
}: {
  title: string;
  rows: { insumo_id: string; name: string; stock_minimo: number | null; stock_actual: number }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const bajoMinimo = row.stock_minimo !== null && row.stock_actual < row.stock_minimo;
            return (
              <TableRow key={row.insumo_id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell
                  className={bajoMinimo ? "font-semibold text-destructive" : undefined}
                >
                  {row.stock_actual}
                </TableCell>
                <TableCell>{row.stock_minimo ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {bajoMinimo && <Badge variant="destructive">Bajo mínimo</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin insumos en esta categoría.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function InventarioPage() {
  const profile = await requireRole(["jefe_planta", "supervisor", "asistente_adm"]);
  const canWrite = profile.role === "jefe_planta" || profile.role === "supervisor";
  const supabase = await createClient();

  const [
    { data: stock },
    { data: insumos },
    { data: envasadoInsumos },
    { data: vasosBlancos },
    { data: movimientos },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("v_inventario_stock").select("*").order("name"),
    supabase.from("insumos").select("id, name").eq("active", true).order("name"),
    supabase.from("envasado_insumos").select("id, name").eq("active", true).order("name"),
    supabase.from("vasos_blancos").select("id, name").eq("active", true).order("name"),
    supabase
      .from("inventario_movimientos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const catalogos = {
    materia_prima: insumos ?? [],
    empaque: envasadoInsumos ?? [],
    vaso_blanco: vasosBlancos ?? [],
  };

  // Para mostrar el nombre en el historial hace falta el catálogo completo
  // (incluidos inactivos: un movimiento viejo puede referenciar un insumo
  // que después se desactivó).
  const [{ data: insumosAll }, { data: envasadoInsumosAll }, { data: vasosBlancosAll }] =
    await Promise.all([
      supabase.from("insumos").select("id, name"),
      supabase.from("envasado_insumos").select("id, name"),
      supabase.from("vasos_blancos").select("id, name"),
    ]);
  const nameByKey = new Map<string, string>();
  for (const i of insumosAll ?? []) nameByKey.set(`materia_prima:${i.id}`, i.name);
  for (const i of envasadoInsumosAll ?? []) nameByKey.set(`empaque:${i.id}`, i.name);
  for (const i of vasosBlancosAll ?? []) nameByKey.set(`vaso_blanco:${i.id}`, i.name);

  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const stockRows = stock ?? [];
  const porTipo = (tipo: InventarioInsumoTipo) =>
    stockRows.filter((row) => row.insumo_tipo === tipo);
  const alertas = stockRows.filter(
    (row) => row.stock_minimo !== null && row.stock_actual < row.stock_minimo,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventario</h1>
          <p className="text-muted-foreground">
            Stock de materia prima, material de empaque y vasos blancos. El
            consumo de baches y envasados se descuenta solo; acá se
            registran las entradas (compras) y ajustes por conteo físico.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <MovimientoDialog mode="entrada" catalogos={catalogos} />
            <MovimientoDialog mode="ajuste" catalogos={catalogos} />
          </div>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-destructive">
            {alertas.length} insumo(s) por debajo del stock mínimo
          </p>
          <p className="text-sm text-muted-foreground">
            {alertas.map((a) => a.name).join(", ")}
          </p>
        </div>
      )}

      <StockTable title="Materia prima" rows={porTipo("materia_prima")} />
      <StockTable title="Material de empaque" rows={porTipo("empaque")} />
      <StockTable title="Vasos blancos" rows={porTipo("vaso_blanco")} />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Movimientos recientes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Quién</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(movimientos ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{formatDateTime(m.created_at)}</TableCell>
                <TableCell className="font-medium">
                  {nameByKey.get(`${m.insumo_tipo}:${m.insumo_id}`) ?? "—"}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({TIPO_LABELS[m.insumo_tipo]})
                  </span>
                </TableCell>
                <TableCell>{MOVIMIENTO_TIPO_LABELS[m.tipo] ?? m.tipo}</TableCell>
                <TableCell className={m.cantidad < 0 ? "text-destructive" : undefined}>
                  {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                </TableCell>
                <TableCell>{m.origen_tipo ? ORIGEN_LABELS[m.origen_tipo] : "—"}</TableCell>
                <TableCell>{profileNames.get(m.created_by) ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[m.proveedor, m.notas].filter(Boolean).join(" — ") || "—"}
                </TableCell>
              </TableRow>
            ))}
            {(movimientos ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin movimientos todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
