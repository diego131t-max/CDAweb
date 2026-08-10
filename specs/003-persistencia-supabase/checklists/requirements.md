# Specification Quality Checklist: Las citas llegan al CDA y los datos viven en un almacenamiento central

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [~] No [NEEDS CLARIFICATION] markers remain — queda **uno** (FR-028, cupos), bloqueado
      a propósito por dato del negocio. Ver Notas.
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Las tres preguntas: dos resueltas, una bloqueada

Se plantearon tres el 2026-08-10 y se resolvieron dos en el momento:

- **Cambio de estado desde el panel** → **SÍ**. El personal puede marcar atendida o
  cancelada. Incorporado como historia 4 y FR-019 a FR-022.
- **Aviso al cliente** → **SÍ, por correo**. Incorporado como historia 5 y FR-023 a FR-027.
  Se descartó WhatsApp por costo y trámite de aprobación; queda anotado como mejora
  posterior.
- **Cupos por franja horaria (FR-028)** → **SIN RESPUESTA, pendiente del propietario del
  CDA.** Se deja el marcador a propósito. Es la capacidad operativa real del centro: un
  dato del negocio que el principio I prohíbe estimar. No se resuelve adivinando ni con un
  valor "razonable".

El marcador que queda es deliberado, no un descuido. Ver la sección *Bloqueante* de la
especificación: no frena la planificación de las historias 1 a 5, solo las tareas de
control de cupos.

### Sobre la mención a Supabase

Aparece únicamente en **Assumptions**, marcada como decisión ya tomada y con el detalle
técnico remitido al plan. Los requisitos (`FR-001` a `FR-021`) y los criterios de éxito
están escritos en términos de "almacenamiento central" y son verificables sin conocer la
tecnología. Se considera que no viola "no implementation details": ocultar una decisión ya
tomada no haría la especificación más útil, solo menos honesta.

### Notas de validación

Iteración 1: la primera redacción arrastraba vocabulario técnico del pedido original
(nombres de clases de repositorio, `dependencias.ts`) dentro de los requisitos. Se movió a
Assumptions como restricción de arquitectura y los requisitos se reescribieron en términos
de lo que el CDA y sus clientes observan.
