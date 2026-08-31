import { cn } from "@/lib/utils";

const SIZES = {
  sm: { title: "text-lg", tagline: "text-[0.5rem]" },
  lg: { title: "text-3xl", tagline: "text-xs" },
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
