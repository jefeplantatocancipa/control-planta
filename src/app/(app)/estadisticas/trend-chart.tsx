"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendDatum {
  label: string;
  a: number;
  b: number;
}

export function TrendChart({
  data,
  nameA,
  nameB,
  unit = "kg",
  colorA = "var(--chart-1)",
  colorB = "var(--chart-4)",
}: {
  data: TrendDatum[];
  nameA: string;
  nameB: string;
  unit?: string;
  colorA?: string;
  colorB?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
          width={44}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => `${Number(value).toLocaleString("es-CO")} ${unit}`}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar dataKey="a" name={nameA} fill={colorA} radius={[4, 4, 0, 0]} />
        <Bar dataKey="b" name={nameB} fill={colorB} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
