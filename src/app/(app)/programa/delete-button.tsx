"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionState } from "./actions";

type DeleteAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

function DeleteForm({
  action,
  id,
  onSuccess,
}: {
  action: DeleteAction;
  id: string;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Eliminando..." : "Eliminar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeleteButton({
  action,
  id,
  title,
  description,
}: {
  action: DeleteAction;
  id: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
        title={title}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DeleteForm action={action} id={id} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
