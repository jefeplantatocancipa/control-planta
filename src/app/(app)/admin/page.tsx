import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsPanel } from "./products-panel";
import { StagesPanel } from "./stages-panel";
import { UsersPanel } from "./users-panel";

export default async function AdminPage() {
  const profile = await requireRole(["jefe_planta"]);
  const supabase = await createClient();

  const [{ data: products }, { data: stages }, { data: profiles }] =
    await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase
        .from("process_stage_templates")
        .select("*")
        .order("sequence_order"),
      supabase.from("profiles").select("*").order("full_name"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <p className="text-muted-foreground">
          Productos, etapas de proceso y usuarios (operarios, supervisores).
        </p>
      </div>

      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="etapas">Etapas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="productos">
          <ProductsPanel products={products ?? []} />
        </TabsContent>
        <TabsContent value="etapas">
          <StagesPanel stages={stages ?? []} products={products ?? []} />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsersPanel profiles={profiles ?? []} currentUserId={profile.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
