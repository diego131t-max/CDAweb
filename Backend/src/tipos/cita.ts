// Cita agendada desde el formulario público del sitio.
//
// Los campos van en inglés por el mismo motivo que los de `Mensaje`: son el
// contrato que el frontend YA usa. `Frontend/pages/schedule.js` los arma con
// esos nombres exactos y `Frontend/pages/admin.js` los renderiza igual, así que
// traducirlos obligaría a tocar las dos páginas para no ganar nada.
//
// Las COLUMNAS de la base, en cambio, van en español y snake_case. La traducción
// entre ambos mundos es trabajo del repositorio y está escrita campo por campo
// en specs/003-persistencia-supabase/data-model.md.

import type { TipoVehiculo } from "./servicio.js";

/** Los tres estados posibles de una cita. Toda cita nace 'pendiente'. */
export type EstadoCita = "pendiente" | "atendida" | "cancelada";

/** Valores válidos de `EstadoCita`, para validar lo que llega por HTTP. */
export const ESTADOS_CITA: readonly EstadoCita[] = ["pendiente", "atendida", "cancelada"] as const;

export interface Cita {
  /** Identificador generado por el SERVIDOR (nunca por el cliente). */
  id: string;
  /** Nombre de quien agenda. */
  clientName: string;
  /** Teléfono de contacto. */
  phone: string;
  /**
   * Correo de contacto. ÚNICO campo opcional de la cita.
   *
   * De acá sale la rama del aviso: sin correo no se intenta ningún envío, y la
   * cita se registra igual (FR-024).
   */
  email?: string;
  /**
   * Cédula del cliente. OPCIONAL: solo la pide el formulario rápido del inicio;
   * el de cuatro pasos no.
   *
   * Ausente NO significa "falta el dato": significa que a ese cliente nunca se le
   * pidió. Es dato personal de los sensibles —identifica a una persona ante el
   * Estado— así que vale todo lo del principio II.
   */
  cedula?: string;
  /** Placa del vehículo. */
  plate: string;
  /** Tipo de vehículo. Uno de los cuatro de `TIPOS_VEHICULO`. */
  vehicle: TipoVehiculo;
  /**
   * Id estable del servicio pedido ('revision-de-gases').
   *
   * OJO: es el **id**, no el nombre. Hoy el formulario manda el nombre y con
   * esta funcionalidad pasa a mandar el id, que es lo que permite renombrar un
   * servicio de cara al cliente sin romper las citas ya registradas ni el
   * conteo del panel (ver tipos/servicio.ts).
   */
  service: string;
  /**
   * Nombre del servicio TAL COMO EL CLIENTE LO VIO al agendar, congelado.
   *
   * No se resuelve del catálogo al mostrarlo, y esa es toda la gracia: si el CDA
   * renombra o retira un servicio, esta cita sigue diciendo qué se acordó con
   * esa persona. Lo pone el servidor a partir del `service`; el cliente no lo
   * manda ni lo puede elegir.
   */
  serviceName: string;
  /** Fecha de la cita en 'YYYY-MM-DD' (hora de Colombia). */
  date: string;
  /** Hora de la cita en 'HH:MM'. */
  time: string;
  /**
   * Medio de pago que el cliente dijo preferir.
   *
   * OJO: es una preferencia declarada, NO un pago. El sistema no cobra nada.
   */
  payment: string;
  /** Estado de atención. Lo pone el servidor; el cliente nunca lo elige. */
  status: EstadoCita;
  /** Marca de tiempo ISO 8601 de cuándo se registró. */
  creadoEn: string;
}

/**
 * Lo que el REPOSITORIO necesita para registrar una cita.
 *
 * `id`, `status` y `creadoEn` los pone el almacenamiento, no el llamador.
 * `serviceName` sí va incluido: para cuando la cita llega al repositorio, la
 * ruta ya resolvió el servicio contra el catálogo.
 */
export type NuevaCita = Omit<Cita, "id" | "status" | "creadoEn">;

/**
 * Lo que aporta EL CLIENTE al agendar. Es la lista blanca del endpoint público.
 *
 * Se distingue de `NuevaCita` en un campo y esa distinción es el control: además
 * de `id`, `status` y `creadoEn`, el cliente tampoco manda `serviceName`. Lo
 * resuelve el servidor desde el catálogo a partir del `service`. Si el cliente
 * pudiera mandarlo, podría registrar una cita que dice "Revisión
 * Técnico-Mecánica" apuntando al id de otro servicio —y el nombre es
 * justamente lo que queda como registro de lo que se le prometió—.
 *
 * Es la misma lista blanca contra asignación masiva que ya aplica
 * `validarNuevoMensaje`. Hoy el navegador se genera su propio `id` con
 * `Date.now()` recortado a seis dígitos —que colisiona— y deja de hacerlo.
 */
export type CitaDelCliente = Omit<NuevaCita, "serviceName">;

/** Filtros opcionales para listar citas desde el panel. */
export interface FiltroCitas {
  /** Fecha mínima inclusive, 'YYYY-MM-DD'. */
  desde?: string;
  /** Fecha máxima inclusive, 'YYYY-MM-DD'. */
  hasta?: string;
  /** Solo las citas en este estado. */
  estado?: EstadoCita;
  /** Cantidad máxima de citas a devolver. */
  limite?: number;
}
