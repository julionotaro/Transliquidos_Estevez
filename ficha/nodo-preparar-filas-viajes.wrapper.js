// Nodo Code "Preparar Filas Viajes" del workflow [ESTEVEZ] Ingesta Viaje
// (WD0q9Ic0oDvUoJwp). Arma UNA fila de la tabla `viajes` por cada viaje del
// datos_json de "Formatear Linea Gesruta".
//
// Traido al repo como fuente de verdad en Fase 2: este nodo NO estaba versionado
// y ahi nacio el bug de `estado_lectura` (columna creada, no mapeada -> null en
// silencio). Toda columna nueva de `viajes` DEBE emitirse aca Y mapearse en el
// nodo dataTable "Guardar Viajes" (schema + value). Verificar por readback, no
// por codigo.
//
// Fase 2 (modelo albaran=unidad):
//   - estado: ahora es el estado UNICO de documentacion del correlacionador
//     (con_documentacion | PENDIENTE_DOCUMENTACION), no el viejo pendiente/
//     sin_documentacion. Ningun consumidor filtra por los valores viejos
//     (unico lector: Export Viajes Excel, passthrough). Conviven ambos
//     vocabularios en filas viejas; no hace falta migrar.
//   - columnas nuevas: regimen_indexacion, origen_km, origen_campos (audit JSON),
//     pendiente_falta, pendiente_reclamar_a.

const src = $('Formatear Linea Gesruta').first().json;
if (!src.ok || !src.datos_json) { return []; }
let S;
try { S = JSON.parse(src.datos_json); } catch (e) { return []; }
const viajes = Array.isArray(S.viajes) ? S.viajes : [];
let hojasGuardadas = [];
try { hojasGuardadas = $('Guardar Hoja').all(); } catch (e) {}
const idDe = function (idx) {
  const it = hojasGuardadas[idx];
  return (it && it.json && it.json.id !== undefined && it.json.id !== null) ? String(it.json.id) : '';
};
const s = function (x) { return (x === null || x === undefined) ? '' : String(x); };
const n = function (x) { return (typeof x === 'number' && isFinite(x)) ? x : null; };
// Porte / pais de facturacion: se conserva la regla de dominio del formateador v2.
const paisDe = function (cli, ref) {
  const c = (cli || '').toString().toUpperCase();
  if (!c) { return ''; }
  if (c.indexOf('RNM') >= 0) { return 'PT'; }
  if (c.indexOf('QUIMIDROGA') >= 0) {
    const d = (ref || '').toString().replace(/\D/g, '');
    if (d.indexOf('100') === 0) { return 'PT'; }
    if (d.indexOf('70') === 0) { return 'ES'; }
    return '';
  }
  return 'ES';
};
const out = [];
for (const v of viajes) {
  out.push({ json: {
    hoja_id: idDe(v.hoja_idx),
    orden: n(v.orden),
    fecha: s(v.fecha_carga),
    empresa: s(v.empresa),
    tractora: s(v.tractora),
    semi: s(v.remolque),
    conductor: s(v.conductor),
    cliente: s(v.cliente),
    origen: s(v.origen),
    destino: s(v.destino),
    material: s(v.material),
    referencia: s(v.referencia),
    tipo_doc: s(v.tipo_doc),
    kg_documento: n(v.kg_documento),
    kg_hoja: n(v.cantidad_kg),
    fuente_peso: s(v.fuente_peso),
    importe_documento: n(v.importe_documento),
    tarifa_tn_documento: n(v.tarifa_tn_documento),
    pais_facturacion: paisDe(v.cliente, v.referencia),
    fecha_descarga: s(v.fecha_descarga),
    km_inicio: n(v.km_inicio),
    km_final: n(v.km_final),
    km_cargados: n(v.km_cargados),
    km_vacios: n(v.km_vacios),
    // Calidad de LECTURA de la ficha (v3.2). Eje distinto de `estado`, que habla
    // de documentacion. Sin valor por defecto: si el correlacionador no lo puso,
    // queda vacio y se ve como no determinado, nunca como un OK.
    estado_lectura: s(v.estado_lectura),
    motivo_revision: s(v.motivo_revision),
    pagina_origen: n(v.pagina_origen),
    // Estado UNICO de documentacion (§3). Lo decide el correlacionador.
    estado: s(v.estado),
    // Fase 2: columnas nuevas (todas mapeadas tambien en "Guardar Viajes").
    regimen_indexacion: s(v.regimen_indexacion),
    origen_km: s(v.origen_km),
    origen_campos: v.origen_campos ? JSON.stringify(v.origen_campos) : '',
    pendiente_falta: s(v.pendiente_falta),
    pendiente_reclamar_a: s(v.pendiente_reclamar_a),
    factura_id: '',
    detalle: JSON.stringify(v)
  } });
}
return out;
