// Página de Política de tratamiento de datos personales
//
// La Ley 1581 de 2012 obliga a quien recoge datos personales a decir quién es, para
// qué los usa, qué derechos tiene la persona y cómo ejercerlos. Esta página es ese
// aviso, y por eso cada afirmación de acá tiene que ser verdad HOY en el sistema:
// no promete recordatorios, correos de confirmación ni publicidad, porque nada de
// eso existe (el correo está apagado a propósito, ver CLAUDE.md).
//
// Qué se recoge sale de las tablas de `Backend/migraciones/` y de los formularios
// de `schedule.js`, `home.js`, `contact.js` y `encuesta.js`. Si un formulario pide
// un dato nuevo, hay que sumarlo a la tabla de la sección 2 en el mismo cambio.
//
// El NIT es el de la empresa (confirmado por Diego, 2026-10-21) y la razón social es
// `CDA.razonSocial` (Diego, 2026-10-28). Lo que NO se escribió porque nadie lo ha
// confirmado (principio I): cuánto tiempo se conservan los datos. La conservación se
// explica sin inventar plazos.

// Fecha de la última revisión del texto. Se cambia cuando el contenido cambie de
// verdad, y se cambia también el <lastmod> de /politica-de-datos en sitemap.xml.
const POLITICA_DATOS_ACTUALIZADA = "28 de octubre de 2026";

// Qué se recoge en cada lugar del sitio. Una fila por formulario.
const DATOS_POR_FORMULARIO = [
  {
    donde: "Agendar una cita",
    datos:
      "Nombre completo, cédula, teléfono, correo (opcional), placa, tipo de vehículo, uso, año de matrícula, fecha y hora de la cita y medio de pago.",
  },
  {
    donde: "Comprobante de pago",
    datos:
      "Si pagas en línea (QR de Bancolombia o transferencia), la imagen o el PDF del comprobante que subes. Puede mostrar datos de tu transacción.",
  },
  {
    donde: "Contacto",
    datos: "Nombre, correo y el mensaje que escribes.",
  },
  {
    donde: "Encuesta de satisfacción",
    datos:
      "Tus calificaciones y, si quieres, una sugerencia. Es anónima: no pide nombre, cédula, teléfono ni correo. Te pedimos no escribir datos personales en la sugerencia.",
  },
];

