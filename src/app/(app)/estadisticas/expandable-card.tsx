"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Mismo patrón que ./kpi-card.tsx: clic en la tarjeta la agranda y centra
// (zoom-in-95 + fade del Dialog del design system), para tablas/gráficas
// que no tienen un "resumen chico" propio -- "expanded" es una versión
// más grande del mismo contenido (ej. una gráfica con más alto) cuando
// hace falta; si no se pasa, el diálogo repite "children" tal cual.
export function ExpandableCard({
  title,
  children,
  expanded,
}: {
  title: ReactNode;
  children: ReactNode;
  expanded?: ReactNode;
}) {
  const card = (
    <Card className="cursor-pointer transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  return (
    <Dialog>
      <DialogTrigger render={card} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {expanded ?? children}
      </DialogContent>
    </Dialog>
  );
}
