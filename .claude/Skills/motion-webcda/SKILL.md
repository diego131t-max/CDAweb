---
name: motion-webcda
description: Principios de movimiento e interacción para el sitio webCDA. Úsala al agregar o revisar animaciones, transiciones, estados hover, entradas al scrollear, feedback de formularios o transiciones entre rutas. Incluye las reglas específicas de esta SPA sin build, donde el router destruye el DOM en cada cambio de ruta.
user-invocable: true
disable-model-invocation: false
---

# Movimiento en webCDA

Guía para animar en este sitio. Está escrita para **esta** arquitectura: SPA vanilla sin
build, sin módulos, donde `render()` reescribe `app.innerHTML` completo en cada cambio de
ruta.

El sitio es de un Centro de Diagnóstico Automotor: su trabajo es que alguien agende una
revisión desde el celular. **El movimiento acompaña esa tarea, nunca compite con ella.**

## La regla que rompe todo lo demás si se ignora

`render()` en `app.js` hace `app.innerHTML = ...` en cada cambio de ruta. Eso **destruye
todos los nodos del DOM**. Consecuencias que hay que manejar siempre:

- Los `IntersectionObserver`, `requestAnimationFrame` y listeners atados a nodos viejos
  quedan apuntando a elementos que ya no existen.
- Cualquier animación con estado en JavaScript se pierde o queda colgada en memoria.

Por eso las páginas con interacción exponen un `bind<Nombre>()` que `render()` llama después
de asignar el HTML. **Toda animación con JavaScript se inicializa ahí**, y si crea un
observer o un intervalo, hay que desconectarlo antes de crear el siguiente:

```js
let observadorEntrada = null;

function bindAnimacionesEntrada() {
  // Primero soltar el anterior: el DOM al que observaba ya no existe.
  if (observadorEntrada) observadorEntrada.disconnect();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  observadorEntrada = new IntersectionObserver(/* ... */);
  document.querySelectorAll("[data-animar]").forEach((el) => observadorEntrada.observe(el));
}
```

**Preferí siempre CSS sobre JavaScript.** Una animación puramente CSS no tiene estado que
limpiar: se va con el nodo. Es la razón principal para no meter una librería de animación
en este sitio salvo que haga falta de verdad.

## Qué se puede animar y qué no

**Animá solo `transform` y `opacity`.** Son las dos propiedades que el navegador resuelve
en la capa de composición, sin recalcular layout ni repintar.

**Nunca animes** `width`, `height`, `top`, `left`, `margin`, `padding` ni `box-shadow`:
disparan reflow en cada cuadro y en un celular de gama media se nota como tirones.

Para "crecer" usá `transform: scale()`. Para desplazar, `transform: translate()`. Si
necesitás animar una sombra, animá la `opacity` de un pseudo-elemento que la tenga.

**Cuidado con `backdrop-filter`**: el header lo usa (`blur(16px)`). Animar algo por encima
de una superficie con blur obliga a re-difuminar en cada cuadro. Si hace falta movimiento
ahí, quitá el blur mientras dure.

## Duración y curvas

| Qué | Duración | Curva |
|---|---|---|
| Hover, foco, cambio de color | 120–180 ms | `ease-out` |
| Entrada de un elemento | 300–400 ms | `cubic-bezier(.22,1,.36,1)` |
| Salida de un elemento | 180–240 ms | `ease-in` |
| Cambio de ruta | 200–300 ms | `ease-out` |

Dos criterios que resuelven la mayoría de las dudas: **lo que sale se va más rápido de lo
que entra** (nadie quiere esperar a que algo desaparezca), y **más de 400 ms se percibe como
lentitud**, no como elegancia.

El sitio ya usa `cubic-bezier(.22,1,.36,1)` en `.svc-card`. Reusala: es la curva de la casa.

## Movimiento reducido: obligatorio

El sitio **hoy no lo respeta** y es un hueco de accesibilidad. Hay gente para quien el
movimiento provoca mareo o migraña, y el sistema operativo ya expone esa preferencia.

Toda animación nueva va con su salida:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

No es "desactivar el movimiento": es dejar el **estado final** visible al instante. El
contenido nunca puede depender de que una animación haya corrido para verse.

En JavaScript, la comprobación equivalente es
`window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

## Dónde aporta en este sitio

En orden de valor real:

1. **Feedback en el agendamiento.** Es el flujo que da plata. El avance entre los 4 pasos,
   la aparición del aviso `.form-alert` cuando la combinación de servicio y vehículo no es
   válida, el estado del botón al confirmar. Acá el movimiento **comunica**, no decora.
2. **Entrada de secciones al scrollear.** Un `translateY(16px)` + `opacity` con
   `IntersectionObserver`. Sutil, una sola vez por elemento (`unobserve` después de
   disparar), nunca en bucle.
3. **Hover con intención.** Las tarjetas ya suben 8px; mantené esa escala en el resto.
4. **Transición entre rutas.** Un fundido corto sobre `#app` al cambiar de hash disimula el
   salto del `innerHTML`.

**Dónde NO**: tablas del panel de administración, listas largas y cualquier cosa que se
repita muchas veces en pantalla. Ahí el movimiento estorba y cuesta cuadros.

## Antes de dar por terminada una animación

- ¿Anima solo `transform` y `opacity`?
- ¿Tiene su bloque de `prefers-reduced-motion`, o el global la cubre?
- ¿Si usa JavaScript, se re-inicializa en el `bind` y desconecta lo anterior?
- ¿Se ve bien en móvil, que es donde va a estar la mayoría de los usuarios?
- ¿Subiste el `?v=` en `index.html`?

Y la pregunta que decide: **¿esto ayuda a entender qué está pasando, o solo se ve lindo?**
Si es lo segundo y cuesta cuadros en un celular, no va.

## Sobre agregar una librería

Este sitio no tiene build ni npm: cualquier librería entra por CDN como script bloqueante.
Antes de sumar GSAP o similar, verificá que lo que necesitás no salga con CSS más
`IntersectionObserver`, que es lo que cubre el 90% de los casos de arriba.

Si igual hace falta —timelines encadenadas complejas, scroll-driven fino—, GSAP es la opción
razonable (~50KB, expone un global, no necesita build). Pero **crea la timeline dentro del
`bind` y matala con `.kill()` antes de recrearla**, o vas a acumular timelines huérfanas en
cada cambio de ruta.
