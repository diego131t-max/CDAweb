/*
 * Configuración del compilador de Tailwind del navegador.
 *
 * Estaba en línea dentro de index.html. Se movió a un archivo aparte para que la política
 * de contenido pueda declarar `script-src 'self'` sin tener que hashear scripts en línea
 * (ver specs/002-endurecimiento-seguridad/research.md, D2 y D3).
 *
 * TIENE QUE CARGARSE DESPUÉS de ./tailwind.js: `window.tailwind` es un Proxy que el
 * compilador crea al arrancar, y asignarle `config` es lo que dispara la recompilación.
 * Si se carga antes, esta línea explota con "tailwind is not defined".
 *
 * `preflight: false` es la parte que no se puede tocar: apaga el reseteo de estilos de
 * Tailwind para que no pise las 1.605 líneas de styles.css, que es lo que dibuja el resto
 * del sitio. La única página que usa clases de Tailwind es pages/services.js.
 */
tailwind.config = {
  corePlugins: { preflight: false },
};
