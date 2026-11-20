"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useResilientActionState as useActionState } from "@/lib/use-resilient-action-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calcularPedidoInsumos,
  type InsumoCalculado,
} from "@/lib/pedido-insumos-calculo";
import { crearPedidoInsumos, type ActionState } from "../actions";
import type { InventarioInsumoTipo } from "@/lib/supabase/types";

interface Program {
  id: string;
  week_start_date: string;
}
interface Order {
  id: string;
  program_id: string;
  product_id: string;
  scheduled_date: string;
  baches_planeados: number | null;
  orden_codigo: string | null;
  tanque: string | null;
}
interface EnvasadoOrder {
  id: string;
  program_id: string;
  referencia_id: string;
  scheduled_date: string;
  planned_quantity: number;
  linea: string | null;
}
interface Producto {
  id: string;
  name: string;
}
interface Referencia {
  id: string;
  sku: string;
  name: string;
  product_id: string;
}
interface Insumo {
  id: string;
  name: string;
  unit: string;
  codigo: string | null;
  excluir_pedido_programa: boolean;
}
interface EnvasadoInsumo {
  id: string;
  name: string;
  unit: string;
  codigo: string | null;
}
interface StockRow {
  insumo_tipo: InventarioInsumoTipo;
  insumo_id: string;
  stock_actual: number;
}
interface PedidoRef {
  folio: number;
  enviado_at: string;
}

