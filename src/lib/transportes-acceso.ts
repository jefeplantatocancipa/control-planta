// El módulo Transportes es personal (coordina los traslados entre sedes a
// mano, por correo) -- no aplica a todo el rol jefe_planta, solo a esta
// cuenta puntual. Se filtra por correo porque es el único dato estable que
// ya viene en CurrentProfile sin agregar un rol nuevo solo para esto.
const CORREOS_PERMITIDOS = ["ser66nn51@gmail.com"];

export function puedeVerTransportes(email: string | null | undefined): boolean {
  return !!email && CORREOS_PERMITIDOS.includes(email);
}
