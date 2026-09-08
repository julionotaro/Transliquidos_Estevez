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
//   - columnas nuevas: regimen_indexacion, origen_km, origen_km_vacios, origen_campos (audit JSON),
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
// Los nodos dataTable `get` se ejecutan UNA vez por item de entrada y CONCATENAN
// su salida: si entran N items, cada fila de Tarifas/puntos aparece N veces. Sin
// deduplicar, buscarTarifaContractual veria la misma tarifa repetida y marcaria
// "2 tarifas posibles" (falsa ambiguedad). Se deduplican por identidad de fila.
function _leerTabla(nombre) {
  var filas = [];
  try { filas = $(nombre).all().map(function (it) { return (it && it.json) ? it.json : {}; }); } catch (e) { return []; }
  var vistos = {}, out = [];
  for (var i = 0; i < filas.length; i++) {
    var k = JSON.stringify(filas[i]);
    if (vistos[k]) { continue; }
    vistos[k] = true; out.push(filas[i]);
  }
  return out;
}
let tarifasTbl = _leerTabla('Leer Tarifas');
let puntosTbl = _leerTabla('Leer Puntos');
// Punto canonico Gesruta para MOSTRAR en origen/destino: "codigo · NOMBRE". El
// literal leido se conserva en `detalle`/origen_campos (no se pierde). Si no
// resuelve con seguridad, se deja el literal tal cual; el resolver ya marca
// REVISAR aparte cuando la resolucion no es exacta.
// LUGAR vs EMPRESA (ejec. 975): para identidad (cliente/referencia/kg) el
// documento manda, pero para el LUGAR suele escribir la EMPRESA ("FORESA IND.
// QUIMICAS...", "CELLMARK", "COMQUIMICOS...REVI") donde la ficha escribe el
// pueblo ("Caldas", "Barcelona", "Orense"). Una razon social no resuelve a punto
// Gesruta -> sin punto no hay tarifa. Cascada: se prueba el literal del documento
// y, si no resuelve, el de la ficha. (Cuando se carguen los alias empresa->punto
// el primero resolvera solo; hasta entonces la ficha es la red de seguridad.)
const mejorLiteralPunto = function (literalDoc, literalFicha) {
  if (typeof resolverPunto !== 'function' || !puntosTbl.length) { return literalDoc || literalFicha || ''; }
  if (literalDoc) {
    const r1 = resolverPunto(literalDoc, 'documento', puntosTbl);
    if (r1 && r1.id_punto) { return literalDoc; }
  }
  if (literalFicha) {
    const r2 = resolverPunto(literalFicha, 'ficha', puntosTbl);
    if (r2 && r2.id_punto) { return literalFicha; }
  }
  return literalDoc || literalFicha || '';
};
const puntoGesruta = function (literal) {
  if (!literal) { return ''; }
  if (typeof resolverPunto !== 'function' || !puntosTbl.length) { return s(literal); }
  const r = resolverPunto(literal, 'documento', puntosTbl);
  return (r && r.id_punto) ? (r.id_punto + ' · ' + r.nombre_canonico) : s(literal);
};
// CASCADA DE PRECIO (resolverPrecio, inlineado): 1) tarifa contractual, 2) tarifa
// por ANALOGIA confirmada por Julio (embebida en ANALOGIAS_EMBEBIDAS), 3) precio
// impreso en la orden, 4) vacio con motivo. Antes solo corria el escalon 1
// (buscarTarifaContractual) y las 12 analogias confirmadas no se aplicaban nunca.
// `origen_del_precio` viaja a la fila para que la vista muestre de donde salio.
var ANALOGIAS = (typeof ANALOGIAS_EMBEBIDAS !== 'undefined') ? ANALOGIAS_EMBEBIDAS : {};
var RUTAS_CLIENTE = (typeof RUTAS_CLIENTE_EMBEBIDAS !== 'undefined') ? RUTAS_CLIENTE_EMBEBIDAS : {};
var PLANTILLAS = (typeof PLANTILLAS_EMBEBIDAS !== 'undefined') ? PLANTILLAS_EMBEBIDAS : {};
// GUARDA DE REFERENCIA POR EMISOR (verificarReferencia, inlineado). Hace DOS
// comprobaciones:
//
//   a) FORMATO del emisor: Foresa referencia de 7 digitos, Bresfor de 10 —
//      reglas OPUESTAS en documentos casi identicos. Ya activa.
//
//   b) CRUZADA contra los demas numeros del documento: si la referencia leida es
//      IGUAL a un pedido, a la ref. del comprador o al albaran interno, casi
//      seguro se tomo el numero equivocado (el documento tiene 3 a 5 numeros que
//      compiten). Un pedido tiene formato de numero y pasa cualquier chequeo de
//      forma; SOLO se lo caza comparandolo con el resto. Esta comprobacion es la
//      mas potente y ya esta CABLEADA: se arma `otros` con los numeros-trampa que
//      el viaje traiga. Hoy el prompt aun no los extrae por separado, asi que
//      `otros` queda vacio y la cruzada no dispara (degrada a solo-formato, sin
//      cambiar nada). Se ACTIVA SOLA en cuanto el prompt empiece a devolver
//      cualquiera de estos campos. Ese es el unico gancho que le falta al paso 3.
//
// CONTRATO para el paso 3 (que el prompt debe devolver, ADEMAS de `referencia`,
// para activar la cruzada): pedido, pedido_cliente, ref_cliente, pedido_compra,
// n_albaran_interno, doc_interno, nmr_cliente. Cada uno es uno de los numeros que
// las secciones "ignorar" de las plantillas marcan como trampa.
var CAMPOS_OTROS_NUMEROS = ['pedido', 'pedido_cliente', 'ref_cliente', 'pedido_compra',
  'n_albaran_interno', 'doc_interno', 'nmr_cliente'];
