// Listas desplegables tal como vienen en Formato_Solicitud_de_Transporte.xlsx
// (ocultas en la columna XFD de esa hoja) -- se mantienen como constantes acá
// en vez de un catálogo en la BD porque son pocas y estables; si hace falta
// agregar un área o sede después, es un cambio de una línea.
export const AREAS = [
  "Bodega Chía",
  "Bodega Luis",
  "Mantenimiento",
  "Planta Guasca",
  "Planta Tocancipá",
  "Administrativo",
  "Gestión Humana",
  "Otro",
] as const;

export const URGENCIA = ["Urgente", "No Urgente"] as const;

export const SI_NO = ["Si", "No"] as const;
