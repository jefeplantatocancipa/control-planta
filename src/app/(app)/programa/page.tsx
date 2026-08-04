import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function ProgramaPage() {
  await requireRole(["jefe_planta", "supervisor"]);

  return (
    <PlaceholderPage
      title="Programa de producción"
      description="El jefe de planta genera el programa semanal por producto."
      phase="Fase 2 (Catálogos + Programa de producción)"
    />
  );
}
