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

/**
 * Resumen agregado de las citas de un periodo — para la sección de Reportes.
 *
 * POR QUÉ ESTO EXISTE EN VEZ DE CONTAR EN EL NAVEGADOR
 *
 * Reportes calculaba sus números recorriendo la lista de citas que ya tenía
 * cargada. Eso tiene dos problemas y el segundo es serio.
 *
 * El primero: esa lista viene con tope (200 por omisión, 500 como máximo). Con
 * el CDA lleno son cinco días de agenda. Un reporte mensual calculado sobre una
 * lista truncada da números que parecen correctos y no lo son, que es la peor
 * clase de número.
 *
 * El segundo: para contar cuántas citas hubo, el navegador se descargaba el
 * nombre, el teléfono, el correo, la cédula y la placa de cada cliente del
 * periodo. Cientos de personas, para calcular cinco totales. Acá los conteos se
 * hacen en la base y lo que viaja son números.
 *
 * NO INCLUYE PLATA, y no es un olvido: la tarifa depende de la banda de
 * matrícula del vehículo, y la cita no guarda el año de matrícula. Calcular
 * ingresos exigiría suponerlo, y un ingreso supuesto es un dato inventado
 * (principio I).
 */
export interface ResumenCitas {
  /** Extremos del periodo, tal como se pidieron. */
  desde: string;
  hasta: string;
  /** Citas del periodo, de cualquier estado. */
  total: number;
  /** Cuántas hay en cada estado. Las tres claves vienen siempre, aunque den cero. */
  porEstado: Record<EstadoCita, number>;
  /**
   * Cuántas por tipo de vehículo. Vienen los cuatro tipos siempre: un tipo sin
   * citas tiene que aparecer en cero, no desaparecer del reporte —que no haya
   * venido ninguna moto es justamente lo que hay que poder ver—.
   */
  porVehiculo: Record<string, number>;
  /**
   * Cuántas por servicio, con el NOMBRE que la cita tiene congelado —no el del
   * catálogo de hoy—. Así un servicio renombrado o retirado sigue apareciendo
   * en los reportes del periodo en que se prestó.
   */
  porServicio: Record<string, number>;
  /** Día por día, en orden. Solo los días que tuvieron al menos una cita. */
  porDia: ResumenDeUnDia[];
  /**
   * Placas distintas del periodo. Sirve para separar "40 citas" de "40
   * vehículos": un mismo carro que reagenda cuenta una sola vez acá.
   */
  vehiculosUnicos: number;
  /** Cupos que tiene un día completo, para poder leer `total` de cada día. */
  cuposPorDia: number;
}

/** Un día del resumen. */
export interface ResumenDeUnDia {
  /** 'YYYY-MM-DD'. */
  fecha: string;
  total: number;
  pendientes: number;
  atendidas: number;
  canceladas: number;
}

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
