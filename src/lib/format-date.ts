// La planta opera en horario de Bogotá; sin fijar la zona, el navegador o
// el servidor (Vercel corre en UTC) muestran la hora en la suya propia.
const TIME_ZONE = "America/Bogota";

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: TIME_ZONE });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}
