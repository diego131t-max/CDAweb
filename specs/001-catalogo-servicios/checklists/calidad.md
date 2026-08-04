# Quality Checklist: Catálogo de servicios del CDA

**Purpose**: Validar que la implementación cumple la especificación y la constitución antes
de dar la funcionalidad por terminada
**Created**: 2026-08-04
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)

## Catálogo en el API

- [ ] CHK001 `GET /api/servicios` responde 200 con los seis servicios de FR-008
- [ ] CHK002 El endpoint es público: responde sin cabecera de autenticación
- [ ] CHK003 Cada servicio expone un `id` estable, distinto de su nombre visible
- [ ] CHK004 Solo `certificado-blindaje` declara exclusiones, y son las dos de motos
- [ ] CHK005 Existe `RepositorioServicios` como interfaz, con firmas asíncronas
- [ ] CHK006 Ningún archivo de `Backend/src/rutas/` importa la implementación concreta
- [ ] CHK007 La instanciación del repositorio ocurre solo en `dependencias.ts`

## Agendamiento (cliente)

- [ ] CHK008 El paso 2 del formulario muestra un `<select>` de servicios, no un input oculto
- [ ] CHK009 Con moto 2T o 4T seleccionada, blindaje NO aparece en la lista (FR-009)
- [ ] CHK010 Con livianos o pesados, aparecen los seis servicios
- [ ] CHK011 Cambiar el tipo de vehículo a uno incompatible con el servicio ya elegido
      impide avanzar (escenario 5 de la User Story 1)
- [ ] CHK012 La pantalla de confirmación muestra el servicio elegido
- [ ] CHK013 La cita guardada conserva el servicio elegido, no un valor fijo (FR-003)
- [ ] CHK014 Si el API no responde, el formulario explica el problema y no deja confirmar
      una cita sin servicio

## Panel de administración

- [ ] CHK015 Las cuatro secciones (reservas, vehículos, mensajes, reportes) cargan sin error
- [ ] CHK016 El reporte muestra el conteo por cada servicio del catálogo
- [ ] CHK017 Un servicio sin citas aparece con conteo cero, no desaparece (escenario 3, US2)
- [ ] CHK018 Una cita con un servicio ausente del catálogo no rompe el panel
- [ ] CHK019 El script `check-admin.js` del scratchpad ya no reproduce el `ReferenceError`

## Consistencia del sitio

- [ ] CHK020 La lista de servicios del asistente coincide con la del agendamiento (FR-001)
- [ ] CHK021 No queda ninguna lista de servicios codificada aparte del catálogo
- [ ] CHK022 `serviceOptions()` de `utils.js` está en uso y no es código muerto
- [ ] CHK023 Las citas sembradas de ejemplo fueron descartadas (FR-011)

## Constitución y calidad

- [ ] CHK024 Los seis nombres de servicio son exactamente los que ya publicaba el sitio;
      ninguno inventado (principio I)
- [ ] CHK025 Ningún endpoint nuevo expone datos personales de clientes (principio II)
- [ ] CHK026 `npx tsc --noEmit` pasa limpio (principio IV)
- [ ] CHK027 `npm test` pasa, con cobertura de la regla de exclusión de FR-009 (principio IV)
- [ ] CHK028 El sitio fue probado en el navegador: agendar, confirmar y ver el panel
      (principio IV)
- [ ] CHK029 Textos visibles y mensajes de error en español (principio V)
- [ ] CHK030 El `?v=` de `index.html` fue incrementado para los archivos modificados

## Notes

- CHK019 usa el script que reprodujo el fallo original: es la prueba de contraste directa
  entre el estado roto y el arreglado.
- CHK014 y CHK018 cubren los caminos de error, que son los que suelen quedar sin probar.
- **Riesgo abierto (no bloquea):** los seis servicios están pendientes de ratificación por
  el propietario del CDA. Ver la sección Assumptions de la spec.
- **Limitación conocida (no bloquea):** CHK011 y CHK013 se validan solo del lado del
  cliente, porque las citas todavía viven en `localStorage`. Ver "Limitación conocida" en
  plan.md.
