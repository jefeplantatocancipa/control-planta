"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile, createUser, type ActionState } from "./actions";
import type { Database, UserRole } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const ROLE_LABELS: Record<UserRole, string> = {
  jefe_planta: "Jefe de planta",
  supervisor: "Supervisor",
  operario: "Operario",
};

function UserForm({
  profile,
  onSuccess,
}: {
  profile: Profile;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfile,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={profile.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Nombre</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Rol</Label>
        <Select name="role" defaultValue={profile.role}>
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={profile.active}
          className="size-4"
        />
        Activo
      </Label>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createUser,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  const [role, setRole] = useState<UserRole>("operario");
  const needsLogin = role !== "operario";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new_full_name">Nombre</Label>
        <Input id="new_full_name" name="full_name" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new_role">Rol</Label>
        <Select
          name="role"
          value={role}
          onValueChange={(value) => setRole((value as UserRole) ?? "operario")}
        >
          <SelectTrigger id="new_role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsLogin ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_email">Correo</Label>
            <Input id="new_email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_password">Contraseña</Label>
            <Input
              id="new_password"
              name="password"
              type="password"
              minLength={6}
              required
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Los operarios no inician sesión: alcanza con el nombre para que
          aparezcan en los selectores de captura.
        </p>
      )}

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear usuario"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UsersPanel({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          Nuevo usuario
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell className="font-medium">
                {profile.full_name}
                {profile.id === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">(vos)</span>
                )}
              </TableCell>
              <TableCell>{ROLE_LABELS[profile.role]}</TableCell>
              <TableCell>
                <Badge variant={profile.active ? "default" : "outline"}>
                  {profile.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(profile);
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin usuarios todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {editing && (
            <UserForm
              key={editing.id}
              profile={editing}
              onSuccess={() => setEditOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <CreateUserForm onSuccess={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
