"use client";

import { useActionState } from "react";

type BaseState = { error?: string; success?: boolean };

const TIMEOUT_MARKER = "__resilient_action_timeout__";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(TIMEOUT_MARKER)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Envuelve useActionState para que un corte de señal (wifi de planta poco
// confiable) nunca deje un botón "pensando" para siempre: si no hay
// conexión ni se intenta enviar, y si la conexión está pero no responde a
// tiempo, se corta con un mensaje claro en vez de colgarse. Los valores ya
// tipeados en el formulario no se tocan (siguen en el estado de React del
// componente), así que la persona puede reintentar sin escribir de nuevo.
// La llamada real al servidor puede seguir en curso después del timeout (no
// hay forma de cancelarla), así que si igual llega a completarse más tarde
// no pasa nada grave: casi todas las acciones ya son seguras ante un
// reintento (validan contra el estado real en vez de asumir un solo envío).
export function useResilientActionState<State extends BaseState, Payload = FormData>(
  action: (state: State, payload: Payload) => Promise<State>,
  initialState: State,
  timeoutMs = 15000,
): [State, (payload: Payload) => void, boolean] {
  async function resilientAction(state: State, payload: Payload): Promise<State> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return {
        ...initialState,
        error:
          "Sin conexión — no se envió. Tus datos siguen acá, reintentá cuando vuelva la señal.",
      };
    }
    try {
      return await withTimeout(action(state, payload), timeoutMs);
    } catch (err) {
      if (err instanceof Error && err.message === TIMEOUT_MARKER) {
        return {
          ...initialState,
          error:
            "La conexión está muy lenta y no respondió a tiempo. Tus datos siguen acá, podés reintentar.",
        };
      }
      return {
        ...initialState,
        error: "No se pudo conectar con el servidor. Reintentá cuando tengas señal.",
      };
    }
  }

  // React tipa useActionState en función de Awaited<State>, pensado para
  // cuando el estado en sí puede ser una promesa; acá nunca lo es (siempre
  // es un objeto plano), así que el cast es seguro.
  const [state, dispatch, pending] = useActionState(
    resilientAction as (state: Awaited<State>, payload: Payload) => State | Promise<State>,
    initialState as Awaited<State>,
  );
  return [state as State, dispatch as (payload: Payload) => void, pending];
}
