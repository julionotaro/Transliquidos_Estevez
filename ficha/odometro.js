// ===== ODOMETRO POR TRACTORA — km vacios y ultimo km registrado ==============
//
// EL PROBLEMA (encargo de Julio: "el registro de ultimo KM tractora es por
// viaje, no solo en el ultimo viaje de cada ficha")
//
// Los km vacios se calculaban asi (correlacionar.js):
//
//     if (i > 0 && viajes[i - 1].hoja_idx === v.hoja_idx) {
//       v.km_vacios = v.km_inicio - viajes[i - 1].km_final;
//     }
//
// Tres defectos, y los tres se proyectan a futuro:
//
// 1) EL PRIMER VIAJE DE CADA FICHA NUNCA TIENE KM VACIOS. La condicion exige un
//    viaje anterior EN LA MISMA HOJA. Una ficha es una semana con hasta 3
//    bloques, asi que se pierde el vacio de ~1 de cada 3 viajes, siempre el
//    mismo: el primero. No es un caso raro, es un tercio del dato.
//
// 2) NADA PERSISTE EL ODOMETRO ENTRE INGESTAS. El km_final del ultimo viaje de
//    la semana pasada esta en la tabla Viajes, pero nunca se vuelve a leer. Sin
//    eso el primer viaje de una ficha NO PUEDE tener vacios, por diseño: le
//    falta el dato de donde venia el camion. Por eso el defecto 1 no se arregla
//    mirando solo el lote que se esta ingestando.
//
// 3) ENCADENAR POR POSICION EN EL ARRAY ES LA LLAVE EQUIVOCADA. `viajes[i-1]`
//    con `hoja_idx` igual encadena por el orden en que se escanearon los
//    papeles. Lo correcto es encadenar por TRACTORA: el odometro es del camion,
//    no de la hoja ni del chofer. Dos fichas de chóferes distintos sobre el
//    MISMO camion tienen que encadenar (hoy no lo hacen), y dos bloques de
//    camiones distintos no deben encadenar jamas (hoy, si el escaneo los deja
//    contiguos dentro de una hoja mal agrupada, se restan odometros de dos
//    camiones y sale un numero absurdo con pinta de valido).
//
// LA SOLUCION
//
// A) La cadena es POR TRACTORA. Se agrupan los viajes por matricula resuelta
//    (tractoraN, ya cotejada contra el padron de flota) y dentro de cada
//    tractora se ordenan por ODOMETRO, no por posicion ni por fecha: el
//    odometro es monotono creciente por construccion y no depende de que la
//    fecha manuscrita se haya leido bien.
//
// B) La cadena ARRANCA en el ultimo odometro conocido de esa tractora, leido de
//    la tabla Viajes. Asi el primer viaje de la ficha tambien tiene vacios.
//
// C) Se devuelve el ultimo odometro POR TRACTORA para volver a persistirlo. Ese
//    es el "registro de ultimo KM por viaje" del encargo: se actualiza con cada
//    viaje ingestado, no una vez por ficha.
//
// D) GUARDAS. Un salto negativo o desmedido no se escribe en silencio:
//    - negativo  -> falta un viaje intermedio (o el odometro se leyo mal)
//    - > MAX_VACIOS_KM -> hay viajes sin registrar en el medio
//    - la tractora del padron no coincide -> no se encadena, se avisa
//    En los tres casos km_vacios queda null y el viaje va a REVISAR con motivo.
//    Un km vacio inventado se factura; un null se revisa.
//
// Logica PURA (sin n8n): el padron de ultimos odometros se inyecta.

'use strict';

// Salto maximo plausible entre la descarga de un viaje y la carga del siguiente.
// Un retorno largo en vacio (Huelva -> Galicia) ronda los 900 km. Por encima de
// 1.500 lo mas probable es que falten viajes sin registrar en el medio, no que
// el camion haya hecho ese vacio.
var MAX_VACIOS_KM = 1500;

function num(x) {
  if (x === null || x === undefined || x === '') { return null; }
  var n = Number(x);
  return isFinite(n) ? n : null;
}

/**
 * Padron de ultimos odometros a partir de las filas ya existentes en la tabla
 * Viajes. Por tractora se queda con el km_final MAS ALTO: el odometro solo
 * crece, asi que el maximo es el ultimo, sin depender de fechas ni del orden en
 * que la tabla devuelva las filas.
 *
 * @param {Array<object>} filasViajes  filas de la tabla Viajes
 * @returns {object} { matricula: {km_final, fecha, viaje_id} }
 */
function ultimosOdometros(filasViajes) {
  var filas = Array.isArray(filasViajes) ? filasViajes : [];
  var out = {};
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i] || {};
    var mat = String(f.matricula_tractora || f.tractoraN || f.tractora || '').trim().toUpperCase();
    var kmF = num(f.km_final);
    if (!mat || kmF === null) { continue; }
    if (!out[mat] || kmF > out[mat].km_final) {
      out[mat] = {
        km_final: kmF,
        fecha: String(f.fecha_carga || f.fecha || ''),
        viaje_id: f.id || f.viaje_id || null
      };
    }
  }
  return out;
}

/**
 * Calcula km_vacios encadenando por TRACTORA, arrancando en el ultimo odometro
 * conocido de cada una. Muta los viajes (les escribe km_vacios, origen_km_vacios
 * y, si corresponde, el motivo de revision) y devuelve el padron actualizado.
 *
 * @param {Array<object>} viajes  viajes del lote, con {tractoraN, km_inicio, km_final}
 * @param {object} [previos]  el de ultimosOdometros(); ausente = solo el lote
 * @param {function} [marcar]  (viaje, motivo) para mandar a REVISAR
 * @returns {{ultimos:object, avisos:Array<string>, encadenados:number}}
 */
