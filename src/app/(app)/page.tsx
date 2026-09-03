import Link from "next/link";
import { Activity, Beaker, ClipboardList, LineChart, Package, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/dal";
import type { UserRole } from "@/lib/supabase/types";

const CARDS: {
  href: string;
  title: string;
  description: string;
  icon: typeof Activity;
  roles: UserRole[];
}[] = [
  {
    href: "/proceso",
    title: "Proceso actual",
    description: "Tablero en vivo de los procesos de producción, etapa por etapa.",
    icon: Activity,
    roles: ["jefe_planta", "supervisor", "operario"],
  },
  {
    href: "/baches",
    title: "Preparación de baches",
    description: "Registrar y consultar baches en proceso.",
    icon: Beaker,
    roles: ["jefe_planta", "supervisor"],
  },
  {
    href: "/envasado",
    title: "Envasado del bache",
    description: "Registrar unidades envasadas por bache.",
    icon: Package,
    roles: ["jefe_planta", "supervisor"],
  },
  {
    href: "/enmangado",
    title: "Vasos enmangados",
    description: "Registrar el etiquetado posterior al envasado.",
    icon: Package,
    roles: ["jefe_planta", "supervisor"],
  },
  {
    href: "/programa",
    title: "Programa de producción",
    description: "Programa semanal y seguimiento de órdenes.",
    icon: ClipboardList,
    roles: ["jefe_planta", "supervisor"],
  },
  {
    href: "/cumplimiento",
    title: "Cumplimiento",
    description: "Planeado vs. ejecutado por semana y mes.",
    icon: LineChart,
    roles: ["jefe_planta", "supervisor"],
  },
  {
    href: "/estadisticas",
    title: "Estadísticas",
    description: "Desempeño por operario y por proceso.",
    icon: LineChart,
    roles: ["jefe_planta", "supervisor"],
  },
  {
    href: "/admin",
    title: "Administración",
    description: "Productos, etapas y usuarios.",
    icon: Tags,
    roles: ["jefe_planta"],
  },
];

export default async function HomePage() {
  const profile = await requireProfile();
  const cards = CARDS.filter((card) => card.roles.includes(profile.role));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {profile.full_name}</h1>
        <p className="text-muted-foreground">
          Selecciona un módulo para comenzar.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <Icon className="size-5 text-primary" />
                  <CardTitle className="text-base">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {card.description}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
