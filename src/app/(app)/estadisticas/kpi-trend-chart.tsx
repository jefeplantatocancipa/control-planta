"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export interface KpiTrendDatum {
  label: string;
  value: number;
}

// Mini gráfica mes a mes para debajo de una KpiCard -- mismo tamaño en
// las 4 tarjetas (altura fija, sin eje Y) para que el conjunto quede
// parejo. "unit" es un string (no una función) porque este componente
// corre en el cliente y recibe los datos desde un Server Component -- no
// se pueden pasar funciones a través de ese límite.
export function KpiTrendChart({
  data,
  unit,
}: {
  data: KpiTrendDatum[];
  unit: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={72}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={() => ""}
          formatter={(value) => `${Number(value).toLocaleString("es-CO")} ${unit}`}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--chart-4)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-4)" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
