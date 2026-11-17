"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AREAS, URGENCIA } from "./constants";

const TODAS = "__todas__";

export function FiltrosForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function set(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === TODAS) params.delete(name);
    else params.set(name, value);
    router.push(`/transportes?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Área</Label>
        <Select
          value={searchParams.get("area") ?? TODAS}
          onValueChange={(v) => set("area", v ?? "")}
          items={[{ value: TODAS, label: "Todas" }, ...AREAS.map((a) => ({ value: a, label: a }))]}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas</SelectItem>
            {AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Urgencia</Label>
        <Select
          value={searchParams.get("urgencia") ?? TODAS}
          onValueChange={(v) => set("urgencia", v ?? "")}
          items={[{ value: TODAS, label: "Todas" }, ...URGENCIA.map((u) => ({ value: u, label: u }))]}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas</SelectItem>
            {URGENCIA.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro_origen" className="text-xs text-muted-foreground">
          Origen
        </Label>
        <Input
          id="filtro_origen"
          defaultValue={searchParams.get("origen") ?? ""}
          placeholder="Ej: Tocancipá"
          onBlur={(e) => set("origen", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro_destino" className="text-xs text-muted-foreground">
          Destino
        </Label>
        <Input
          id="filtro_destino"
          defaultValue={searchParams.get("destino") ?? ""}
          placeholder="Ej: Chía"
          onBlur={(e) => set("destino", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro_desde" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="filtro_desde"
          type="date"
          defaultValue={searchParams.get("desde") ?? ""}
          onChange={(e) => set("desde", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro_hasta" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <div className="flex gap-2">
          <Input
            id="filtro_hasta"
            type="date"
            defaultValue={searchParams.get("hasta") ?? ""}
            onChange={(e) => set("hasta", e.target.value)}
          />
          {searchParams.toString() && (
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/transportes")}>
              Limpiar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
