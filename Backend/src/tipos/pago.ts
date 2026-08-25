// Medios de pago y estado del comprobante.
//
// POR QUÉ ESTE ARCHIVO EXISTE
//
// Hasta ahora `payment` era el ÚNICO campo de opciones sin lista cerrada en todo
// el sistema: `string` en el tipo, `text` sin `check` en la tabla, y validado
// solo por largo. `vehicle`, `time` y `status` sí tienen la suya. Esa excepción
// tuvo consecuencias reales: el sitio estuvo guardando citas con "PayU" —una
// pasarela que el CDA nunca tuvo— porque era el valor por omisión del
// desplegable, y el servidor no tenía con qué desmentirlo.
//
// La lista se ratificó con el propietario. NO se agrega nada acá sin que él lo
// confirme (principio I).

/** Los medios de pago que el CDA acepta. Lista cerrada. */
export const MEDIOS_DE_PAGO = [
  // En el CDA, el día de la revisión.
  "Efectivo",
  "Tarjeta débito y crédito",
  // En línea, antes de venir. Exigen comprobante: el sistema no cobra ni se
  // entera de que el dinero llegó, así que lo verifica una persona.
  "QR Bancolombia",
  "Transferencia",
  // El formulario rápido del inicio no pregunta el medio de pago. Registra esto
  // en vez de inventar uno (Frontend/pages/home.js). Está en la lista a
  // propósito: rechazarlo rompería el formulario del inicio.
  "Por confirmar",
] as const;

export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];

/**
 * Los medios que se pagan ANTES de venir, por fuera del sistema.
 *
 * Son los únicos que abren la puerta a un comprobante. Que un medio esté acá es
 * lo que hace que la cita nazca con el pago `pendiente` en vez de `no-aplica`.
 */
export const MEDIOS_EN_LINEA: readonly MedioDePago[] = ["QR Bancolombia", "Transferencia"] as const;

/**
 * Estado del pago de una cita.
 *
 * - `no-aplica`   paga en el CDA (efectivo o datáfono), o el medio está por confirmar.
 * - `pendiente`   eligió pagar en línea y todavía no subió comprobante.
 * - `por-verificar` subió comprobante y nadie del CDA lo miró aún.
 * - `verificado`  alguien del CDA lo miró y el pago está.
 * - `rechazado`   alguien del CDA lo miró y no sirve.
 *
 * OJO: `verificado` NO significa que el dinero llegó a la cuenta. Significa que
 * una persona miró una imagen y dijo que sí. El sistema no consulta al banco.
 */
export type EstadoPago = "no-aplica" | "pendiente" | "por-verificar" | "verificado" | "rechazado";

export const ESTADOS_PAGO: readonly EstadoPago[] = [
  "no-aplica",
  "pendiente",
  "por-verificar",
  "verificado",
  "rechazado",
] as const;

/**
 * Los estados que el panel puede fijar a mano.
 *
 * `no-aplica` y `pendiente` NO están: los deriva el servidor del medio de pago y
 * de si hay archivo. Dejar que el panel los escriba permitiría marcar como
 * "sin comprobante" una cita que sí tiene uno guardado.
 */
export const ESTADOS_PAGO_MANUALES: readonly EstadoPago[] = [
  "por-verificar",
  "verificado",
  "rechazado",
] as const;

export function esMedioDePago(valor: unknown): valor is MedioDePago {
  return typeof valor === "string" && (MEDIOS_DE_PAGO as readonly string[]).includes(valor);
}

export function esEstadoPago(valor: unknown): valor is EstadoPago {
  return typeof valor === "string" && (ESTADOS_PAGO as readonly string[]).includes(valor);
}

export function esEstadoPagoManual(valor: unknown): valor is EstadoPago {
  return typeof valor === "string" && (ESTADOS_PAGO_MANUALES as readonly string[]).includes(valor);
}

/** El estado con el que nace una cita, según el medio que eligió el cliente. */
export function estadoPagoInicial(medio: string): EstadoPago {
  return (MEDIOS_EN_LINEA as readonly string[]).includes(medio) ? "pendiente" : "no-aplica";
}
