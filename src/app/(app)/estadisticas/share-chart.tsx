"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface ShareDatum {
  label: string;
  value: number;
}

const COLORS = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--muted-foreground)",
];

const MAX_SLICES = 5;

export function ShareChart({ data, unit }: { data: ShareDatum[]; unit: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const otros = rest.reduce((s, d) => s + d.value, 0);
  const chartData = otros > 0 ? [...top, { label: "Otros", value: otros }] : top;
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--card)"
        >
          {chartData.map((entry, i) => (
            <Cell key={entry.label} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const num = Number(value);
            const pct = total > 0 ? Math.round((num / total) * 1000) / 10 : 0;
            return [`${num.toLocaleString("es-CO")} ${unit} (${pct}%)`, name];
          }}
        />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          formatter={(value) => (
            <span style={{ color: "var(--foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
