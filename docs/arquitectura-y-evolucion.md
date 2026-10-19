# Arquitectura, flujo y plan de evolución (prueba → pro)

> Cómo encaja todo: quién hace qué, con qué herramienta, y cómo pasamos de la etapa de
> PRUEBA actual a la etapa PRO. Definido 2026-10-19. **Principio rector: todo el conocimiento
> vive en git; ningún Claude "recuerda" — todos LEEN el repo.** Así, si un chat se comprime o
> se pierde (ya pasó), el siguiente levanta el contexto del repositorio y sigue.

## Roles y herramientas

| Rol | Quién | Herramienta | Hace |
|---|---|---|---|
| **Extracción** | Claude nube (este entorno) | repo + skill `procesar-juego` + validador | Lee docs → `orden.json` + registro + archivo. **No carga en Gesruta.** |
| **Carga** | **Bot local** (Python, pyautogui/Win32) | `robot_viajes.py` | Lee `orden.json` y carga en Gesruta por pantalla. **Programa fijo.** |
| **Desarrollo del bot** | Claude escritorio (computer-use) | PC de Julio | Construye/debuggea el bot. **NO por cada juego.** |
| **Orquesta** | Julio | git + ejecutar el bot | pull orden → corre bot → push resultado. |
| **Medio / fuente de verdad** | **git** | repo | Handoff entre etapas y memoria durable. |

## El flujo (objetivo)

```
docs físicos/email → entrada/ (git)
      │  Claude nube (skill procesar-juego, chat CORTO)
      ▼
   orden.json (git)      ← CONTRATO DE ENTRADA  (ordenes-carga/CONTRATO-orden-json.md)
      │  Julio: git pull
      ▼
   BOT LOCAL (estable, data-driven) → carga en Gesruta
      │
      ▼
   resultado.json (git)  ← CONTRATO DE SALIDA  (Nº viaje/albarán + estado por albarán)
      │  Claude nube / Julio
      ▼
   registro-procesamiento.csv  ← se escriben los Nº de Gesruta (loop cerrado)
```

**La clave:** el **juego es DATO** (`orden.json`); el **bot es un programa fijo**. Hoy el bot se
"re-codea" por juego — ese es el eslabón que hay que eliminar (no escala a 20/día y se rompe al
perder contexto).

## Estado del bot v1 (congelado — registro durable por si se pierde el chat del escritorio)

`robot_viajes.py` (pyautogui + Win32), TLE:
- Cabecera auto (tractora/remolque/chofer) + verificación; BUSCAR remolque (doble clic código →
  dígitos → lupa → doble clic fila).
- Albarán: refe, fechas, cliente, origen (sobre-selección), destino, carga; líneas con
  quita-puntos-de-miles.
- KM anclados al rectángulo de la ventana (lee tacógrafo, calcula carga/vacío), graba albarán,
  graba viaje con foco + F2, encadena al siguiente.
- Reglas de oro: no inventar / fallar ruidoso; sin albaranes ficticios en producción; no teclea
  credenciales; la clave no se guarda.
- Última corrida (15/10 17:30): viaje 1 (Pedro, R8574BBC) grabó completo; viaje 2 abortó por
  correr una versión previa al fix de la lupa.
- **Pendiente bot:** autónomos (Alfonsín, Abal, Fraga) con tractora propia → sus km van en
  **Gastos** con los conceptos **KILOMETROS** (carga) y **KILOMETROS EN VACIO** (vacío), NO en el
  formulario Kilómetros. (La extracción ya entrega `km.carga`, `km.vacio` y `cabecera.tipo`.)

## Contrato de salida — `resultado.json` (a implementar en el bot)

Para cerrar el loop sin intervención manual, el bot escribe un resultado que Claude reconcilia:
```json
{ "orden": "ordenes/2026-10-05/pedro-fraga/...", "corrida": "2026-10-15T17:30",
  "albaranes": [ {"referencia":"2029398","nro_viaje":"","nro_albaran":"","estado":"grabado|abortado","motivo":""} ] }
```

## Plan de evolución

**Etapa PRUEBA (hoy):**
- `orden.json` generado por Claude nube ✔ (contrato estable ✔).
- Claude escritorio **ajusta el código del bot por juego** y Julio lo corre. Loop manual (Julio
  lee los Nº de Gesruta y los pasa). Frágil a la compresión de contexto.

**Transición (próximos pasos):**
1. **Bot data-driven:** el bot lee `orden.json` directo, sin recodeo por juego. (trabajo del bot)
2. **Contrato de salida `resultado.json`** → loop cerrado automático al registro.
3. **Autónomos en Gastos** (KILOMETROS / KILOMETROS EN VACIO).
4. **Pre-cargar Gesruta** (backlog `pendientes-gesruta.md`) para que autocomplete y el bot no pise.

**Etapa PRO (objetivo):**
- Bot estable data-driven; extracción vía skill en chats cortos; loop cerrado; Gesruta al día.
- 20 viajes/día **sin un Claude editando código en cada juego**. Claude escritorio solo para
  mejorar/debuggear el bot, no para operar.
- Resiliencia total a compresión: el repo es la memoria; cualquier chat nuevo levanta el contexto.

## Por qué esto resuelve el dolor de la compresión
Hoy, cuando un chat (nube o escritorio) se comprime, se pierde el "cómo operábamos". Con esta
arquitectura el **cómo** está en el repo (CLAUDE.md, `correcciones-julio.json`, CONTRATO, skill
`procesar-juego`, este doc, spec del bot). Ningún Claude necesita recordar: lee git y sigue.