function encadenarPorTractora(viajes, previos, marcar) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var avisos = [];
  var ultimos = {};
  var encadenados = 0;
  var nota = function (v, msg) { avisos.push(msg); if (typeof marcar === 'function') { marcar(v, msg); } };

  // Arrancar del padron previo (copia: no se muta lo que nos pasaron).
  if (previos) {
    for (var k in previos) {
      if (Object.prototype.hasOwnProperty.call(previos, k)) {
        ultimos[k] = { km_final: previos[k].km_final, fecha: previos[k].fecha, viaje_id: previos[k].viaje_id, origen: 'tabla' };
      }
    }
  }

  // Agrupar por tractora resuelta. Sin matricula no hay cadena posible: el
  // odometro no se puede atribuir a ningun camion.
  var porTractora = {};
  var sinMatricula = [];
  for (var i = 0; i < lista.length; i++) {
    var v = lista[i];
    v.km_vacios = null;
    v.origen_km_vacios = null;
    var mat = String(v.tractoraN || '').trim().toUpperCase();
    if (!mat) { sinMatricula.push(v); continue; }
    if (!porTractora[mat]) { porTractora[mat] = []; }
    porTractora[mat].push(v);
  }
  for (var s = 0; s < sinMatricula.length; s++) {
    sinMatricula[s].origen_km_vacios = 'sin_matricula';
  }

  for (var mt in porTractora) {
    if (!Object.prototype.hasOwnProperty.call(porTractora, mt)) { continue; }
    // Orden por ODOMETRO: monotono por construccion, no depende de que la fecha
    // manuscrita se haya leido bien. Los que no traen km_inicio van al final y
    // no participan de la cadena (no se puede saber donde encajan).
    var grupo = porTractora[mt].slice().sort(function (a, b) {
      var ka = num(a.km_inicio), kb = num(b.km_inicio);
      if (ka === null && kb === null) { return 0; }
      if (ka === null) { return 1; }
      if (kb === null) { return -1; }
      return ka - kb;
    });

    var anterior = ultimos[mt] ? ultimos[mt].km_final : null;
    var origenAnterior = ultimos[mt] ? 'tabla' : null;

    for (var j = 0; j < grupo.length; j++) {
      var vv = grupo[j];
      var ini = num(vv.km_inicio);
      var fin = num(vv.km_final);

      if (ini === null) {
        vv.origen_km_vacios = 'sin_km_inicio';
      } else if (anterior === null) {
        // Primer viaje conocido de esta tractora: no hay de donde venia. No es
        // un error, es que falta historia.
        vv.origen_km_vacios = 'sin_odometro_previo';
      } else {
        var vac = ini - anterior;
        if (vac < 0) {
          nota(vv, 'km vacios negativos (' + mt + ': odometro previo ' + anterior +
            ' > km inicio ' + ini + '): falta un viaje intermedio o el odometro se leyo mal');
          vv.origen_km_vacios = 'negativo';
        } else if (vac > MAX_VACIOS_KM) {
          nota(vv, 'km vacios ' + vac + ' para ' + mt + ' supera los ' + MAX_VACIOS_KM +
            ' km plausibles: probablemente hay viajes sin registrar en el medio');
          vv.origen_km_vacios = 'salto_excesivo';
        } else {
          vv.km_vacios = vac;
          vv.origen_km_vacios = (origenAnterior === 'tabla') ? 'cadena_tabla' : 'cadena_lote';
          encadenados++;
        }
      }

      // El odometro avanza aunque el vacio no se haya podido calcular: lo que
      // importa para el siguiente eslabon es donde quedo el camion.
      if (fin !== null && (anterior === null || fin > anterior)) {
        anterior = fin;
        origenAnterior = 'lote';
        ultimos[mt] = { km_final: fin, fecha: String(vv.fecha_carga || ''), viaje_id: vv.id || null, origen: 'lote' };
      }
    }
  }

  return { ultimos: ultimos, avisos: avisos, encadenados: encadenados };
}

/**
 * Padron listo para persistir: una fila por tractora con su ultimo odometro.
 * Es el "registro de ultimo KM por tractora" del encargo — se actualiza con cada
 * viaje ingestado, no una vez por ficha.
 *
 * @param {object} ultimos  el que devuelve encadenarPorTractora()
 * @returns {Array<object>} [{matricula_tractora, km_final, fecha_carga, viaje_id, origen}]
 */
function filasUltimoOdometro(ultimos) {
  var out = [];
  if (!ultimos) { return out; }
  for (var mat in ultimos) {
    if (!Object.prototype.hasOwnProperty.call(ultimos, mat)) { continue; }
    var u = ultimos[mat];
    out.push({
      matricula_tractora: mat,
      km_final: u.km_final,
      fecha_carga: u.fecha || '',
      viaje_id: u.viaje_id || null,
      origen: u.origen || 'lote'
    });
  }
  out.sort(function (a, b) { return a.matricula_tractora.localeCompare(b.matricula_tractora); });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAX_VACIOS_KM: MAX_VACIOS_KM,
    ultimosOdometros: ultimosOdometros,
    encadenarPorTractora: encadenarPorTractora,
    filasUltimoOdometro: filasUltimoOdometro
  };
}
