import { PlaceholderPage } from "@/components/placeholder-page";
import { requireProfile } from "@/lib/auth/dal";

export default async function ProcesoPage() {
  await requireProfile();

  return (
    <PlaceholderPage
      title="Proceso actual"
      description="Tablero en vivo de las 8 etapas de preparación de bache."
      phase="Fase 5 (Dashboard de Proceso Actual)"
    />
  );
}