function politicaDatosPage() {
  const filas = DATOS_POR_FORMULARIO.map(
    (f) => `
        <tr>
          <td data-etiqueta="Dónde"><strong>${escaparHtml(f.donde)}</strong></td>
          <td data-etiqueta="Qué recogemos">${escaparHtml(f.datos)}</td>
        </tr>`,
  ).join("");

  return `
    ${pageHero(
      "Política de tratamiento de datos personales",
      "Qué datos te pedimos en este sitio, para qué los usamos y cómo puedes ejercer tus derechos.",
      "Tus datos",
    )}

    <section class="section">
      <div class="container legal-texto">
        <p>
          Esta política aplica a los datos personales que recogemos a través de este sitio web:
          el agendamiento de citas, el formulario de contacto y la encuesta de satisfacción.
          La damos a conocer en cumplimiento de la Ley 1581 de 2012 y sus decretos reglamentarios.
        </p>

        <h2>1. Responsable del tratamiento</h2>
        <ul class="legal-datos">
          <li><strong>Razón social:</strong> ${escaparHtml(CDA.razonSocial)}</li>
          <li><strong>Nombre comercial:</strong> ${escaparHtml(CDA.nombre)}</li>
          <li><strong>NIT:</strong> ${escaparHtml(datosBancarios.nit)}</li>
          <li><strong>Dirección:</strong> ${escaparHtml(CDA.ubicacion)}</li>
          <li><strong>Correo:</strong> <a href="mailto:${escaparHtml(CDA.email)}">${escaparHtml(CDA.email)}</a></li>
          <li><strong>Teléfono:</strong> <a href="tel:${escaparHtml(CDA.telefono.replace(/\s/g, ""))}">${escaparHtml(CDA.telefono)}</a></li>
        </ul>

        <h2>2. Qué datos recogemos</h2>
        <div class="table-wrap">
          <table class="tabla-apilable">
            <thead>
              <tr><th>Dónde</th><th>Qué recogemos</th></tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
        <p>
          No te pedimos datos sensibles (salud, biometría, orientación política o religiosa) ni
          datos de niños, niñas o adolescentes. Este sitio no está dirigido a menores de edad.
        </p>

        <h2>3. Para qué usamos tus datos</h2>
        <p>Solo para estas finalidades:</p>
        <ul class="legal-lista">
          <li>Reservar tu cupo y gestionar tu cita de revisión técnico-mecánica y de gases.</li>
          <li>Contactarte por tu cita: confirmarla o avisarte si hay un cambio.</li>
          <li>Calcular el valor de tu revisión y, si pagas en línea, verificar tu comprobante.</li>
          <li>Responder los mensajes que nos escribes.</li>
          <li>Mejorar nuestro servicio con la encuesta y con estadísticas internas del CDA.</li>
          <li>Proteger el sitio contra el uso abusivo y cumplir obligaciones legales o requerimientos de autoridades competentes.</li>
        </ul>

        <h2>4. Quién ve tus datos y dónde se guardan</h2>
        <p>
          Tus datos los consulta únicamente el personal autorizado del CDA, desde un panel
          protegido con contraseña. No los entregamos a terceros, salvo que una autoridad
          competente nos lo exija conforme a la ley.
        </p>
        <p>
          Para que el sitio funcione usamos proveedores de infraestructura tecnológica
          (alojamiento del sitio, base de datos y almacenamiento de archivos), que tratan los datos
          por cuenta del CDA. <strong>Sus servidores están en Estados Unidos</strong>, de modo que
          al usar el sitio autorizas esa transferencia internacional de tus datos.
        </p>
        <p>
          Los mapas y las tipografías del sitio los sirve Google, que puede recibir tu dirección
          de red cuando se cargan. Si nos escribes por WhatsApp, esa conversación se rige además
          por los términos de WhatsApp.
        </p>

        <h2>5. Cómo los protegemos</h2>
        <ul class="legal-lista">
          <li>El sitio y el API usan conexión cifrada (HTTPS).</li>
          <li>Las citas, los mensajes y las encuestas están en una base de datos de acceso restringido.</li>
          <li>Los comprobantes se guardan en un almacenamiento privado y el personal del CDA los abre con un enlace que caduca en un minuto.</li>
          <li>El registro de accesos del servidor no guarda tu nombre, tu mensaje ni tu dirección de red. Para limitar el uso abusivo, el servidor cuenta las peticiones por dirección de red solo de forma temporal, y no la asocia a tu cita.</li>
        </ul>
        <p>Ninguna medida es infalible, pero trabajamos para que tus datos no se pierdan, no se alteren y no los vea quien no debe.</p>

        <h2>6. Cookies</h2>
        <p>
          No usamos cookies de seguimiento, de publicidad ni herramientas de analítica. El sitio
          guarda en tu navegador, como mucho, información técnica propia para funcionar.
        </p>

        <h2>7. Cuánto tiempo los conservamos</h2>
        <p>
          Conservamos tus datos mientras sean necesarios para las finalidades de la sección 3 y
          para cumplir nuestras obligaciones legales. Puedes pedir que los eliminemos; lo haremos
          salvo que la ley o una obligación con el CDA exija conservarlos.
        </p>

        <h2>8. Tus derechos</h2>
        <p>Como titular de los datos puedes:</p>
        <ul class="legal-lista">
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Saber el uso que le hemos dado a tus datos.</li>
          <li>Revocar la autorización y pedir la supresión de tus datos cuando no se respeten los principios y garantías de la ley.</li>
          <li>Acceder de forma gratuita a tus datos personales.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
        </ul>

        <h2>9. Cómo ejercer tus derechos</h2>
        <p>
          Escríbenos a <a href="mailto:${escaparHtml(CDA.email)}">${escaparHtml(CDA.email)}</a>,
          llámanos al ${escaparHtml(CDA.telefono)} o acércate a la sede. Indícanos tu nombre y tu cédula,
          qué quieres consultar, corregir o eliminar, y cómo contactarte.
        </p>
        <ul class="legal-lista">
          <li><strong>Consultas:</strong> las respondemos en máximo 10 días hábiles. Si necesitamos más tiempo, te avisamos el motivo y el plazo, que no pasará de 5 días hábiles más.</li>
          <li><strong>Reclamos</strong> (corregir, eliminar o revocar): los atendemos en máximo 15 días hábiles. Si necesitamos más tiempo, te avisamos, y el plazo no pasará de 8 días hábiles más.</li>
        </ul>
        <p>
          Solo puedes acudir a la SIC después de haber agotado este trámite con nosotros.
        </p>

        <h2>10. Autorización</h2>
        <p>
          Cuando envías un formulario de este sitio autorizas el tratamiento de tus datos como se
          describe en esta política. Puedes revocar esa autorización cuando quieras por los canales de
          la sección 9.
        </p>

        <h2>11. Cambios a esta política</h2>
        <p>
          Si la actualizamos, publicamos la nueva versión en esta misma página.
        </p>
        <p class="legal-fecha">Última actualización: ${POLITICA_DATOS_ACTUALIZADA}</p>
      </div>
    </section>
  `;
}
