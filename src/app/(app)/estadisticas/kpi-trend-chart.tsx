"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface KpiTrendDatum {
  label: string;
  value: number;
}

// Mini gráfica mes a mes para debajo de una KpiCard -- mismo tamaño en
// las 4 tarjetas (altura fija, sin eje Y) para que el conjunto quede
// parejo. "unit" es un string (no una función) porque este componente
// corre en el cliente y recibe los datos desde un Server Component -- no
// se pueden pasar funciones a través de ese límite. "height"/"showYAxis"
// son para la versión agrandada del diálogo (ver kpi-card.tsx) -- la
// tarjeta chica no los usa.
export function KpiTrendChart({
  data,
  unit,
  height = 72,
  showYAxis = false,
}: {
  data: KpiTrendDatum[];
  unit: string;
  height?: number;
  showYAxis?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: showYAxis ? 0 : 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          stroke="var(--muted-foreground)"
        />
        {showYAxis && (
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={10}
            width={48}
            stroke="var(--muted-foreground)"
          />
        )}
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
