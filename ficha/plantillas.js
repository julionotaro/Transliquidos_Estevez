// ===== PLANTILLAS POR CLIENTE — de documentacion a produccion ================
//
// POR QUE EXISTE ESTE ARCHIVO. catalogo/plantillas-cliente.json guarda, cliente
// por cliente y documento por documento, DONDE esta cada campo: la etiqueta
// impresa exacta, la casilla, el formato, y —lo que mas vale— que numeros
// PARECEN el dato bueno y no lo son. Todo eso lo confirmo Julio entre el 28 y el
// 31/08/2026 contra documentos reales.
//
// Pero un JSON que nadie lee es un documento, no un sistema. Este modulo es el
// que lo pone a trabajar, en dos sitios:
//
//   1. promptDeCliente()  -> el trozo de prompt que le dice al modelo, para ESE
//      emisor, que ancla mirar y que ignorar. Sustituye al "extrae los datos
//      clave", que es lo que hacia que eligiera mal entre cinco numeros.
//
//   2. verificarReferencia() -> la guarda que corre DESPUES de leer. Comprueba
//      que lo extraido cumple el formato del emisor y, sobre todo, que NO es uno
//      de los numeros marcados como trampa. Esto no depende del modelo: es
//      codigo, y por eso es lo que de verdad sostiene el resultado.
//
// EL PRINCIPIO, que salio de mirar los documentos y no de suponerlo: la
// referencia NO se extrae por FORMATO —varia: 6 digitos, 7, 10, guia remessa, o
// ninguno— sino por la ETIQUETA ANCLA que la precede, que si es estable por
// emisor. Y el ancla pertenece al EMISOR, no al tipo de documento: FORESA y
// BRESFOR emiten papeles casi identicos y su regla es la OPUESTA (Foresa el 2o
// numero de 7 digitos, Bresfor el 1o de 10). Por eso todo aca se indexa por
// emisor, nunca por "es un CMR".
//
// Logica PURA: las plantillas se inyectan, este modulo no lee archivos.

'use strict';

var PL_TC = (typeof clienteCoincide === 'function')
  ? { clienteCoincide: clienteCoincide }
  : require('./tarifa-contractual.js');

function txt(s) { return (s === null || s === undefined) ? '' : String(s); }

function soloDigitos(s) { return txt(s).replace(/[^0-9]/g, ''); }

/**
 * La plantilla que aplica a un emisor. Se busca por nombre de cliente con el
 * mismo puente corto<->razon social que usa la tarifa, porque el documento dice
 * "FORESA" y la plantilla guarda "FORESA IND. QUIMICAS DEL NOROESTE SA".
 */
function plantillaDe(cliente, plantillas) {
  var lista = (plantillas && plantillas.plantillas) ? plantillas.plantillas
            : (Array.isArray(plantillas) ? plantillas : []);
  if (!txt(cliente)) { return null; }
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    if (PL_TC.clienteCoincide(cliente, p.cliente) ||
        PL_TC.clienteCoincide(cliente, p.razon_social_impresa || '')) {
      return p;
    }
  }
  return null;
}

/**
 * El trozo de prompt para ESE emisor: donde mirar cada campo y que ignorar.
 *
 * La seccion "NO CONFUNDIR" no es un adorno: en los documentos observados hay
 * entre tres y cinco numeros que compiten con la referencia (pedido, ref. del
 * comprador, albaran interno, referencia de la terminal). Decir cual NO es vale
 * tanto como decir cual SI.
 */
