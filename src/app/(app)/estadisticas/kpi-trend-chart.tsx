"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export interface KpiTrendDatum {
  label: string;
  value: number;
}

// Mini gráfica mes a mes para debajo de una KpiCard -- mismo tamaño en
// las 4 tarjetas (altura fija, sin ejes ni grilla) para que el conjunto
// quede parejo.
export function KpiTrendChart({
  data,
  formatValue,
}: {
  data: KpiTrendDatum[];
  formatValue: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={72}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={() => ""}
          formatter={(value) => formatValue(Number(value))}
        />
        <Bar dataKey="value" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
