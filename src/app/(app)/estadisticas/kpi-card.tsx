"use client";

import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KpiTrendChart, type KpiTrendDatum } from "./kpi-trend-chart";

// Clic en la tarjeta abre el mismo indicador agrandado y centrado (el
// zoom-in-95 + fade ya lo trae el Dialog del design system) con la
// gráfica más grande y el detalle mes a mes en tabla -- sin eso (sin
// datos para graficar), la tarjeta queda igual que antes, sin clic.
export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  data,
  unit,
  chartCaption,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel: ReactNode;
  data?: KpiTrendDatum[];
  unit?: string;
  chartCaption?: string;
}) {
  const hasChart = Boolean(data && data.length > 0 && unit);

  const card = (
    <Card
      className={
        hasChart
          ? "cursor-pointer transition-shadow hover:shadow-md"
          : undefined
      }
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-2xl font-semibold tabular-nums">{value}</span>
            <span className="text-xs text-muted-foreground">{sublabel}</span>
          </div>
        </div>
        {hasChart && (
          <div className="flex flex-col gap-1">
            <KpiTrendChart data={data!} unit={unit!} />
            {chartCaption && (
              <span className="text-[11px] text-muted-foreground">{chartCaption}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!hasChart) return card;

  return (
    <Dialog>
      <DialogTrigger render={card} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {label}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{value}</p>
            <p className="text-sm text-muted-foreground">{sublabel}</p>
          </div>
          <KpiTrendChart data={data!} unit={unit!} height={260} showYAxis />
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-popover">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-normal">Mes</th>
                  <th className="px-3 py-1.5 text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...data!].reverse().map((d, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{d.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {d.value.toLocaleString("es-CO")} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