function promptDeCliente(cliente, plantillas) {
  var p = plantillaDe(cliente, plantillas);
  if (!p) { return ''; }
  var L = ['REGLAS DE EXTRACCION PARA ' + p.cliente + ' (confirmadas con documentos reales):'];

  for (var i = 0; i < (p.documentos || []).length; i++) {
    var doc = p.documentos[i];
    L.push('');
    L.push('DOCUMENTO: ' + doc.tipo + (doc.titulos ? ' — se reconoce por: ' + doc.titulos.join(' / ') : ''));
    if (doc._forma) { L.push('  (' + doc._forma + ')'); }

    var campos = doc.campos || {};
    for (var campo in campos) {
      if (!Object.prototype.hasOwnProperty.call(campos, campo)) { continue; }
      var c = campos[campo];
      if (!c || !c.donde) { continue; }
      L.push('  - ' + campo + ': ' + c.donde);
      if (c.fuente_habitual) { L.push('      lo normal es que salga de: ' + c.fuente_habitual); }
      if (c.formato) { L.push('      formato: ' + c.formato); }
      var ej = c.ejemplos_verificados || c.ejemplos || (c.ejemplo ? [c.ejemplo] : null);
      if (ej && ej.length) { L.push('      ejemplos reales: ' + ej.join(' | ')); }
      if (c._no_confundir) { L.push('      OJO: ' + c._no_confundir); }
    }
    if ((doc.ignorar || []).length) {
      L.push('  NO CONFUNDIR — esto PARECE el dato correcto y NO lo es:');
      for (var j = 0; j < doc.ignorar.length; j++) { L.push('    * ' + doc.ignorar[j]); }
    }
  }
  return L.join('\n');
}

/**
 * Guarda de la referencia: corre DESPUES de leer, y no depende del modelo.
 *
 * Dos comprobaciones, y la segunda es la que ataja el error caro:
 *   a) el formato declarado del emisor (si la plantilla lo declara)
 *   b) que el valor NO coincida con ninguno de los numeros que la plantilla
 *      marco como trampa. Un numero de pedido tiene formato de numero y pasa
 *      cualquier validacion de forma; solo se lo caza comparandolo con el resto
 *      de numeros del documento.
 *
 * @param {string} valor       lo que se extrajo como referencia
 * @param {string} cliente     emisor resuelto
 * @param {object} plantillas  catalogo/plantillas-cliente.json
 * @param {object} [otros]     otros numeros leidos del documento, por nombre de
 *                             campo: {pedido_cliente:'...', n_albaran:'...'}
 * @returns {{ok, revisar, motivo}}
 */
function verificarReferencia(valor, cliente, plantillas, otros) {
  var v = soloDigitos(valor);
  if (!v) {
    return { ok: false, revisar: true, motivo: 'referencia vacia' };
  }
  var p = plantillaDe(cliente, plantillas);
  if (!p) {
    return { ok: true, revisar: false, motivo: 'sin plantilla para "' + txt(cliente) + '": no se puede verificar el formato' };
  }

  var campo = null;
  for (var i = 0; i < (p.documentos || []).length; i++) {
    var c = (p.documentos[i].campos || {}).referencia;
    if (c) { campo = c; break; }
  }
  if (!campo) { return { ok: true, revisar: false, motivo: '' }; }

  // (b) primero: chocar con otro numero del documento es mas grave que un
  // formato raro, porque produce un dato lleno, valido y equivocado.
  var o = otros || {};
  for (var k in o) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) { continue; }
    if (k === 'referencia') { continue; }
    if (soloDigitos(o[k]) && soloDigitos(o[k]) === v) {
      return { ok: false, revisar: true,
        motivo: 'la referencia leida (' + v + ') es la MISMA que el campo "' + k +
                '" del documento: es muy probable que se haya tomado el numero equivocado' };
    }
  }

  // (a) formato declarado: se comprueba el largo, que es lo unico que las
  // plantillas afirman con certeza ("7 digitos", "10 digitos").
  var m = /(\d+)\s*digitos/i.exec(txt(campo.formato));
  if (m) {
    var esperado = Number(m[1]);
    if (v.length !== esperado) {
      return { ok: false, revisar: true,
        motivo: 'la referencia de ' + p.cliente + ' debe tener ' + esperado + ' digitos y "' +
                v + '" tiene ' + v.length + (campo._no_confundir ? '. ' + campo._no_confundir : '') };
    }
  }
  return { ok: true, revisar: false, motivo: '' };
}

