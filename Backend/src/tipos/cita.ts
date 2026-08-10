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
  /** Placa del vehículo. */
  plate: string;
  /** Tipo de vehículo, tal como lo ofrece el formulario. */
  vehicle: string;
  /**
   * Servicio pedido. Se guarda el elegido, no una referencia viva al catálogo:
   * si el CDA deja de prestarlo mañana, esta cita no se altera.
   */
  service: string;
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
 * Datos que aporta el cliente al agendar.
 *
 * `id`, `status` y `creadoEn` los define el SERVIDOR y no se aceptan del
 * cliente: es la misma lista blanca contra asignación masiva que ya aplica
 * `validarNuevoMensaje`. Hoy el navegador se genera su propio `id` con
 * `Date.now()` recortado a seis dígitos —que colisiona— y deja de hacerlo.
 */
export type NuevaCita = Omit<Cita, "id" | "status" | "creadoEn">;

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
