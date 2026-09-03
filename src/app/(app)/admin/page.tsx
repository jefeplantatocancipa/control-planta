import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ProductsPanel } from "./products-panel";
import { StagesPanel } from "./stages-panel";
import { UsersPanel } from "./users-panel";
import { InsumosPanel } from "./insumos-panel";
import { EnvasadoReferenciasPanel } from "./envasado-referencias-panel";
import { EnvasadoInsumosPanel } from "./envasado-insumos-panel";
import { TurnosPanel } from "./turnos-panel";

export default async function AdminPage() {
  const profile = await requireRole(["jefe_planta"]);
  const supabase = await createClient();

  const [
    { data: products },
    { data: stages },
    { data: profiles },
    { data: insumos },
    { data: productInsumos },
    { data: envasadoReferencias },
    { data: envasadoInsumos },
    { data: envasadoReferenciaInsumos },
    { data: turnos },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase
      .from("process_stage_templates")
      .select("*")
      .order("sequence_order"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("insumos").select("*").order("name"),
    supabase.from("product_insumos").select("*"),
    supabase.from("envasado_referencias").select("*").order("sku"),
    supabase.from("envasado_insumos").select("*").order("name"),
    supabase.from("envasado_referencia_insumos").select("*"),
    supabase.from("turnos").select("*").order("hora_inicio"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <p className="text-muted-foreground">
          Productos, etapas de proceso, insumos y usuarios (operarios,
          supervisores).
        </p>
      </div>

      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="etapas">Etapas</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="envasado">Envasado</TabsTrigger>
          <TabsTrigger value="turnos">Turnos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="productos">
          <ProductsPanel products={products ?? []} />
        </TabsContent>
        <TabsContent value="etapas">
          <StagesPanel stages={stages ?? []} products={products ?? []} />
        </TabsContent>
        <TabsContent value="insumos">
          <div className="flex flex-col gap-8">
            <InsumosPanel
              insumos={insumos ?? []}
              products={products ?? []}
              productInsumos={productInsumos ?? []}
            />
            <Separator />
            <EnvasadoInsumosPanel
              insumos={envasadoInsumos ?? []}
              referencias={envasadoReferencias ?? []}
              referenciaInsumos={envasadoReferenciaInsumos ?? []}
            />
          </div>
        </TabsContent>
        <TabsContent value="envasado">
          <EnvasadoReferenciasPanel
            referencias={envasadoReferencias ?? []}
            products={products ?? []}
          />
        </TabsContent>
        <TabsContent value="turnos">
          <TurnosPanel turnos={turnos ?? []} />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsersPanel profiles={profiles ?? []} currentUserId={profile.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
