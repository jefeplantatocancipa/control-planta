import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function CumplimientoPage() {
  await requireRole(["jefe_planta", "supervisor"]);

  return (
    <PlaceholderPage
      title="Cumplimiento del programa"
      description="Planeado vs. ejecutado por producto, semana y mes."
      phase="Fase 6 (Dashboard de Cumplimiento)"
    />
  );
}
