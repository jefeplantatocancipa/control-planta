import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function BachesPage() {
  await requireRole(["jefe_planta", "supervisor"]);

  return (
    <PlaceholderPage
      title="Preparación de baches"
      description="Crear baches y capturar cada una de las 8 etapas."
      phase="Fase 3 (Captura de Preparación de Baches)"
    />
  );
}
