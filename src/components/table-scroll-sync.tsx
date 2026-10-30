"use client";

import { useEffect, useRef } from "react";

// Barra de scroll horizontal "flotante" para una tabla larga: en vez de
// acotar la altura de la tabla (lo que obliga a un scroll vertical propio,
// aparte del de la página), esta barra queda pegada abajo del viewport
// mientras la tabla sigue a la vista -- la página se sigue desplazando
// normal, y la barra siempre está a mano para mover el contenido hacia
// los lados, sin tener que bajar hasta el final de la tabla para
// encontrarla.
export function TableScrollSync({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = wrapperRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="table-container"]',
    );
    const track = trackRef.current;
    const spacer = spacerRef.current;
    if (!content || !track || !spacer) return;

    function syncWidth() {
      spacer!.style.width = `${content!.scrollWidth}px`;
    }
    syncWidth();
    const resizeObserver = new ResizeObserver(syncWidth);
    resizeObserver.observe(content);

    // Guarda contra bucle: mover uno dispara el "scroll" del otro al
    // sincronizarlo, que a su vez volvería a disparar el primero.
    let syncing: "content" | "track" | null = null;
    function onContentScroll() {
      if (syncing === "track") {
        syncing = null;
        return;
      }
      syncing = "content";
      track!.scrollLeft = content!.scrollLeft;
    }
    function onTrackScroll() {
      if (syncing === "content") {
        syncing = null;
        return;
      }
      syncing = "track";
      content!.scrollLeft = track!.scrollLeft;
    }
    content.addEventListener("scroll", onContentScroll);
    track.addEventListener("scroll", onTrackScroll);
    return () => {
      resizeObserver.disconnect();
      content.removeEventListener("scroll", onContentScroll);
      track.removeEventListener("scroll", onTrackScroll);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="overflow-hidden rounded-md border">
      {children}
      <div
        ref={trackRef}
        className="sticky bottom-0 z-10 h-4 overflow-x-auto overflow-y-hidden border-t bg-background print:hidden"
      >
        <div ref={spacerRef} className="h-px" />
      </div>
    </div>
  );
}
