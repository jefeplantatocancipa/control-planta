import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { puedeVerTransportes } from "@/lib/transportes-acceso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransporteForm } from "./transporte-form";

export default async function TransportesPage() {
  const profile = await requireProfile();
  if (!puedeVerTransportes(profile.email)) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Transportes</h1>
        <p className="text-muted-foreground">
          Solicitar un traslado entre sedes. Al enviar, se manda un correo con el detalle en
          Excel.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Nueva solicitud de transporte</CardTitle>
        </CardHeader>
        <CardContent>
          <TransporteForm />
        </CardContent>
      </Card>
    </div>
  );
}