/**
 * Palabras-ancla de la regla de referencia: las frases entrecomilladas de
 * `campo.donde` ('Referencia en factura:', 'Numero/Number', 'Doc. int:'...).
 * Sirven para elegir por etiqueta cuando el formato no alcanza (QUIMIDROGA).
 */
function anclasDeReferencia(campo) {
  var d = txt(campo && campo.donde);
  var out = [], re = /'([^']+)'/g, m;
  while ((m = re.exec(d)) !== null) {
    var frase = m[1].replace(/[^0-9a-zA-ZáéíóúñÁÉÍÓÚÑ ]/g, '').trim().toUpperCase();
    if (frase.length >= 3) { out.push(frase); }
  }
  return out;
}

function _sinAcentos(s) {
  return txt(s).toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N');
}

/** ¿La etiqueta del numero leido contiene alguna de las anclas de la regla? */
function etiquetaCoincide(etiqueta, anclas) {
  var e = _sinAcentos(etiqueta);
  for (var i = 0; i < anclas.length; i++) {
    var a = _sinAcentos(anclas[i]);
    if (a && e.indexOf(a) >= 0) { return true; }
  }
  return false;
}

/**
 * Elige la referencia POR REGLA, no por la intuicion del modelo.
 *
 * El extractor ya no decide cual de los numeros del documento es la referencia:
 * transcribe TODOS con su etiqueta (doc.numeros = [{etiqueta, valor}]), y esta
 * funcion aplica la regla de la plantilla del emisor —el formato y, si el formato
 * no alcanza, el ancla—. Es la raiz del problema de la corrida 1172: el numero
 * correcto (FORESA 2017843, 7 digitos) ni siquiera lo elegia GPT, que devolvia el
 * albaran interno (492789) o el numero del CMR de RNM (5050139934, 10 digitos que
 * NO empiezan en 0). Con la regla aplicada en codigo, esos quedan descartados.
 *
 * Si la regla no deja UN solo candidato, se cae a la referencia del modelo y se
 * marca revisar: nunca se inventa ni se elige a dedo entre empatados.
 *
 * @param {string} cliente     emisor resuelto
 * @param {Array}  numeros     [{etiqueta, valor}] transcritos del documento
 * @param {object} plantillas  catalogo/plantillas-cliente.json
 * @param {string} [refModelo] la referencia que devolvio el modelo (respaldo)
 * @returns {{valor:string|null, fuente:string, revisar:boolean, motivo:string}}
 */
