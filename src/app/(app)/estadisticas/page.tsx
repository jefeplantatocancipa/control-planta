import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function EstadisticasPage() {
  await requireRole(["jefe_planta", "supervisor"]);

  return (
    <PlaceholderPage
      title="Estadísticas"
      description="Desempeño por operario: tiempos por etapa, unidades y mermas."
      phase="Fase 7 (Dashboard de Estadísticas)"
    />
  );
}
