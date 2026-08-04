"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Beaker,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  Settings,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import type { CurrentProfile } from "@/lib/auth/dal";
import type { UserRole } from "@/lib/supabase/types";
import { logout } from "@/app/login/actions";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, roles: ["jefe_planta", "supervisor", "operario"] },
  { href: "/proceso", label: "Proceso", icon: Activity, roles: ["jefe_planta", "supervisor", "operario"] },
  { href: "/baches", label: "Baches", icon: Beaker, roles: ["jefe_planta", "supervisor"] },
  { href: "/envasado", label: "Envasado", icon: Package, roles: ["jefe_planta", "supervisor"] },
  { href: "/enmangado", label: "Enmangado", icon: Package, roles: ["jefe_planta", "supervisor"] },
  { href: "/programa", label: "Programa", icon: ClipboardList, roles: ["jefe_planta", "supervisor"] },
  { href: "/cumplimiento", label: "Cumplimiento", icon: LineChart, roles: ["jefe_planta", "supervisor"] },
  { href: "/estadisticas", label: "Estadísticas", icon: LineChart, roles: ["jefe_planta", "supervisor"] },
  { href: "/admin", label: "Administración", icon: Tags, roles: ["jefe_planta"] },
];

const MOBILE_ITEMS = ["/", "/proceso", "/baches", "/envasado", "/estadisticas"];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({
  profile,
  children,
}: {
  profile: CurrentProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));
  const mobileItems = items.filter((item) => MOBILE_ITEMS.includes(item.href));

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <Settings className="size-5 text-primary" />
          <span className="font-semibold">Control de Planta</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t p-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {profile.role.replace("_", " ")}
            </p>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="icon" type="submit" title="Salir">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <span className="font-semibold">Control de Planta</span>
          <form action={logout}>
            <Button variant="ghost" size="icon" type="submit" title="Salir">
              <LogOut className="size-4" />
            </Button>
          </form>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background md:hidden">
          {mobileItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
