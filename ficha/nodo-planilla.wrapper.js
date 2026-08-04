// Nodo Code "Planilla" del workflow "[ESTEVEZ] Vista Pendientes" (mismo
// despliegue que /webhook/viajes-pendientes y /webhook/viajes-accion, mismo
// dominio https://studio-julio.duckdns.org/ -- v1.1 pieza 2 no monta un
// workflow nuevo, cuelga del que ya esta publicado).
//
// Entrada: cadena "Leer Viajes" -> "Leer Tarifas" (executeOnce) -> "Leer
// Indexacion" (executeOnce) -> este nodo. OJO de arquitectura (probado en
// vivo antes de escribir esto, ver encargo): conectar 3 lecturas de tabla en
// paralelo hacia un mismo nodo Code NO ejecuta las 3 de forma confiable en
// esta instancia de n8n (una rama queda sin ejecutar), y encadenar con la
// tabla mas grande (Indexacion, 37.660 filas crudas) en el medio de la
// cadena cuelga la ejecucion. La cadena Viajes(chica)->Tarifas(538, ultimo
// hop antes de Indexacion)->Indexacion(37.660, ultimo hop antes del Code) es
// el orden que corrio bien -- misma posicion relativa que el patron ya
// probado en Pendientes/Aplicar Accion (tabla grande como ultimo input
// directo al Code, nunca como input de un tercer nodo intermedio).
//
// Indexacion llega CRUDA (con la duplicacion x538 real de la tabla, ver
// indexacion.js); armarFilas() la deduplica antes de buscar tramos.

const viajes = $('Leer Viajes').all().map(function (it) { return it.json || {}; });
const tarifas = $('Leer Tarifas').all().map(function (it) { return it.json || {}; });
const indexacionCruda = $input.all().map(function (it) { return it.json || {}; });

const filas = armarFilas(viajes, tarifas, indexacionCruda);
return [{ json: { html: renderHTML(filas), total: filas.length } }];
