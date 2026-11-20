import { Badge } from "@/components/ui/badge";
import { bandaAlarma } from "@/lib/duracion-estandar";

export function DuracionAlarmaBadge({
  elapsedMin,
  standardMin,
  toleranceLowPct,
  toleranceHighPct,
  alarmEnabled,
}: {
  elapsedMin: number;
  standardMin: number | null;
  toleranceLowPct: number;
  toleranceHighPct: number;
  alarmEnabled: boolean;
}) {
  const banda = bandaAlarma({
    elapsedMin,
    standardMin,
    toleranceLowPct,
    toleranceHighPct,
    alarmEnabled,
  });
  if (banda === "ok" || standardMin == null) return null;

  const limiteSuperior = standardMin * (1 + toleranceHighPct / 100);
  const excedidoEn = Math.round(elapsedMin - limiteSuperior);

  return (
    <Badge
      variant={banda === "rojo" ? "destructive" : "outline"}
      className={
        banda === "amarillo"
          ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : undefined
      }
    >
      {banda === "rojo" ? `Etapa excedida en ${excedidoEn} min` : "Cerca del límite de tiempo"}
    </Badge>
  );
}
