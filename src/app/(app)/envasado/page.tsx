import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function EnvasadoPage() {
  await requireRole(["jefe_planta", "supervisor"]);

  return (
    <PlaceholderPage
      title="Envasado del bache"
      description="Registrar unidades envasadas, presentación y mermas por bache."
      phase="Fase 4 (Captura de Envasado y Vasos Enmangados)"
    />
  );
}
