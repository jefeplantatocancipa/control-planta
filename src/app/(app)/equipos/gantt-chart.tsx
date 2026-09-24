"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format-date";

export interface GanttSegment {
  equipoId: string;
  bacheId: string;
  bacheLabel: string;
  stageName: string;
  start: string;
  end: string | null;
}

const WINDOW_DAYS = 3;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

const PALETTE = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "#b08968",
  "#7b5ea7",
  "#c9184a",
  "#2a6f97",
];

function colorForBache(bacheId: string, order: string[]): string {
  const idx = order.indexOf(bacheId);
  return PALETTE[idx % PALETTE.length];
}

export function GanttChart({
  equipos,
  segments,
}: {
  equipos: { id: string; name: string }[];
  segments: GanttSegment[];
}) {
  const [windowEnd, setWindowEnd] = useState(() => Date.now());
  const windowStart = windowEnd - WINDOW_MS;
  const [now] = useState(() => Date.now());

  const bacheOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const s of segments) {
      if (!seen.has(s.bacheId)) {
        seen.add(s.bacheId);
        order.push(s.bacheId);
      }
    }
    return order;
  }, [segments]);

  const dayTicks = useMemo(() => {
    const ticks: number[] = [];
    const start = new Date(windowStart);
    start.setMinutes(0, 0, 0);
    start.setHours(0);
    for (let t = start.getTime(); t <= windowEnd; t += 24 * 60 * 60 * 1000) {
      if (t >= windowStart) ticks.push(t);
    }
    return ticks;
  }, [windowStart, windowEnd]);

  function pct(ts: number) {
    return Math.min(100, Math.max(0, ((ts - windowStart) / WINDOW_MS) * 100));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {format(windowStart, "d MMM", { locale: es })} – {format(windowEnd, "d MMM, HH:mm", { locale: es })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWindowEnd((t) => t - WINDOW_MS)}
            aria-label="Período anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWindowEnd((t) => Math.min(Date.now(), t + WINDOW_MS))}
            aria-label="Período siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWindowEnd(Date.now())}>
            Ahora
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Marcas de día */}
          <div className="relative mb-1 h-4 border-b">
            {dayTicks.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2 text-xs text-muted-foreground"
                style={{ left: `${pct(t)}%` }}
              >
                {format(t, "d MMM", { locale: es })}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {equipos.map((equipo) => {
              const propios = segments.filter((s) => s.equipoId === equipo.id);
              return (
                <div key={equipo.id} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-sm font-medium">{equipo.name}</span>
                  <div className="relative h-8 flex-1 rounded-md bg-muted/40">
                    {now >= windowStart && now <= windowEnd && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-destructive"
                        style={{ left: `${pct(now)}%` }}
                      />
                    )}
                    {propios.map((s, i) => {
                      const startTs = new Date(s.start).getTime();
                      const endTs = s.end ? new Date(s.end).getTime() : now;
                      if (endTs < windowStart || startTs > windowEnd) return null;
                      const left = pct(Math.max(startTs, windowStart));
                      const right = pct(Math.min(endTs, windowEnd));
                      const width = Math.max(0.5, right - left);
                      return (
                        <div
                          key={i}
                          title={`${s.bacheLabel} · ${s.stageName} · ${formatTime(s.start)}${
                            s.end ? `–${formatTime(s.end)}` : " (en curso)"
                          }`}
                          className="absolute top-0.5 bottom-0.5 flex items-center overflow-hidden rounded px-1 text-[11px] whitespace-nowrap text-white"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: colorForBache(s.bacheId, bacheOrder),
                          }}
                        >
                          {s.bacheLabel}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {bacheOrder.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {bacheOrder.slice(0, 12).map((bacheId) => {
            const label = segments.find((s) => s.bacheId === bacheId)?.bacheLabel ?? bacheId;
            return (
              <div key={bacheId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block size-2.5 rounded-sm"
                  style={{ backgroundColor: colorForBache(bacheId, bacheOrder) }}
                />
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
