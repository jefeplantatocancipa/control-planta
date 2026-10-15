// Banderas por sede: mismo código para todas las sedes, pero cada
// despliegue (proyecto de Vercel) puede prender/apagar un módulo con su
// propia variable de entorno, sin tocar código ni afectar a las demás.
// Sin la variable (o en cualquier valor que no sea "false"), el módulo
// queda habilitado -- así una sede ya desplegada no necesita cambios para
// seguir funcionando igual que antes.
export function isEnmangadoEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_ENMANGADO !== "false";
}
