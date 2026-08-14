/**
 * CAMPO TRAMPA PARA LOS FORMULARIOS PÚBLICOS
 *
 * Las dos operaciones públicas del sistema —agendar y escribir por contacto—
 * están abiertas a cualquiera de internet por diseño, y su único freno es el
 * limitador: 20 peticiones cada 15 minutos por dirección, o sea unas 1.900 al
 * día desde una sola. Eso no tumba el servidor; le llena la agenda al CDA de
 * citas falsas, que es una negación de servicio contra el negocio.
 *
 * La trampa es un campo que una persona nunca ve ni llena —está fuera de la
 * pantalla, sin tabulación y oculto a los lectores de pantalla— y que un guion
 * que completa todo lo que encuentra sí llena. Si llega con contenido, del otro
 * lado no hay una persona.
 *
 * QUÉ NO FRENA, para que nadie lo tome por más de lo que es: atrapa guiones que
 * leen el HTML y llenan todo. NO atrapa a quien lea el contrato del API y haga
 * POST directo — ese ni ve el formulario y le basta con no mandar el campo. Sube
 * el costo del ataque tonto y no hace nada contra el dirigido. Contra ese sigue
 * estando el limitador.
 */

/**
 * Nombre del campo.
 *
 * OJO, ESTÁ DUPLICADO en el frontend (`contact.js`, `home.js`, `schedule.js`).
 * No hay forma de compartirlo: el frontend no tiene build ni módulos y no puede
 * importar del backend. **Si se cambia acá hay que cambiarlo en los tres, y subir
 * el `?v=` de index.html.** Si se cambia en un solo lado, la trampa deja de
 * atrapar en silencio —no falla, simplemente no sirve—, que es la peor forma de
 * romper algo.
 *
 * El nombre se eligió para que el autocompletado del navegador no lo llene solo:
 * no se parece a ningún dato personal (nombre, correo, teléfono, dirección), que
 * es lo que los gestores de contraseñas rellenan sin preguntar.
 */
export const CAMPO_TRAMPA = "sitio_web";

/**
 * ¿Del otro lado hay un guion?
 *
 * Solo si el campo llega CON CONTENIDO. Vacío no cuenta, y eso no es un detalle:
 * un formulario HTML manda `sitio_web=""` en **todos** los envíos legítimos.
 * Tratar la cadena vacía como sospechosa rechazaría a todos los clientes del CDA
 * de una sola vez.
 *
 * Los espacios en blanco tampoco cuentan, por la misma razón: un campo que quedó
 * con un espacio no es un bot, y en la duda se deja pasar. Un falso negativo
 * cuesta un mensaje de spam; un falso positivo cuesta un cliente.
 */
export function cayoEnLaTrampa(cuerpo: unknown): boolean {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) return false;

  const valor = (cuerpo as Record<string, unknown>)[CAMPO_TRAMPA];
  return typeof valor === "string" && valor.trim() !== "";
}

/**
 * Lo que se le responde a quien cae.
 *
 * SE RESPONDE UN ERROR, NUNCA UN ÉXITO FINGIDO. El consejo habitual para las
 * trampas es devolver un 200 para que el bot crea que funcionó y no se adapte.
 * Acá no: un falso positivo con respuesta fingida le mostraría a una persona real
 * la pantalla de "¡Cita Agendada!" por una cita que no existe — exactamente el
 * defecto que la funcionalidad 003 existió para eliminar. Que un bot se entere de
 * que lo detectaron es un precio bajísimo al lado de dejar a alguien esperando un
 * turno que nadie registró.
 *
 * Por eso el texto está escrito para una persona: el único que puede llegar a
 * leerlo es alguien a quien la trampa agarró por error.
 */
export const MENSAJE_TRAMPA =
  "No pudimos procesar el formulario. Recarga la página e intenta de nuevo; " +
  "si vuelve a pasar, escríbenos por WhatsApp y te agendamos nosotros.";

/**
 * Deja constancia de que saltó, SIN un solo valor del cuerpo.
 *
 * Sirve para saber si los bots están llegando de verdad o si esto es una defensa
 * contra un problema que no existe. No registra nada de lo que se envió: el
 * cuerpo de un formulario público lleva nombre, teléfono y correo, y el registro
 * de la plataforma lo lee cualquiera con acceso al panel (principio II).
 */
export function registrarTrampa(ruta: string): void {
  console.warn(`[trampa] ${ruta}: envío descartado, el campo trampa venía lleno.`);
}
