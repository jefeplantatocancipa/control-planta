import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { formatTime } from "@/lib/format-date";
import { BitacoraForm } from "./bitacora-form";
import { deleteEntradaBitacora } from "./actions";

const TIME_ZONE = "America/Bogota";

function toISO(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function todayISO(): string {
  return toISO(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const profile = await requireProfile();
  if (!["jefe_planta", "supervisor", "calidad", "asistente_adm"].includes(profile.role)) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Bitácora</h1>
        <p className="text-muted-foreground">No tenés acceso a este módulo.</p>
      </div>
    );
  }
  const canWrite = profile.role === "jefe_planta" || profile.role === "supervisor";
  const canDelete = profile.role === "jefe_planta";

  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : todayISO();

  const supabase = await createClient();

  const [{ data: entradas }, { data: turnos }, { data: equipos }, { data: profiles }] =
    await Promise.all([
      // Mismo criterio de fecha "real" (Bogotá) que Resumen del día: un
      // registro cerca de medianoche no se corre de día por correr el
      // servidor en UTC.
      supabase
        .from("bitacora_entradas")
        .select("*")
        .gte("created_at", `${fecha}T05:00:00.000Z`)
        .lt("created_at", `${addDaysISO(fecha, 1)}T05:00:00.000Z`)
        .order("created_at", { ascending: false }),
      supabase.from("turnos").select("id, name").eq("active", true).order("hora_inicio"),
      supabase.from("equipos").select("id, name").eq("active", true).order("name"),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const turnoNames = new Map((turnos ?? []).map((t) => [t.id, t.name]));
  const equipoNames = new Map((equipos ?? []).map((e) => [e.id, e.name]));
  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const fechaLabel = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bitácora</h1>
          <p className="text-muted-foreground capitalize">{fechaLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/bitacora?fecha=${addDaysISO(fecha, -1)}`}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            title="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <Link
            href={`/bitacora?fecha=${todayISO()}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Hoy
          </Link>
          <Link
            href={`/bitacora?fecha=${addDaysISO(fecha, 1)}`}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            title="Día siguiente"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <BitacoraForm turnos={turnos ?? []} equipos={equipos ?? []} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {(entradas ?? []).map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={e.tipo === "lavado" ? "secondary" : "outline"}>
                    {e.tipo === "lavado" ? "Lavado" : "Novedad"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{formatTime(e.created_at)}</span>
                  {e.turno_id && (
                    <span className="text-sm text-muted-foreground">
                      {turnoNames.get(e.turno_id) ?? "—"}
                    </span>
                  )}
                  {e.equipo_id && (
                    <span className="text-sm text-muted-foreground">
                      · {equipoNames.get(e.equipo_id) ?? "—"}
                    </span>
                  )}
                </div>
                <p className="text-sm">{e.texto}</p>
                <p className="text-xs text-muted-foreground">
                  {profileNames.get(e.created_by) ?? "—"}
                </p>
              </div>
              {canDelete && (
                <DeleteButton
                  action={deleteEntradaBitacora}
                  id={e.id}
                  title="Eliminar entrada"
                  description="Borra esta entrada de la bitácora."
                />
              )}
            </CardContent>
          </Card>
        ))}
        {(entradas ?? []).length === 0 && (
          <p className="text-muted-foreground">Sin entradas este día.</p>
        )}
      </div>
    </div>
  );
}