const chequearReferencia = function (v) {
  if (typeof verificarReferencia !== 'function' || !v.referencia || !v.cliente) { return ''; }
  var otros = {};
  for (var i = 0; i < CAMPOS_OTROS_NUMEROS.length; i++) {
    var k = CAMPOS_OTROS_NUMEROS[i];
    if (v[k] !== undefined && v[k] !== null && String(v[k]).length) { otros[k] = v[k]; }
  }
  const r = verificarReferencia(v.referencia, v.cliente, PLANTILLAS, otros);
  return (r && r.ok === false && r.revisar) ? (r.motivo || 'referencia con formato inesperado para el cliente') : '';
};

// SELECCION DE REFERENCIA POR REGLA (elegirReferencia, inlineado). La raiz del
// error de la corrida 1172: el modelo devolvia UN campo `referencia` y elegia mal
// (FORESA 492789 en vez del 2017843 de 7 digitos; RNM el numero del CMR en vez de
// la guia). La cura no es adivinar mejor: es que el modelo TRANSCRIBA todos los
// numeros con su etiqueta (doc.numeros) y que el CODIGO elija con la regla de la
// plantilla del emisor (formato / ancla). Degrada seguro: si el prompt aun no
// manda `numeros`, no toca nada y se comporta como antes (no marca de mas).
const numerosDelViaje = function (v) {
  var out = [];
  var docs = Array.isArray(v.docs) ? v.docs : [];
  for (var i = 0; i < docs.length; i++) {
    var ns = docs[i] && docs[i].numeros;
    if (Array.isArray(ns)) { for (var j = 0; j < ns.length; j++) { if (ns[j]) { out.push(ns[j]); } } }
  }
  return out;
};
// Aplica la regla y devuelve el motivo de revision si no pudo elegir. Muta
// v.referencia SOLO cuando la regla eligio un valor (nunca lo borra).
const seleccionarReferencia = function (v) {
  if (typeof elegirReferencia !== 'function' || !v.cliente) { return ''; }
  var numeros = numerosDelViaje(v);
  if (!numeros.length) { return ''; }  // sin transcripcion -> comportamiento previo
  var sel = elegirReferencia(v.cliente, numeros, PLANTILLAS, v.referencia);
  if (!sel) { return ''; }
  if (sel.valor) { v.referencia = sel.valor; }
  return sel.revisar ? (sel.motivo || 'no se pudo elegir la referencia por regla') : '';
};
const tarifaDe = function (v, origenLit, destinoLit) {
  if (typeof resolverPrecio !== 'function' || !tarifasTbl.length) { return { tn: null, fijo: null, motivo: '', origen_precio: null }; }
  const viaje = { cliente: v.cliente, origen: origenLit, destino: destinoLit, material: v.material, precio_orden: v.tarifa_tn_documento };
  const r = resolverPrecio(viaje, tarifasTbl, ANALOGIAS, puntosTbl);
  if (!r) { return { tn: null, fijo: null, motivo: '', origen_precio: null }; }
  if (r.tarifa === null && r.tarifa_tn === undefined && r.precio_fijo === undefined) {
    return { tn: null, fijo: null, motivo: r.motivo || '', origen_precio: null };
  }
  return {
    tn: (r.tarifa_tn === undefined ? null : r.tarifa_tn),
    fijo: (r.precio_fijo === undefined ? null : r.precio_fijo),
    motivo: r.revisar ? (r.motivo || ('tarifa via punto resuelto — verificar (' + s(origenLit) + '->' + s(destinoLit) + ')')) : '',
    origen_precio: r.origen_del_precio || null,
  };
};

