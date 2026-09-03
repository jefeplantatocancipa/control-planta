import { cn } from "@/lib/utils";

const SIZES = {
  sm: { title: "text-2xl", tagline: "text-xs" },
  lg: { title: "text-4xl", tagline: "text-sm" },
};

export function FasalactWordmark({
  size = "sm",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = SIZES[size];

  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <span className={cn("font-bold lowercase text-primary", s.title)}>
        fasalact
      </span>
      <span
        className={cn(
          "font-normal lowercase tracking-wide text-primary",
          s.tagline,
        )}
      >
        food innovation
      </span>
    </div>
  );
}
