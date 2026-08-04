import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/dal";

export default async function AdminPage() {
  await requireRole(["jefe_planta"]);

  return (
    <PlaceholderPage
      title="Administración"
      description="Productos, etapas de proceso y usuarios (operarios, supervisores)."
      phase="Fase 2 (Catálogos + Programa de producción)"
    />
  );
}