const filas = [];
for (const v of viajes) {
  // Literal de lugar que SI resuelve a punto (documento, si no la ficha).
  let origenLit = mejorLiteralPunto(v.origen, v.lugar_carga);
  let destinoLit = mejorLiteralPunto(v.destino, v.lugar_descarga);
  // GUARDA ORIGEN != DESTINO (bug real ejec 1065). GPT leyo el CMR y puso como
  // ORIGEN el lugar de ENTREGA ("CELLA, TERUEL"); los dos literales resolvieron
  // al MISMO punto y el viaje quedo "TE · TERUEL -> TE · TERUEL". Ninguna tarifa
  // existe para una ruta a si misma, asi que ademas se perdia el precio. Un viaje
  // nunca carga y descarga en el mismo punto: si eso pasa, el documento se leyo
  // mal -> manda la FICHA. Se compara el PUNTO CANONICO, no el literal, porque el
  // colapso ocurre justo al traducir ("CELLA, TERUEL" y "CELLA" -> TERUEL).
  let avisoRuta = '';
  const pg0 = puntoGesruta(origenLit), pg1 = puntoGesruta(destinoLit);
  if (pg0 && pg0 === pg1) {
    const oF = s(v.lugar_carga), dF = s(v.lugar_descarga);
    if (oF && dF && puntoGesruta(oF) !== puntoGesruta(dF)) {
      avisoRuta = 'el documento daba el mismo punto como origen y destino (' + pg0 + '); se usa la ruta de la ficha (' + oF + ' -> ' + dF + ')';
      origenLit = oF; destinoLit = dF;
    } else {
      avisoRuta = 'origen y destino resuelven al mismo punto (' + pg0 + ') y la ficha no los distingue; ruta anulada por imposible';
      origenLit = ''; destinoLit = '';
    }
  }
  // CONJUNTO CERRADO DEL CLIENTE (rutas-conocidas, embebido). No cambia QUE punto
  // se elige: pregunta si ESTE cliente hizo alguna vez esta ruta. No rechaza rutas
  // nuevas, las MARCA -> la fila va a REVISAR con el motivo. Es la guarda que caza
  // el TERUEL de RNM: una direccion postal mal impresa que resuelve a un punto al
  // que el cliente nunca viajo. Un cliente fuera del recorte de prueba (RUTAS
  // vacio para el) no genera aviso: degrada a silencio, no a falso positivo.
  if (typeof resolverPuntoDeCliente === 'function' && origenLit && destinoLit) {
    const rc = resolverPuntoDeCliente(destinoLit, { cliente: v.cliente, rol: 'destino', origen: origenLit }, puntosTbl, RUTAS_CLIENTE);
    if (rc && rc.ruta_conocida === false && rc.aviso_ruta) {
      avisoRuta = [avisoRuta, rc.aviso_ruta].filter(Boolean).join('; ');
    }
  }
  // 1) el codigo elige la referencia por la regla del emisor (si el prompt
  //    transcribio los numeros); 2) la guarda de formato/cruzada revisa el
  //    resultado. Los dos motivos se acumulan.
  const avisoSel = seleccionarReferencia(v);
  const avisoRef = [avisoSel, chequearReferencia(v)].filter(Boolean).join('; ');
  const tar = tarifaDe(v, origenLit, destinoLit);
  filas.push({
    hoja_id: idDe(v.hoja_idx),
    orden: n(v.orden),
    fecha: s(v.fecha_carga),
    empresa: s(v.empresa),
    tractora: s(v.tractora),
    semi: s(v.remolque),
    conductor: s(v.conductor),
    // Mini-mapa chofer -> tipo (autonomo | dependiente). Abal/Fraga/Alfonsin son
    // autonomos (confirmado Julio); el resto, dependientes. Vacio si no hay chofer.
    tipo_conductor: (typeof tipoConductor === 'function') ? tipoConductor(v.conductor) : '',
    cliente: s(v.cliente),
    // origen/destino como punto canonico Gesruta "codigo · NOMBRE" (el literal
    // leido queda en detalle/origen_campos). La tarifa se calcula arriba con el
    // literal crudo (buscarTarifaContractual resuelve por su cuenta).
    origen: puntoGesruta(origenLit),
    destino: puntoGesruta(destinoLit),
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
    // De donde salio el precio: 'contractual' | 'analogia' | 'orden' | ''. La
    // analogia y la orden son observadas, no pactadas: la vista las muestra a parte.
    origen_del_precio: s(tar.origen_precio),
    pais_facturacion: paisDe(v.cliente, v.referencia),
    fecha_descarga: s(v.fecha_descarga),
    km_inicio: n(v.km_inicio),
    km_final: n(v.km_final),
    km_cargados: n(v.km_cargados),
    km_vacios: n(v.km_vacios),
    // De donde salio el km vacio, o por que no se pudo calcular:
    //   cadena_tabla        encadenado con el ultimo odometro de la tabla Viajes
    //   cadena_lote         encadenado con otro viaje del mismo lote
    //   sin_odometro_previo primer viaje conocido de esa tractora
    //   sin_km_inicio / sin_matricula / negativo / salto_excesivo
    origen_km_vacios: s(v.origen_km_vacios),
    // Calidad de LECTURA de la ficha (v3.2). Eje distinto de `estado`, que habla
    // de documentacion. Sin valor por defecto: si el correlacionador no lo puso,
    // queda vacio y se ve como no determinado, nunca como un OK.
    // Si se corrigio la ruta por la guarda origen!=destino, la fila va a REVISAR
    // aunque la lectura fuera OK: el humano tiene que confirmar la ruta.
    estado_lectura: (avisoRuta || avisoRef) ? 'REVISAR' : s(v.estado_lectura),
    motivo_revision: [s(v.motivo_revision), avisoRuta, avisoRef].filter(Boolean).join('; '),
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
