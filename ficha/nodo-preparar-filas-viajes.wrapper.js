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
// ---- Tarifa contractual (tabla Tarifas -> columna del viaje) ----------------
// Reusa buscarTarifaContractual (inlineado, con resolver-punto delante). Los
// nodos lectores son OPCIONALES: si "Leer Tarifas"/"Leer Puntos" no existen aun
// (deploy parcial), degrada a vacio en vez de romper — mismo patron defensivo que
// la dedup. NUNCA inventa: sin match unico deja la tarifa vacia y el motivo a la
// vista para REVISAR.
let tarifasTbl = [], puntosTbl = [];
try { tarifasTbl = $('Leer Tarifas').all().map(function (it) { return (it && it.json) ? it.json : {}; }); } catch (e) {}
try { puntosTbl = $('Leer Puntos').all().map(function (it) { return (it && it.json) ? it.json : {}; }); } catch (e) {}
const tarifaDe = function (v) {
  if (typeof buscarTarifaContractual !== 'function' || !tarifasTbl.length) { return { tn: null, fijo: null, motivo: '' }; }
  const r = buscarTarifaContractual({ cliente: v.cliente, origen: v.origen, destino: v.destino, material: v.material }, tarifasTbl, puntosTbl);
  if (!r) { return { tn: null, fijo: null, motivo: '' }; }
  if (r.tarifa === null) { return { tn: null, fijo: null, motivo: r.motivo || '' }; }
  return { tn: r.tarifa_tn, fijo: r.precio_fijo, motivo: r.revisar ? ('tarifa via punto resuelto — verificar (' + s(v.origen) + '->' + s(v.destino) + ')') : '' };
};

const filas = [];
for (const v of viajes) {
  const tar = tarifaDe(v);
  filas.push({
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
    // Tarifa CONTRACTUAL (de la tabla Tarifas, no de la OC impresa). Vacia si no
    // hay match unico; el motivo dice por que (para REVISAR sin inventar).
    tarifa_contractual_tn: n(tar.tn),
    tarifa_contractual_fijo: n(tar.fijo),
    tarifa_contractual_motivo: s(tar.motivo),
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
    // CAMBIO 3: ciclo de carga (eje distinto de `estado`=documentacion). Default
    // al ingresar. Regla de oro: mapear tambien en "Guardar Viajes". El robot
    // Gesruta (Pieza C) escribira 'cargada_gesruta'; aca solo el default.
    estado_carga: 'pendiente_revision',
    factura_id: '',
    detalle: JSON.stringify(v)
  });
}

// ---- Deduplicacion (§5.1) ---------------------------------------------------
// Idempotencia al reingestar: NO crear una segunda fila de un viaje ya guardado.
// Llave de identidad = matricula_tractora + km_inicio (odometro estrictamente
// creciente; distingue rotaciones del mismo dia/ruta, §7). La logica pura vive en
// dedup.js (inlineada por build-nodo.js). Lee los viajes ya en la tabla del nodo
// "Leer Viajes Existentes". Si ese nodo aun no existe (deploy parcial), degrada a
// "insertar todo" en vez de romper el pipeline — mismo patron defensivo que
// "Guardar Hoja" arriba.
let existentes = [];
try {
  existentes = $('Leer Viajes Existentes').all().map(function (it) { return (it && it.json) ? it.json : {}; });
} catch (e) { existentes = []; }

const ded = (typeof dedupViajes === 'function')
  ? dedupViajes(filas, existentes)
  : { insertar: filas, actualizarMotivo: [], omitidos: [] };

const out = [];
// (1) Filas NUEVAS -> se insertan (van al IF por la rama "no update" -> Guardar
// Viajes). Si la dedup sospecha km_inicio mal leido (misma ruta, km por poco),
// se suma el motivo y se fuerza REVISAR: se inserta pero visible, no encubierto.
for (const f of ded.insertar) {
  if (f._motivo_dedup) {
    f.motivo_revision = f.motivo_revision ? (f.motivo_revision + '; ' + f._motivo_dedup) : f._motivo_dedup;
    f.estado_lectura = 'REVISAR';
  }
  delete f._motivo_dedup;
  out.push({ json: f });
}
// (2) Reingresos con datos que DIFIEREN -> NO se insertan; se actualiza (ADITIVO)
// el motivo_revision de la fila existente. Tag `_dedup_update` para que el IF los
// enrute al dataTable "Actualizar Motivo Viaje" (update por id). Solo se tocan
// motivo_revision y estado_lectura: ningun otro dato de la fila (el humano pudo
// haber corregido algo ahi).
for (const u of ded.actualizarMotivo) {
  out.push({ json: { _dedup_update: true, id: u.id, motivo_revision: u.motivo_revision, estado_lectura: u.estado_lectura } });
}
// (3) ded.omitidos = reingresos identicos (duplicado puro): no se emiten.
return out;
