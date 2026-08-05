# Verificación en navegador

Los dos guiones de esta carpeta ejecutan el [quickstart.md](../quickstart.md) contra Chrome
sin interfaz, por el protocolo DevTools. **No reemplazan mirar el sitio con los ojos** —el
diseño, el espaciado y el móvil siguen siendo cosa de una persona— pero sí cubren todo lo que
es verificable de forma mecánica, que es la mayor parte.

Existen porque el principio IV de la constitución exige la ejecución real en el navegador y
prohíbe reportar como terminado algo que solo se leyó. Y porque **T018 de la funcionalidad 001
sigue abierta justamente por haberse verificado con una simulación en Node en vez del
navegador**: una simulación reproduce lo que uno cree que hace el código, no lo que el
navegador hace de verdad.

## Cómo se corren

Hacen falta los dos procesos, y el `ADMIN_TOKEN` real:

```bash
cd Backend && npm run dev          # API en :3000
node Frontend/server.js            # sitio en :5173

node specs/002-endurecimiento-seguridad/verificacion/verificar-navegador.js <ADMIN_TOKEN>
node specs/002-endurecimiento-seguridad/verificacion/verificar-falla-cerrado.js <ADMIN_TOKEN>
```

El segundo **apaga y vuelve a levantar el API solo** —lo necesita para probar el fallo
cerrado—, así que no lo corras contra nada que te importe tener arriba.

Requieren Chrome instalado en la ruta por omisión de Windows. Salen con código distinto de
cero si algo falla.

## Qué cubre cada uno

**`verificar-navegador.js`** — 25 comprobaciones del camino feliz:
T004 (el catálogo sigue cargando con helmet puesto), B4 (siete rutas sin violaciones de
política, cero peticiones al CDN, la política bloqueando un `onerror` inyectado), B1 (la
puerta del panel con credencial correcta e incorrecta, la credencial en `sessionStorage` y no
en `localStorage` ni en la URL), B2 (cinco valores hostiles que se ven como texto, sin doble
escape), B6 (higiene) y B3 (un mensaje que llega **de verdad** al servidor).

**`verificar-falla-cerrado.js`** — 21 comprobaciones de lo que tiene que fallar:
el panel con el API caído (no abre, no reutiliza la credencial guardada, no muestra ni un
dato), el formulario de contacto con el API caído (no dice "Enviado", conserva lo escrito), la
sección Mensajes distinguiendo "no pudimos preguntar" de "no hay mensajes", y cerrar sesión.

## Dos trampas que costaron encontrar

Quedan escritas porque las dos produjeron un resultado que parecía un hallazgo y no lo era —o
al revés:

1. **`Page.navigate` a una URL que solo difiere en el fragmento NO recarga el documento.** Hace
   una navegación en la misma página: los scripts no se vuelven a evaluar y el estado en
   memoria sobrevive. Verificar "recargar revalida la credencial" con `Page.navigate` da un
   falso positivo de bug: parece que el panel queda abierto con el API caído, cuando en
   realidad nunca se recargó. Va `Page.reload`.

2. **Buscar la cadena `onerror=` en el HTML para detectar XSS da falsos positivos.** Con el
   escape aplicado esa cadena aparece igual, pero como texto. Hay que comparar la ESTRUCTURA:
   qué etiquetas y atributos existen de verdad, contra el mismo render con datos inofensivos.
   El guion incluye un control negativo por este motivo — arma la tabla sin escapar y comprueba
   que el detector la marca. Sin ese control, un verificador que no detecta nada es
   indistinguible de uno roto.

## Lo que sigue necesitando una persona

- **Firefox y Safari.** Solo se prueba Chromium, y las implementaciones de la política de
  contenido difieren justo en los bordes. Si Firefox se queja del bloque
  `application/ld+json`, la salida es su hash SHA-256 en `script-src`, **no** aflojar la
  política.
- **Un móvil real.** Los puntos de quiebre de `pages/services.js` y la barra lateral del panel,
  que en móvil pasa a desplazarse en horizontal.
- **El diseño.** Que `#/servicios` se vea bien, no solo que sea idéntica a la versión anterior.