function formatWeek(dateStr: string) {
  return format(new Date(`${dateStr}T00:00:00`), "'Semana del' d 'de' MMMM, yyyy", {
    locale: es,
  });
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function NuevoPedidoForm({
  profileEmail,
  programs,
  orders,
  envasadoOrders,
  products,
  envasadoReferencias,
  productInsumos,
  envasadoReferenciaInsumos,
  insumos,
  envasadoInsumos,
  stock,
  pedidoPorOrdenBache,
  pedidoPorOrdenEnvasado,
  destinatarioEmail,
}: {
  profileEmail: string | null;
  programs: Program[];
  orders: Order[];
  envasadoOrders: EnvasadoOrder[];
  products: Producto[];
  envasadoReferencias: Referencia[];
  productInsumos: { product_id: string; insumo_id: string; cantidad_kg_por_bache: number | null }[];
  envasadoReferenciaInsumos: {
    referencia_id: string;
    envasado_insumo_id: string;
    cantidad_por_unidad: number | null;
  }[];
  insumos: Insumo[];
  envasadoInsumos: EnvasadoInsumo[];
  stock: StockRow[];
  pedidoPorOrdenBache: Record<string, PedidoRef>;
  pedidoPorOrdenEnvasado: Record<string, PedidoRef>;
  destinatarioEmail: string | null;
}) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [selectedBaches, setSelectedBaches] = useState<Set<string>>(new Set());
  const [selectedEnvasado, setSelectedEnvasado] = useState<Set<string>>(new Set());
  const [calculated, setCalculated] = useState<InsumoCalculado[] | null>(null);
  const [cantidadesPedidas, setCantidadesPedidas] = useState<Map<string, string>>(new Map());
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [fechaRequerida, setFechaRequerida] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    crearPedidoInsumos,
    {},
  );

  const productNames = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const referenciasById = useMemo(
    () => new Map(envasadoReferencias.map((r) => [r.id, r])),
    [envasadoReferencias],
  );
  const insumosById = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const envasadoInsumosById = useMemo(
    () => new Map(envasadoInsumos.map((i) => [i.id, i])),
    [envasadoInsumos],
  );
  const stockByKey = useMemo(
    () => new Map(stock.map((s) => [`${s.insumo_tipo}:${s.insumo_id}`, s.stock_actual])),
    [stock],
  );
  const insumosExcluidos = useMemo(
    () => new Set(insumos.filter((i) => i.excluir_pedido_programa).map((i) => i.id)),
    [insumos],
  );

  const ordersEnPrograma = orders.filter((o) => o.program_id === programId);
  const envasadoOrdersEnPrograma = envasadoOrders.filter((o) => o.program_id === programId);

  function toggleBache(id: string) {
    setSelectedBaches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setCalculated(null);
  }
  function toggleEnvasado(id: string) {
    setSelectedEnvasado((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setCalculated(null);
  }

  function calcular() {
    const resultado = calcularPedidoInsumos({
      ordenesBache: ordersEnPrograma
        .filter((o) => selectedBaches.has(o.id))
        .map((o) => ({ id: o.id, product_id: o.product_id, baches_planeados: o.baches_planeados })),
      ordenesEnvasado: envasadoOrdersEnPrograma
        .filter((o) => selectedEnvasado.has(o.id))
        .map((o) => ({
          id: o.id,
          referencia_id: o.referencia_id,
          planned_quantity: o.planned_quantity,
        })),
      recetaBache: productInsumos,
      recetaEnvasado: envasadoReferenciaInsumos,
      insumosExcluidos,
    });
    setCalculated(resultado);
    setRemovidos(new Set());
    setCantidadesPedidas(
      new Map(
        resultado.map((r) => [
          `${r.insumoTipo}:${r.insumoId}`,
          String(round(r.cantidadRequerida)),
        ]),
      ),
    );
  }

  const lineas = (calculated ?? []).filter(
    (r) => !removidos.has(`${r.insumoTipo}:${r.insumoId}`),
  );
  const materiaPrima = lineas.filter((r) => r.insumoTipo === "materia_prima");
  const empaque = lineas.filter((r) => r.insumoTipo === "empaque");

  function nombreInsumo(r: InsumoCalculado) {
    return r.insumoTipo === "materia_prima"
      ? insumosById.get(r.insumoId)
      : envasadoInsumosById.get(r.insumoId);
  }

  function renderTablaInsumos(filas: InsumoCalculado[], titulo: string) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Requerido</TableHead>
              <TableHead>Stock actual</TableHead>
              <TableHead>A pedir</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((r) => {
              const key = `${r.insumoTipo}:${r.insumoId}`;
              const info = nombreInsumo(r);
              const stockActual = stockByKey.get(key) ?? 0;
              return (
                <TableRow key={key}>
                  <TableCell className="text-muted-foreground">{info?.codigo ?? "—"}</TableCell>
                  <TableCell className="font-medium">{info?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{info?.unit ?? "—"}</TableCell>
                  <TableCell>{round(r.cantidadRequerida)}</TableCell>
                  <TableCell className="text-muted-foreground">{round(stockActual)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      className="w-28"
                      value={cantidadesPedidas.get(key) ?? ""}
                      onChange={(e) =>
                        setCantidadesPedidas((prev) => {
                          const next = new Map(prev);
                          next.set(key, e.target.value);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemovidos((prev) => new Set(prev).add(key))}
                    >
                      Quitar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin insumos en esta categoría.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  const payload = {
    program_id: programId,
    fecha_requerida: fechaRequerida || null,
    observaciones: observaciones || null,
    ordenes: [
      ...Array.from(selectedBaches).map((id) => ({ tipo: "bache" as const, id })),
      ...Array.from(selectedEnvasado).map((id) => ({ tipo: "envasado" as const, id })),
    ],
    lineas: lineas.map((r) => ({
      insumo_tipo: r.insumoTipo,
      insumo_id: r.insumoId,
      cantidad_requerida: round(r.cantidadRequerida),
      cantidad_pedida: Number(cantidadesPedidas.get(`${r.insumoTipo}:${r.insumoId}`) || 0),
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Elegí la semana</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={programId}
            onValueChange={(value) => {
              setProgramId(value ?? "");
              setSelectedBaches(new Set());
              setSelectedEnvasado(new Set());
              setCalculated(null);
            }}
            items={programs.map((p) => ({ value: p.id, label: formatWeek(p.week_start_date) }))}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatWeek(p.week_start_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {programs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay ningún programa semanal creado.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Marcá las órdenes a cubrir</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Baches</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Orden</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Baches</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersEnPrograma.map((o) => {
                  const yaPedido = pedidoPorOrdenBache[o.id];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selectedBaches.has(o.id)}
                          onChange={() => toggleBache(o.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{o.orden_codigo ?? "—"}</TableCell>
                      <TableCell>{productNames.get(o.product_id) ?? "—"}</TableCell>
                      <TableCell>
                        {format(new Date(`${o.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{o.baches_planeados ?? "—"}</TableCell>
                      <TableCell>
                        {yaPedido && (
                          <Badge variant="outline">
                            Ya incluida en Pedido N.º {yaPedido.folio} del{" "}
                            {format(new Date(yaPedido.enviado_at), "dd/MM")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {ordersEnPrograma.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Sin órdenes de baches en esta semana.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Envasado</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Referencia</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Und. programadas</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {envasadoOrdersEnPrograma.map((o) => {
                  const referencia = referenciasById.get(o.referencia_id);
                  const yaPedido = pedidoPorOrdenEnvasado[o.id];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selectedEnvasado.has(o.id)}
                          onChange={() => toggleEnvasado(o.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {referencia ? `${referencia.sku} — ${referencia.name}` : "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(`${o.scheduled_date}T00:00:00`), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{o.planned_quantity}</TableCell>
                      <TableCell>
                        {yaPedido && (
                          <Badge variant="outline">
                            Ya incluida en Pedido N.º {yaPedido.folio} del{" "}
                            {format(new Date(yaPedido.enviado_at), "dd/MM")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {envasadoOrdersEnPrograma.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin órdenes de envasado en esta semana.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            onClick={calcular}
            disabled={selectedBaches.size === 0 && selectedEnvasado.size === 0}
            className="self-start"
          >
            Calcular insumos
          </Button>
        </CardContent>
      </Card>

      {calculated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Revisá y enviá el pedido</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {renderTablaInsumos(materiaPrima, "Materia prima")}
            <Separator />
            {renderTablaInsumos(empaque, "Material de empaque")}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fecha_requerida">Fecha requerida de entrega</Label>
                <Input
                  id="fecha_requerida"
                  type="date"
                  value={fechaRequerida}
                  onChange={(e) => setFechaRequerida(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Input
                  id="observaciones"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {destinatarioEmail
                ? `Se va a enviar a ${destinatarioEmail}${profileEmail ? ` con copia a ${profileEmail}` : ""}.`
                : "No hay un destinatario configurado todavía -- configuralo en Administración antes de enviar."}
            </p>

            {state.error && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
            {state.success && (
              <p className="text-sm text-muted-foreground">Pedido enviado correctamente.</p>
            )}

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    disabled={lineas.length === 0 || !destinatarioEmail}
                    className="self-start"
                  >
                    Enviar pedido
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar envío</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Se va a enviar un correo a {destinatarioEmail} con{" "}
                  {lineas.length} insumo{lineas.length === 1 ? "" : "s"} y quedar
                  registrado en el historial. Esta acción no se puede deshacer.
                </p>
                <form action={action}>
                  <input type="hidden" name="payload" value={JSON.stringify(payload)} />
                  <DialogFooter>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Enviando..." : "Confirmar y enviar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
