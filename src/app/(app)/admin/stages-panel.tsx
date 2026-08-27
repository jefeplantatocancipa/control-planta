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
import { upsertStageTemplate, type ActionState } from "./actions";
import { ALL_PRODUCTS_VALUE } from "./constants";
import type {
  Database,
  StageCaptureMode,
  StageParameterDef,
} from "@/lib/supabase/types";

const CAPTURE_MODE_LABELS: Record<StageCaptureMode, string> = {
  parametros: "Parámetros",
  insumos: "Insumos (lote, peso, marca)",
};

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
  const [captureMode, setCaptureMode] = useState<StageCaptureMode>(
    stage?.capture_mode ?? "parametros",
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="capture_mode">Modo de captura</Label>
        <select
          id="capture_mode"
          name="capture_mode"
          value={captureMode}
          onChange={(e) => setCaptureMode(e.target.value as StageCaptureMode)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          {Object.entries(CAPTURE_MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {captureMode === "insumos" ? (
        <p className="text-sm text-muted-foreground">
          Esta etapa captura una lista de insumos (lote, peso y marca); no usa
          parámetros personalizados.
        </p>
      ) : (
        <ParameterEditor parameters={parameters} onChange={setParameters} />
      )}

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

export function StagesPanel({
  stages,
  products,
}: {
  stages: StageTemplate[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StageTemplate | null>(null);
  const productNames = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-4">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orden</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Parámetros</TableHead>
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
                <TableCell>
                  {stage.product_id
                    ? productNames.get(stage.product_id) ?? "—"
                    : "Todos"}
                </TableCell>
                <TableCell>{CAPTURE_MODE_LABELS[stage.capture_mode]}</TableCell>
                <TableCell>
                  {stage.capture_mode === "insumos" ? "—" : stage.parameter_schema.length}
                </TableCell>
                <TableCell>
                  <Badge variant={stage.active ? "default" : "outline"}>
                    {stage.active ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(stage);
                      setOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          {stages.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Sin etapas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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