function elegirReferencia(cliente, numeros, plantillas, refModelo) {
  var respaldo = soloDigitos(refModelo) || null;
  var p = plantillaDe(cliente, plantillas);
  if (!p) {
    return { valor: respaldo, fuente: 'modelo', revisar: false,
             motivo: 'sin plantilla para "' + txt(cliente) + '": se usa la referencia del modelo' };
  }
  var campo = null;
  for (var i = 0; i < (p.documentos || []).length; i++) {
    var c = (p.documentos[i].campos || {}).referencia;
    if (c) { campo = c; break; }
  }
  if (!campo) { return { valor: respaldo, fuente: 'modelo', revisar: false, motivo: '' }; }

  var cands = [];
  var lista = Array.isArray(numeros) ? numeros : [];
  for (var j = 0; j < lista.length; j++) {
    var val = soloDigitos(lista[j] && lista[j].valor);
    if (val) { cands.push({ valor: val, etiqueta: txt(lista[j] && lista[j].etiqueta) }); }
  }
  if (!cands.length) {
    return { valor: respaldo, fuente: 'modelo', revisar: (respaldo ? true : true),
             motivo: 'el documento no transcribio numeros con etiqueta; se usa la referencia del modelo para revisar' };
  }

  // 1) Por FORMATO cuando la plantilla lo afirma (FORESA 7, BRESFOR 10, RNM 10+0).
  var mLen = /(\d+)\s*digitos/i.exec(txt(campo.formato));
  var largo = mLen ? Number(mLen[1]) : null;
  var empiezaEn0 = /empiez\w*\s+en\s+0/i.test(txt(campo.formato));
  if (largo) {
    var porFormato = cands.filter(function (c) {
      return c.valor.length === largo && (!empiezaEn0 || c.valor.charAt(0) === '0');
    });
    if (porFormato.length === 1) {
      return { valor: porFormato[0].valor, fuente: 'plantilla:formato', revisar: false, motivo: '' };
    }
    if (porFormato.length > 1) {
      // El formato no desempata: probar el ancla dentro de los que cumplen formato.
      var anclasF = anclasDeReferencia(campo);
      var porAmbos = porFormato.filter(function (c) { return etiquetaCoincide(c.etiqueta, anclasF); });
      if (porAmbos.length === 1) {
        return { valor: porAmbos[0].valor, fuente: 'plantilla:formato+ancla', revisar: false, motivo: '' };
      }
      return { valor: respaldo, fuente: 'modelo', revisar: true,
               motivo: 'varios numeros de ' + p.cliente + ' cumplen el formato (' + porFormato.map(function(c){return c.valor;}).join(', ') + '); no se puede elegir por regla — revisar' };
    }
    // Ninguno cumple el formato: el modelo no capturo el numero bueno.
    return { valor: respaldo, fuente: 'modelo', revisar: true,
             motivo: 'ningun numero transcrito cumple el formato de ' + p.cliente + ' (' + largo + ' digitos' + (empiezaEn0 ? ' que empiezan en 0' : '') + '); leidos: ' + cands.map(function(c){return c.valor;}).join(', ') + ' — revisar' };
  }

  // 2) Formato VARIABLE (QUIMIDROGA): elegir por ANCLA de etiqueta.
  var anclas = anclasDeReferencia(campo);
  if (anclas.length) {
    var porAncla = cands.filter(function (c) { return etiquetaCoincide(c.etiqueta, anclas); });
    if (porAncla.length === 1) {
      return { valor: porAncla[0].valor, fuente: 'plantilla:ancla', revisar: false, motivo: '' };
    }
    if (porAncla.length > 1) {
      return { valor: respaldo, fuente: 'modelo', revisar: true,
               motivo: 'varios numeros de ' + p.cliente + ' caen bajo el ancla; no se puede elegir — revisar' };
    }
  }
  return { valor: respaldo, fuente: 'modelo', revisar: true,
           motivo: 'no se pudo elegir la referencia de ' + p.cliente + ' por regla; se deja la del modelo para revisar' };
}

/**
 * De donde debe salir un campo segun la tabla que dio Julio: del documento, de
 * la ficha del chofer, de una tabla de Gesruta, o de un calculo.
 *
 * Sirve para no ir a buscar al documento algo que manda la ficha. El caso claro
 * es la FECHA DE CARGA: esta impresa en todos los documentos y aun asi manda la
 * ficha (regla R-01, reconfirmada por Julio el 31/08 para todos los clientes).
 */
function fuenteDelCampo(campo, cliente, plantillas) {
  var p = plantillaDe(cliente, plantillas);
  var mapa = p && p._mapa_campo_fuente_de_julio;
  if (!mapa || !Object.prototype.hasOwnProperty.call(mapa, campo)) { return null; }
  var v = txt(mapa[campo]);
  var n = v.toUpperCase();
  var origen = 'documento';
  if (n.indexOf('FICHA') >= 0) { origen = 'ficha'; }
  else if (n.indexOf('GESRUTA') >= 0) { origen = 'tabla_gesruta'; }
  else if (n.indexOf('CALCULO') >= 0 || n.indexOf('SISTEMA') >= 0) { origen = 'calculo'; }
  else if (n.indexOf('PENDIENTE') >= 0) { origen = 'pendiente'; }
  return { origen: origen, literal: v };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    plantillaDe: plantillaDe,
    promptDeCliente: promptDeCliente,
    verificarReferencia: verificarReferencia,
    elegirReferencia: elegirReferencia,
    anclasDeReferencia: anclasDeReferencia,
    etiquetaCoincide: etiquetaCoincide,
    fuenteDelCampo: fuenteDelCampo,
  };
}
