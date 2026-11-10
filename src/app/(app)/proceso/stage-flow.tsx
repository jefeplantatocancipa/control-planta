import {
  Milk,
  Scale,
  Flame,
  RefreshCw,
  Waves,
  Thermometer,
  Snowflake,
  FlaskConical,
  Scissors,
  Package,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// El nombre de la etapa es texto libre (lo edita Administración), así que
// el ícono se elige por palabra clave y cae a un círculo genérico si no
// reconoce ninguna -- no depende de un catálogo fijo de etapas.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/ingreso|recepci/, Milk],
  [/alistamiento|pesaje/, Scale],
  [/precalent/, Flame],
  [/mezcla|batid/, RefreshCw],
  [/homogeniz/, Waves],
  [/pasteuriz/, Thermometer],
  [/enfriamiento/, Snowflake],
  [/inoculaci|incubaci|ferment|maduraci/, FlaskConical],
  [/corte/, Scissors],
  [/envasad|empaqu/, Package],
];

function iconFor(name: string): LucideIcon {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [pattern, Icon] of ICON_RULES) {
    if (pattern.test(normalized)) return Icon;
  }
  return CircleDot;
}

export function StageFlow({
  stageNames,
  current,
  allDone,
}: {
  stageNames: string[];
  current: number;
  allDone: boolean;
}) {
  if (stageNames.length === 0) return null;

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex w-max items-start">
        {stageNames.map((name, i) => {
          const n = i + 1;
          const Icon = iconFor(name);
          const isDone = n < current || (n === current && allDone);
          const isCurrent = n === current && !allDone;

          return (
            <div key={i} className="flex items-start">
              {i > 0 && (
                <div className="mt-[17px] h-0.5 w-6 shrink-0 sm:w-8">
                  <div
                    className={cn(
                      "h-full w-full",
                      n - 1 < current
                        ? "bg-primary"
                        : n - 1 === current && !allDone
                          ? "stage-connector-active"
                          : "bg-border",
                    )}
                  />
                </div>
              )}
              <div className="flex w-14 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "animate-pulse border-primary text-primary"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <span
                  className={cn(
                    "text-center text-[10px] leading-tight text-balance",
                    isDone || isCurrent
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
