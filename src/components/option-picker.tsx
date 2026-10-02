"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OptionPickerItem {
  value: string;
  title: string;
  meta?: (string | null | undefined)[];
}

// Reemplazo de un <Select> para listas donde cada opción tiene varios datos
// (producto, fecha, cantidad, código...) que en una sola línea truncada no
// se alcanzan a leer. Cada opción se ve como una tarjeta completa -- el
// dato principal grande, el resto como detalle debajo -- para que quede
// claro qué se está eligiendo antes de tocarlo, sobre todo en pantallas
// chicas o táctiles.
export function OptionPicker({
  items,
  value,
  onChange,
  emptyLabel,
  className,
}: {
  items: OptionPickerItem[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  className?: string;
}) {
  if (items.length === 0 && emptyLabel) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div
      className={cn(
        "flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-lg border p-1.5",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        const meta = (item.meta ?? []).filter(Boolean);
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5"
                : "border-transparent hover:bg-muted",
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{item.title}</span>
              {meta.length > 0 && (
                <span className="truncate text-xs text-muted-foreground">
                  {meta.join(" · ")}
                </span>
              )}
            </span>
            {selected && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
