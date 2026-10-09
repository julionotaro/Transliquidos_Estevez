// ===== REGIMEN DE INDEXACION — se decide por el PAIS DEL CLIENTE ==============
//
// REGLA (Julio, ya acordada y re-confirmada 2026-08-25): el regimen NO depende
// del destino del viaje, sino del PAIS DE LA EMPRESA CLIENTE.
//   G    portes nacionales (cliente espanol)
//   GPT  portes internacionales (cliente portugues)
//   G1Q / G2Q  indexacion de gasoleo por QUINCENA (1ª / 2ª), para los clientes
//              que facturan por periodo en vez de por linea.
//
// VERIFICADO sobre el historico completo (8.755 lineas). El reparto es limpio:
//   BRESFOR IND. DO FORMOL      -> GPT 165/165 (100%)
//   RNM TRANSPORTES QUIMICOS LDA-> GPT  66/66  (100%)
//   QUIMIDROGA PORTUGAL, LDA    -> GPT   2/2
//   LIQUIADUBOS, LDA            -> GPT   2/2
//   QUIMIDROGA, S.A.            -> G   110/110 (100%)
//   BALTRANSA / HELM / TRANSTAMBRE / Q. DEL JARAMA / CLAVO FOOD -> G
//   FORESA, S.A.                -> G 165, G1Q 35, G2Q 33  (factura por quincena
//                                  en parte de sus viajes)
// Un viaje de RNM a Navia (Espana) sigue siendo GPT: manda el cliente, no la ruta.
//
// FUENTE PRIMARIA: el propio historico (que regimen se le aplico a ese cliente).
// FALLBACK para un cliente nuevo sin historico: la forma societaria de la razon
// social — LDA / UNIPESSOAL / S.A. portuguesa -> PT; S.A. / S.L. / SAU / SLU -> ES.

'use strict';

var SUFIJOS_PT = /\b(LDA|UNIPESSOAL|S\.?A\.?U?\s*$)/i;
var MARCAS_PT = /\b(LDA|UNIPESSOAL|PORTUGAL|PORTUGUESA)\b/i;

/**
 * Construye el mapa cliente -> regimen a partir del historico.
 * @param {Array<object>} lineas  filas del export con {cliente, codcon}
 * @returns {object} { codigoCliente: {G:n, GPT:n, G1Q:n, G2Q:n, predominante:'G'|'GPT'} }
 */
function regimenPorHistorico(lineas) {
  var CONT = {}, REG = { 'G': 1, 'GPT': 1, 'G1Q': 1, 'G2Q': 1 };
  for (var i = 0; i < (lineas || []).length; i++) {
    var L = lineas[i] || {};
    var c = String(L.cliente || '').trim();
    var k = String(L.codcon || L.concepto || '').toUpperCase();
    if (!c || !REG[k]) { continue; }
    if (!CONT[c]) { CONT[c] = { G: 0, GPT: 0, G1Q: 0, G2Q: 0 }; }
    CONT[c][k]++;
  }
  var out = {};
  for (var cli in CONT) {
    if (!Object.prototype.hasOwnProperty.call(CONT, cli)) { continue; }
    var v = CONT[cli];
    // El eje pais es G vs GPT; las quincenas son una modalidad DENTRO de G.
    var nacional = v.G + v.G1Q + v.G2Q;
    out[cli] = {
      G: v.G, GPT: v.GPT, G1Q: v.G1Q, G2Q: v.G2Q,
      predominante: (v.GPT > nacional) ? 'GPT' : 'G',
      porQuincena: (v.G1Q + v.G2Q) > 0
    };
  }
  return out;
}

/**
 * Regimen de un viaje. Manda el historico del cliente; si no hay, la razon social.
 * @param {{codigoCliente,razonSocial}} cliente
 * @param {object} [mapa] el de regimenPorHistorico()
 * @returns {{regimen:string|null, fuente:string, revisar:boolean, motivo:string, porQuincena:boolean}}
 */
function regimenDeCliente(cliente, mapa) {
  var cod = String((cliente && cliente.codigoCliente) || '').trim();
  var rs = String((cliente && cliente.razonSocial) || '');
  if (mapa && cod && mapa[cod]) {
    var m = mapa[cod];
    return {
      regimen: m.predominante, fuente: 'historico', revisar: false, porQuincena: !!m.porQuincena,
      motivo: m.porQuincena
        ? 'el cliente tiene tambien viajes indexados por quincena (G1Q/G2Q): confirmar si esta factura va por linea o por periodo'
        : ''
    };
  }
  if (!rs) {
    return { regimen: null, fuente: 'ninguna', revisar: true, porQuincena: false,
      motivo: 'sin cliente resuelto no se puede fijar el regimen de indexacion' };
  }
  var esPT = MARCAS_PT.test(rs);
  return {
    regimen: esPT ? 'GPT' : 'G', fuente: 'razon_social', revisar: true, porQuincena: false,
    motivo: 'cliente sin historico: regimen deducido de la razon social "' + rs + '" (' +
      (esPT ? 'portuguesa -> GPT' : 'espanola -> G') + ') — verificar'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { regimenPorHistorico: regimenPorHistorico, regimenDeCliente: regimenDeCliente, SUFIJOS_PT: SUFIJOS_PT };
}
