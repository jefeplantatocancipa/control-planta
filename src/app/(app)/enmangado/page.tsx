import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function EnmangadoPage() {
  await requireRole(["jefe_planta", "supervisor"]);

  return (
    <PlaceholderPage
      title="Producción de vasos enmangados"
      description="Registrar el etiquetado de vasos a partir de un envasado."
      phase="Fase 4 (Captura de Envasado y Vasos Enmangados)"
    />
  );
}
