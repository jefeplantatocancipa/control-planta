"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertStageTemplate,
  cloneDefaultStagesForProduct,
  type ActionState,
} from "./actions";
import { ALL_PRODUCTS_VALUE } from "./constants";
import type { Database, StageParameterDef } from "@/lib/supabase/types";

type StageTemplate =
  Database["public"]["Tables"]["process_stage_templates"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

function ParameterEditor({
  parameters,
  onChange,
}: {
  parameters: StageParameterDef[];
  onChange: (parameters: StageParameterDef[]) => void;
}) {
  function updateAt(index: number, patch: Partial<StageParameterDef>) {
    onChange(
      parameters.map((param, i) => (i === index ? { ...param, ...patch } : param)),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Parámetros capturados</Label>
      {parameters.map((param, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder="clave"
            value={param.key}
            onChange={(e) => updateAt(index, { key: e.target.value })}
            className="w-28"
          />
          <Input
            placeholder="etiqueta"
            value={param.label}
            onChange={(e) => updateAt(index, { label: e.target.value })}
            className="flex-1"
          />
          <select
            value={param.type}
            onChange={(e) =>
              updateAt(index, {
                type: e.target.value as "number" | "text" | "time",
              })
            }
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="number">Número</option>
            <option value="text">Texto</option>
            <option value="time">Hora</option>
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(parameters.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...parameters, { key: "", label: "", type: "number" }])}
      >
        <Plus className="size-4" />
        Agregar parámetro
      </Button>
    </div>
  );
}

function StageForm({
  stage,
  products,
  onSuccess,
}: {
  stage: StageTemplate | null;
  products: Product[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertStageTemplate,
    {},
  );
  const [parameters, setParameters] = useState<StageParameterDef[]>(
    stage?.parameter_schema ?? [],
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {stage && <input type="hidden" name="id" value={stage.id} />}
      <input type="hidden" name="parameter_schema" value={JSON.stringify(parameters)} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={stage?.name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sequence_order">Orden</Label>
        <Input
          id="sequence_order"
          name="sequence_order"
          type="number"
          min={1}
          defaultValue={stage?.sequence_order}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="product_id">Producto</Label>
        <Select
          name="product_id"
          defaultValue={stage?.product_id ?? ALL_PRODUCTS_VALUE}
        >
          <SelectTrigger id="product_id" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PRODUCTS_VALUE}>
              Todos los productos
            </SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ParameterEditor parameters={parameters} onChange={setParameters} />

      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="captures_insumos"
          defaultChecked={stage?.captures_insumos ?? false}
          className="size-4"
        />
        Incluye checklist de insumos
      </Label>
      <p className="-mt-2 text-xs text-muted-foreground">
        Muestra además una lista para marcar insumos con lote/peso/marca (los
        de la receta del producto, o los confirmados en una etapa anterior de
        este mismo bache si ya hubo una).
      </p>

      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="captures_readings"
          defaultChecked={stage?.captures_readings ?? false}
          className="size-4"
        />
        Incluye lecturas periódicas (curva)
      </Label>
      <p className="-mt-2 text-xs text-muted-foreground">
        En vez de capturar los parámetros una sola vez al finalizar, permite
        agregar varias lecturas mientras la etapa está en curso (cada una con
        su hora automática) — por ejemplo una curva de fermentación.
      </p>

      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={stage?.active ?? true}
          className="size-4"
        />
        Activa
      </Label>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CloneStagesForm({ eligibleProducts }: { eligibleProducts: Product[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    cloneDefaultStagesForProduct,
    {},
  );
  const [productId, setProductId] = useState("");

  if (eligibleProducts.length === 0) return null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="clone_product_id">
          Copiar las etapas por defecto a un producto (para que sean independientes)
        </Label>
        <Select
          name="product_id"
          value={productId}
          onValueChange={(value) => setProductId(value ?? "")}
        >
          <SelectTrigger id="clone_product_id" className="w-64">
            <SelectValue placeholder="Elegí un producto" />
          </SelectTrigger>
          <SelectContent>
            {eligibleProducts.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={!productId || pending}>
        {pending ? "Copiando..." : "Copiar"}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function StagesTable({
  title,
  stages,
  onEdit,
}: {
  title: string;
  stages: StageTemplate[];
  onEdit: (stage: StageTemplate) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orden</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Parámetros</TableHead>
            <TableHead>Insumos</TableHead>
            <TableHead>Lecturas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages
            .slice()
            .sort((a, b) => a.sequence_order - b.sequence_order)
            .map((stage) => (
              <TableRow key={stage.id}>
                <TableCell>{stage.sequence_order}</TableCell>
                <TableCell className="font-medium">{stage.name}</TableCell>
                <TableCell>{stage.parameter_schema.length}</TableCell>
                <TableCell>{stage.captures_insumos ? "Sí" : "—"}</TableCell>
                <TableCell>{stage.captures_readings ? "Sí" : "—"}</TableCell>
                <TableCell>
                  <Badge variant={stage.active ? "default" : "outline"}>
                    {stage.active ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(stage)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StagesPanel({
  stages,
  products,
}: {
  stages: StageTemplate[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StageTemplate | null>(null);
  const groups = new Map<string, StageTemplate[]>();
  for (const stage of stages) {
    const key = stage.product_id ?? "all";
    const list = groups.get(key) ?? [];
    list.push(stage);
    groups.set(key, list);
  }

  const eligibleProducts = products.filter((p) => !groups.has(p.id));

  function openEdit(stage: StageTemplate) {
    setEditing(stage);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Nueva etapa
        </Button>
      </div>

      <CloneStagesForm eligibleProducts={eligibleProducts} />

      {groups.has("all") && (
        <StagesTable
          title="Todos los productos (secuencia compartida)"
          stages={groups.get("all")!}
          onEdit={openEdit}
        />
      )}

      {products
        .filter((product) => groups.has(product.id))
        .map((product) => (
          <StagesTable
            key={product.id}
            title={product.name}
            stages={groups.get(product.id)!}
            onEdit={openEdit}
          />
        ))}

      {stages.length === 0 && (
        <p className="text-center text-muted-foreground">Sin etapas todavía.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar etapa" : "Nueva etapa"}</DialogTitle>
          </DialogHeader>
          <StageForm
            key={editing?.id ?? "new"}
            stage={editing}
            products={products}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
