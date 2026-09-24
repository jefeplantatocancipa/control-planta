import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ProductsPanel } from "./products-panel";
import { StagesPanel } from "./stages-panel";
import { UsersPanel } from "./users-panel";
import { InsumosPanel } from "./insumos-panel";
import { EquiposPanel } from "./equipos-panel";
import { EnvasadoReferenciasPanel } from "./envasado-referencias-panel";
import { EnvasadoInsumosPanel } from "./envasado-insumos-panel";
import { TurnosPanel } from "./turnos-panel";
import { InventarioCategoriasPanel } from "./inventario-categorias-panel";
import { ImportInventarioCatalogoDialog } from "./import-inventario-catalogo-dialog";

export default async function AdminPage() {
  const profile = await requireRole(["jefe_planta", "asistente_adm"]);
  const canWrite = profile.role === "jefe_planta";
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
    { data: equipos },
    { data: inventarioCategorias },
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
    supabase.from("equipos").select("*").order("name"),
    supabase.from("inventario_categorias").select("*").order("nombre"),
  ]);

  // El correo de login vive en auth.users, no en profiles -- hace falta el
  // cliente admin (service role) para poder listarlo por usuario.
  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailsById: Record<string, string | null> = Object.fromEntries(
    (authUsers?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

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
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="productos">
          <ProductsPanel products={products ?? []} canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="etapas">
          <StagesPanel
            stages={stages ?? []}
            products={products ?? []}
            equipos={equipos ?? []}
            canWrite={canWrite}
          />
        </TabsContent>
        <TabsContent value="insumos">
          <div className="flex flex-col gap-8">
            <InsumosPanel
              insumos={insumos ?? []}
              products={products ?? []}
              productInsumos={productInsumos ?? []}
              canWrite={canWrite}
            />
            <Separator />
            <EnvasadoInsumosPanel
              insumos={envasadoInsumos ?? []}
              referencias={envasadoReferencias ?? []}
              referenciaInsumos={envasadoReferenciaInsumos ?? []}
              canWrite={canWrite}
            />
            <Separator />
            <EquiposPanel equipos={equipos ?? []} canWrite={canWrite} />
          </div>
        </TabsContent>
        <TabsContent value="envasado">
          <EnvasadoReferenciasPanel
            referencias={envasadoReferencias ?? []}
            products={products ?? []}
            canWrite={canWrite}
          />
        </TabsContent>
        <TabsContent value="turnos">
          <TurnosPanel turnos={turnos ?? []} canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="inventario" className="flex flex-col gap-4">
          {canWrite && (
            <div className="flex justify-end">
              <ImportInventarioCatalogoDialog />
            </div>
          )}
          <InventarioCategoriasPanel
            categorias={inventarioCategorias ?? []}
            canWrite={canWrite}
          />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsersPanel
            profiles={profiles ?? []}
            currentUserId={profile.id}
            emailsById={emailsById}
            canWrite={canWrite}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
