interface TurnoInput {
  id: string;
  hora_inicio: string; // "HH:MM:SS" o "HH:MM"
  hora_fin: string;
  active: boolean;
}

function minutosDelDia(horaBogota: string) {
  const [h, m] = horaBogota.split(":").map(Number);
  return h * 60 + m;
}

// Colombia no tiene horario de verano -- UTC-5 fijo todo el año.
function minutoActualBogota(now: Date) {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  return ((utcMin - 5 * 60) % 1440 + 1440) % 1440;
}

// Busca qué turno cubre el momento actual comparando contra hora_inicio/
// hora_fin. Soporta turnos que cruzan medianoche (hora_fin < hora_inicio).
// Si ningún turno activo cubre el horario (hueco en la cobertura, o no hay
// turnos cargados), devuelve null -- no se inventa un turno.
export function turnoActualId(turnos: TurnoInput[], now: Date = new Date()): string | null {
  const actual = minutoActualBogota(now);
  for (const turno of turnos) {
    if (!turno.active) continue;
    const inicio = minutosDelDia(turno.hora_inicio);
    const fin = minutosDelDia(turno.hora_fin);
    const cubre =
      inicio <= fin
        ? actual >= inicio && actual < fin
        : actual >= inicio || actual < fin; // cruza medianoche
    if (cubre) return turno.id;
  }
  return null;
}
