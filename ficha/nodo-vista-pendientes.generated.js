// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/cruce.js + ficha/../catalogo/gesruta.js + ficha/../catalogo/resolver-punto.js + ficha/../catalogo/clientes-gesruta.js + ficha/validaciones-forma.js + ficha/pendientes.js + ficha/nodo-vista-pendientes.wrapper.js
// Contenido exacto del nodo Code "Pendientes" ([ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)).

// ===== CRUCE FICHA<->DOCUMENTO — reglas del modelo "albaran = unidad facturable" =====
//
// Fase 2 (encargo 2026-08-01). Corrige el supuesto "1 bloque de ficha = 1 viaje".
//
//   El albaran (o documento de origen equivalente) es la unidad FACTURABLE.
//   El bloque de la ficha es la DECLARACION del chofer sobre su jornada.
//   Un bloque puede representar N viajes; quien define N son los documentos.
//
// Este modulo aisla las piezas CONFIGURABLES y las funciones PURAS del cruce, para
// que no queden hardcodeadas en el medio de correlacionar.js y sean testeables
// solas. La logica de expansion/consolidacion que las usa vive en correlacionar.js.
//
// ESTRUCTURA confirmada contra dato real (encargo v1.1 2026-08-03): la
// exportacion del sistema de escritorio (expediente 00050461, CALDAS DE
// REIS->OREMBER) trae exactamente este patron -- 3 viajes Nº 01/02/03, cada uno
// con su propia referencia e importe, mismo cabeza/remolque. El modelo
// bloque=N viajes ya NO esta "no verificado" a nivel de dominio.
//
// Lo que SIGUE sin probar es la LECTURA: no hay todavia una ficha manuscrita
// real de un bloque multi-viaje para confirmar que gpt-4o lee bien `cantidad=3`
// en el campo de la ficha (riesgo de OCR, distinto del riesgo de estructura que
// ya se cerro). Cuando aparezca esa ficha escaneada, es la primera corrida a
// hacer. Ver docs/fase2-cierre-y-fase3-bloqueantes.md.

'use strict';

// --- RUTAS_MULTIVIAJE: lista configurable, facil de ampliar ------------------
// Cada entrada es una ruta (cliente, origen, destino) donde el chofer escribe en
// el campo `cantidad` de la ficha el NUMERO DE VIAJES, no los kg. Arranca con la
// unica confirmada (FORESA Villagarcia -> Caldas de Reis, metanol). Para sumar
// una ruta: agregar un objeto aca, NO tocar la logica.
var RUTAS_MULTIVIAJE = [
  { cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS' },
];

// Red de seguridad: los pesos SIEMPRE van en miles de kg. Un valor de uno o dos
// digitos es imposible como peso -> probable numero de viajes de una ruta que
// todavia no esta en RUTAS_MULTIVIAJE. En vez de meter "4 kg" en silencio, se
// manda a REVISAR para que aparezca en el tablero. Cuando se confirme la ruta,
// se agrega arriba y deja de preguntar.
var UMBRAL_CANTIDAD_KG = 100;

// --- Normalizacion de texto para el match de rutas ---------------------------
// La ficha escribe "Villagarcía"/"VILLAGARCIA", "Caldas"/"Caldas de Reis". Se
// compara sin acentos, en mayusculas y por inclusion en ambos sentidos, para que
// "CALDAS" matchee "CALDAS DE REIS" sin volverse laxo (no matchea vacios).
function quitarAcentos(s) {
  return (s === null || s === undefined ? '' : String(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) {
  return quitarAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim();
}
function coincideTexto(valorFicha, valorRuta) {
  var a = norm(valorFicha);
  var b = norm(valorRuta);
  if (!a || !b) { return false; }
  return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/**
 * ¿La terna (cliente, origen, destino) de la ficha es una ruta multi-viaje?
 * @returns {object|null} la entrada de RUTAS_MULTIVIAJE que coincide, o null.
 */
function esRutaMultiviaje(cliente, origen, destino, rutas) {
  var lista = Array.isArray(rutas) ? rutas : RUTAS_MULTIVIAJE;
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    if (coincideTexto(cliente, r.cliente) && coincideTexto(origen, r.origen) && coincideTexto(destino, r.destino)) {
      return r;
    }
  }
  return null;
}

/**
 * Regla determinista del §1: decide si `cantidad` de la ficha son kg o numero de
 * viajes. NO adivina: o la ruta esta registrada, o la red de seguridad la manda
 * a REVISAR.
 *
 * @param {number|null} cantidad  el valor leido del campo cantidad de la ficha.
 * @returns {{modo:'viajes'|'kg'|'revisar', n_viajes:number|null, kg:number|null,
 *            motivo:string|null, ruta:object|null}}
 */
function clasificarCantidad(cantidad, cliente, origen, destino, rutas) {
  var ruta = esRutaMultiviaje(cliente, origen, destino, rutas);
  var c = (typeof cantidad === 'number' && isFinite(cantidad)) ? cantidad : null;
  if (ruta) {
    // Ruta multi-viaje: cantidad = numero de viajes. Si no se leyo, el caller lo
    // manda a REVISAR (no se puede expandir sin saber cuantos).
    return { modo: 'viajes', n_viajes: (c && c > 0) ? c : null, kg: null, motivo: null, ruta: ruta };
  }
  if (c !== null && c < UMBRAL_CANTIDAD_KG) {
    return { modo: 'revisar', n_viajes: 1, kg: null, motivo: 'posible_multiviaje_ruta_no_registrada', ruta: null };
  }
  return { modo: 'kg', n_viajes: 1, kg: c, motivo: null, ruta: null };
}

// --- CLIENTES_CONOCIDOS: lista configurable, unico lugar (Cierre v1, pieza 1) -
// Un cliente leido fuera de esta lista NUNCA recibe regimen por defecto: eso fue
// el bug real (gpt-4o leyo "FORBA" -- misread de FORESA -- y el sistema le asigno
// 'linea' en silencio, cuando por D-06 le tocaba 'agregada_quincenal'). La solucion
// NO es un alias de FORBA: un alias por cada misread convierte un error de lectura
// en regla de negocio, y manana aparece "FORESAA" o "FORFSA". Un cliente fuera de
// esta lista falla RUIDOSO (REVISAR con el valor leido en el motivo), nunca en
// silencio. Para sumar un cliente real nuevo: agregarlo aca, nada mas.
var CLIENTES_CONOCIDOS = ['FORESA', 'BRESFOR', 'QUIMIDROGA', 'RNM', 'HELM', 'BALTRANSA'];

/** ¿El cliente leido esta en la lista de clientes conocidos? */
function esClienteConocido(cliente, clientes) {
  var lista = Array.isArray(clientes) ? clientes : CLIENTES_CONOCIDOS;
  var cl = norm(cliente);
  if (!cl) { return false; }
  for (var i = 0; i < lista.length; i++) {
    if (cl.indexOf(norm(lista[i])) >= 0) { return true; }
  }
  return false;
}

/**
 * Regimen de indexacion (suplemento gasoleo) por cliente + ruta (D-03 y D-06).
 * NO calcula la indexacion — solo marca el regimen; el calculo se cierra en la
 * facturacion (D-03, encargo §8 fuera de alcance). Routing de dominio, tabla
 * configurable como RUTAS_MULTIVIAJE.
 *
 *   incluida            Baltransa: la tarifa ya la contiene, no se agrega.
 *   agregada_mensual    FORESA Villagarcia -> Caldas (metanol): un total por mes.
 *   agregada_quincenal  FORESA Caldas de Reis -> Ourense (Orember): total quincenal.
 *   linea               caso general (FORESA otros destinos, Quimidroga, RNM...).
 *
 * Cliente fuera de CLIENTES_CONOCIDOS (o no leido): NO se asigna regimen por
 * defecto. Devuelve motivo para que el caller marque el viaje REVISAR con el
 * valor leido visible (Cierre v1, pieza 1) — el error de lectura no debe
 * disfrazarse de decision de negocio.
 *
 * @returns {{regimen: 'incluida'|'agregada_mensual'|'agregada_quincenal'|'linea'|null,
 *            motivo: string|null}}
 */
function regimenIndexacion(cliente, origen, destino, clientes, modalidad) {
  if (!esClienteConocido(cliente, clientes)) {
    return { regimen: null, motivo: 'cliente_no_reconocido: ' + (nz_local(cliente) || '(no se leyo)') };
  }
  // EVIDENCIA PRIMERO. Si se inyecto la modalidad deducida del historico
  // (ficha/modalidad-indexacion.js), manda esa: dice como se le facturo REALMENTE
  // la indexacion a este cliente, en vez de adivinarlo por la ruta. Las reglas de
  // ruta de abajo quedan como respaldo para cuando no hay historico cargado.
  //   'sin_indexacion' se propaga tal cual: es una respuesta valida (hay clientes
  //     cuya factura no lleva indexacion) y hasta ahora se perdia bajo el default.
  //   'agregada' sin distinguir quincenal/mensual tambien se propaga: el corte
  //     real lo dan los tramos de pct, no el calendario (ver modalidad-indexacion).
  //   modalidad null (cliente que factura de las dos formas, o sin evidencia) NO
  //     cae al default: devuelve null + motivo para que el viaje vaya a REVISAR.
  var cl = norm(cliente);
  var esForesa = cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0;

  // FORESA es el unico cliente MIXTO: parte de sus servicios se indexa por viaje
  // y parte agregado. Eso NO se resuelve por cliente, se resuelve por RUTA, con
  // las reglas confirmadas por Julio y verificadas sobre el CSV (cobertura de
  // linea por ruta): Metanol Villagarcia->Caldas = agregada mensual; destino
  // Orember = agregada quincenal; el resto (Foresa otros, Villagarcia otros,
  // Retornos) = por linea. Por eso, para Foresa, la ruta manda AUN cuando el
  // historico dijo 'mixta' — si dijera 'linea' o 'agregada' a secas seria una
  // media del cliente, no la del servicio.
  if (esForesa) {
    if (coincideTexto(origen, 'VILLAGARCIA') && coincideTexto(destino, 'CALDAS')) {
      return { regimen: 'agregada_mensual', motivo: null };
    }
    if (coincideTexto(destino, 'OREMBER')) {
      return { regimen: 'agregada_quincenal', motivo: null };
    }
    if (coincideTexto(origen, 'CALDAS') && (coincideTexto(destino, 'OURENSE') || coincideTexto(destino, 'ORENSE'))) {
      return { regimen: 'agregada_quincenal', motivo: null };
    }
    return { regimen: 'linea', motivo: null }; // Foresa otros / Villagarcia otros / Retornos (D-06, confirmado).
  }

  // EVIDENCIA PRIMERO para el resto. Si se inyecto la modalidad deducida del
  // historico (ficha/modalidad-indexacion.js), manda esa: dice como se le facturo
  // REALMENTE la indexacion a este cliente, en vez de adivinarla.
  //   'sin_indexacion' se propaga tal cual (hay clientes cuya factura no la lleva).
  //   'agregada' se propaga (el corte real lo dan los tramos de pct, no el mes).
  //   modalidad null (sin evidencia) NO cae al default: null + motivo -> REVISAR.
  if (modalidad && modalidad.fuente && modalidad.fuente !== 'ninguna') {
    if (modalidad.modalidad === null) {
      return { regimen: null, motivo: modalidad.motivo };
    }
    return { regimen: modalidad.modalidad, motivo: modalidad.revisar ? modalidad.motivo : null };
  }
  if (cl.indexOf('BALTRANSA') >= 0) { return { regimen: 'incluida', motivo: null }; }
  return { regimen: 'linea', motivo: null }; // QUIMIDROGA, RNM, HELM: por viaje (regla general).
}
// nz_local: version standalone de nz (correlacionar.js la tiene con otro nombre;
// aca solo hace falta para el mensaje de motivo, sin acoplar los dos modulos).
function nz_local(x) { if (x === null || x === undefined) { return null; } var s = String(x).trim(); return (s === '' || s.toLowerCase() === 'null') ? null : s; }

/**
 * Reparte los km del bloque entre n viajes (§1). Piso entero a cada uno y el
 * RESTO al ultimo, para que la suma de los n cierre EXACTAMENTE con el total del
 * bloque. Regla fija y documentada; si cambia, cambia aca y en el test.
 *
 * @returns {number[]} n enteros cuya suma es kmBloque (o [] si no hay dato).
 */
function repartirKm(kmBloque, n) {
  if (kmBloque === null || kmBloque === undefined || !isFinite(kmBloque)) { return []; }
  if (!Number.isInteger(n) || n <= 0) { return []; }
  var base = Math.floor(kmBloque / n);
  var out = [];
  for (var i = 0; i < n; i++) { out.push(base); }
  out[n - 1] += (kmBloque - base * n);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE,
    UMBRAL_CANTIDAD_KG: UMBRAL_CANTIDAD_KG,
    CLIENTES_CONOCIDOS: CLIENTES_CONOCIDOS,
    norm: norm,
    coincideTexto: coincideTexto,
    esRutaMultiviaje: esRutaMultiviaje,
    esClienteConocido: esClienteConocido,
    clasificarCantidad: clasificarCantidad,
    regimenIndexacion: regimenIndexacion,
    repartirKm: repartirKm,
  };
}

// ===== CATALOGOS GESRUTA: material y chofer (conjuntos CERRADOS) =============
//
// La planilla de carga a Gesruta no lleva texto libre: lleva el CODIGO Gesruta.
// Columnas del formato objetivo (Excelente_detalle_Code_Tabla):
//   "Cod. Material" -> "Material, traducido al listado de Gesruta para matchear"
//   "Cod. Chofer"   -> "Codigo de Gesruta"
//
// Mismo principio que el padron de flota (ficha/flota.js) y que el catalogo de
// puntos: NO se traduce con criterio libre, se ELIGE dentro de una lista conocida,
// y solo cuando la eleccion es inequivoca. Lo que no resuelve queda vacio con
// motivo, para revision humana — nunca se inventa un codigo.
//
// CATALOGO DE MATERIAL: los 558 codigos del listado oficial de Gesruta
// (Materiales.csv, columnas Cod.Car. / Carga). CHOFERES: los 25 del export real.
//
// Logica PURA (sin n8n). Los catalogos se pueden inyectar (data table a futuro).

'use strict';

// --- Catalogo de MATERIAL: codigo Gesruta -> nombre canonico ----------------
var MATERIALES = {
  "ESTEAR":"A.ESTEARICO", "A12666":"A126666", "79":"ABONO", "13":"ABONO FRA. 06/4",
  "ABONO":"ABONO FRA.07/120", "AC8":"AC81511", "21":"ACEITE", "AQUILA":"ACET.ALQUILAMINA",
  "98":"ACETATO", "24":"ACETATO DE BUTILO", "31":"ACETATO DE ETILO",
  "VINILO":"ACETATO DE VINILO", "ISOBUT":"ACETATO ISOBUTILO", "53":"ACETATO METILO",
  "ACETON":"ACETONA", "ACETIC":"ACIDO ACETICO", "102":"ACIDO ACRILICO",
  "CITRIC":"ACIDO CITRICO", "100":"ACIDO CLORH.", "FENOLS":"ACIDO FENOLSOFINICO",
  "FORMIC":"ACIDO FORMICO", "67":"ACIDO FOSFORICO", "FUMARI":"ACIDO FUMARICO",
  "ACIDOG":"ACIDO GRASO", "INORGA":"ACIDO INORGANICO", "METACR":"ACIDO METACRILICO",
  "89":"ACIDO NITRICO", "OLEICO":"ACIDO OLEICO", "PALMIT":"ACIDO PALMITICO",
  "PROPIO":"ACIDO PROPIONICO", "ACIDOS":"ACIDO SULFONICO", "20":"ACIDO SULFURICO",
  "ARILSU":"ACIDOS ARILSULFORNICOS", "ACIFEE":"ACIFEED", "ACRELA":"ACRELATO BUTILO",
  "ACREL":"ACRELATO ETILO", "ACRETI":"ACRIL.ETILO", "ACRODU":"ACRODUR", "37":"ACRONAL",
  "ADBLUE":"ADBLUE", "ADDITI":"ADDITIF", "ADICRI":"ADICRIL", "14":"ADITIVO", "AEMOIL":"AEMOIL",
  "11":"AGUA", "DESMIN":"AGUA DESMINER.", "76":"AGUARDIENTE", "AGUARR":"AGUARRAS",
  "50":"AGUAS RESIDUALES", "AIRBLU":"AIRBLUE", "103":"ALAMBRE", "ALARIA":"ALARIA",
  "83":"ALCOHOL", "26":"ALCUPOL", "ALIMEN":"ALIMENTACION", "ALKANO":"ALKANOLAMINE",
  "ALQUIL":"ALQUILER", "BULK":"ALS-LC BULK", "ALUMNA":"ALUMINATO SODICO", "ALUMIN":"ALUMINIO",
  "ALULIQ":"ALUMINIO LIQUIDO", "33":"AMONIACO", "ANDAMI":"ANDAMIOS", "ANILIN":"ANILINA",
  "APERIT":"APERITIVOS", "AQUA":"AQUA-QUENCH", "ARGINA":"ARGINA", "ARROZ":"ARROZ",
  "ARTPIS":"ART.PISCINAS", "ASFALT":"ASFALTO", "AUTOMO":"AUTOMOCION", "AXILA":"AXILAT",
  "96":"AZEOTROPO", "AZUCAR":"AZUCAR", "BAKELI":"BAKELITE", "BANAST":"BANASTAS",
  "BARAN":"BARANDILLAS", "BARQUA":"BARQUAT", "BATERI":"BATERIAS", "BAZAR":"BAZAR",
  "BRIAL":"BD BRIAL", "48":"BEBIDAS", "BENCEN":"BENCENOGT", "BETA":"BETA MSHF",
  "BETUN":"BETUN ALSF.", "BIDONE":"BIDONES", "BIODIE":"BIODIESEL", "BIOETA":"BIOETANOL",
  "OIL":"BIOHEATING OIL", "BIOPOL":"BIOPOL", "46":"BISULFITO SODICO", "BOBIN":"BOBINAS",
  "BOBINA":"BOBINAS HOJALATA", "BOLLER":"BOLLERIA", "43":"BORRASPERSE", "BOTELL":"BOTELLAS",
  "87":"BRADOL", "12669":"BREAS-DISTILL.RESIDUE", "BROQUE":"BROQUETAS", "BRYTEN":"BRYTEN",
  "BUTANO":"BUTANOL", "BUTILD":"BUTILDIGLICOL", "BUTIL":"BUTILGLICOL", "BUTYL":"BUTYLGLYCOL",
  "C810":"C-810L", "CABALL":"CABALLETES", "10":"CABEZA TR.", "CAFE":"CAFE", "CAJAS":"CAJAS",
  "CAJA":"CAJAS", "CAMBIO":"CAMBIO PAPELES", "CAPRI":"CAPRILATO METILO", "CARBOM":"CARBOMAP",
  "BARIO":"CARBONATO BARIO", "CARGA":"CARGA ADICIONAL", "CARDES":"CARGA/DESCARGA",
  "12672":"CARGA/DESCARGA COLA PINATURE", "93":"CARGAS", "101":"CARNE", "CARTON":"CARTON",
  "CATAL":"CATALYST BDMA", "CATALY":"CATLYST", "CAUCHO":"CAUCHO", "CBA":"CBA 1140",
  "CEBOLL":"CEBOLLAS", "CELTIS":"CELTIS 902", "CEMENT":"CEMENTO", "CERVEZ":"CERVEZA",
  "CHAPA":"CHAPA", "CHOCOL":"CHOCOLATE", "CHRYSO":"CHRYSO", "CICLOH":"CICLOHEXANO",
  "CIDOMI":"CIDOMIX", "CIPTON":"CIPTON", "ABO\u00d1O":"CISTERNA EN ABOÑO",
  "12":"CISTERNA EN DEPOSITO", "CALCIC":"CLOR.CALCICO", "CLORAT":"CLORATO", "CLORIT":"CLORITO",
  "CLOALU":"CLORURO DE ALUMINIO", "28":"CLORURO DE METILENO", "CLT":"CLT-105",
  "CMS":"CMS-VINAZA", "1":"COLA", "FENOLI":"COLA FENOLICA", "ROJA":"COLA ROJA",
  "17":"COLA SACO", "COLAFO":"COLA/FORMOL", "COLCHO":"COLCHONES", "COLOR":"COLORANTE",
  "COMEST":"COMESTIBLES", "COMPLE":"COMPLEMENTO", "CG/CAJ":"CONGELAD/CAJAS", "6":"CONGELADO",
  "CG/MAQ":"CONGELADO/MAQUINAS", "CG/REF":"CONGELADO/REFRIGERADO", "15":"CONSERVA",
  "CONTEN":"CONTENEDORES", "CONTRA":"CONTRAPESOS", "CRISTA":"CRISTAL", "12677":"CUTMAX",
  "D40":"D 40", "DABEER":"DABEERSEN", "DABERS":"DABEERSEN", "DEHYDO":"DEHYDOL",
  "DEHYT":"DEHYTON", "DEMULS":"DEMULSENE", "DERMUL":"DERMULSENE", "DESCAR":"DESCARGA",
  "12671":"DESCARGA EN SABADO", "DESPLA":"DESPLAZAMIENTO", "DESVIO":"DESVIO",
  "DETERG":"DETERGENTE", "DEVOLU":"DEVOLUC.COLA", "DEVOL.":"DEVOLUC.MERCANCIA",
  "DEV":"DEVOLUCION", "DIACET":"DIACETONA ALCOHOL", "DIAMIN":"DIAMIN T",
  "DIETAN":"DIETANOLAMINA", "61":"DIETILENGLICOL", "DIMETI":"DIMETILBENC.",
  "DIM":"DIMETILFORM.", "DIPROP":"DIPROPILENGLICOL", "90":"DISOLVENTE", "DIVOST":"DIVOSTAR",
  "58":"DK-FLOC", "DMBA":"DMBA", "DOP":"DOP", "DOTP":"DOTP", "DOWANO":"DOWANOL",
  "DP":"DP 5/50", "DROGUE":"DROGUERIA", "DROVI":"DROVISOL", "EASYCO":"EASYCOL", "63":"ECOLUBE",
  "EKA":"EKA", "1374":"ELECTROCLOR", "ELECTR":"ELECTRODOMEST.", "EMPAT":"EMPATEN",
  "EMULSI":"EMULSIBER", "EMULTE":"EMULTEX", "ENVASA":"ENVASADO", "ENV":"ENVASES",
  "82":"ENVASES BEBIDAS", "DIRECT":"ENVIO DIR.", "12670":"EQ-23-V", "ESPUMA":"ESPUMA",
  "ESTERM":"ESTERMETIL", "59":"ESTIRENO", "ETANOL":"ETANOL", "ETHYL":"ETHYLHEXANOL",
  "EXPOSI":"EXPOSITORES", "EXTENS":"EXTENSOIL", "EXTRAC":"EXTRACTO 60",
  "FECULA":"FECULA PATATA", "FENNOS":"FENNOSIZE", "TRENGH":"FENNOSTRENGHT",
  "FENOL":"FENOL FUNDIDO", "FERRET":"FERRETERIA", "FERRIC":"FERRICALAR",
  "FERTIL":"FERTILIZANTE", "FIBROC":"FIBROCEMENTO", "41":"FIMAPAN", "55":"FIMAPAN/PALETS",
  "FINCAT":"FINCAT", "FINTES":"FINRES TEST", "FLEJE":"FLEJE", "FLOCU":"FLOCUSOL",
  "FLOQUA":"FLOQUAT", "FLOTAD":"FLOTADORES", "70":"FLUBE", "FORLAC":"FORLAC 75",
  "FORMIP":"FORMIPRO", "3":"FORMOL", "FORMET":"FORMOL/METANOL", "FOSFAT":"FOSFATION",
  "80":"FR CROS", "FRUTA":"FRUTA", "FRUTCO":"FRUTA-CONG.", "2":"FUEL", "CALDE":"FUEL CALD.",
  "FUNGI":"FUNGI-GAL", "8":"GALLETAS", "GARDOB":"GARDOBOND", "GARDO":"GARDOCLEAN",
  "GASOLE":"GASOLEO", "35":"GEOTEX HD 40", "GLICER":"GLICERINA", "GLICOL":"GLICOL",
  "GOMAS":"GOMAS", "GRANA":"GRANALLA", "GRANOD":"GRANODINE", "GRASA":"GRASA",
  "GRINCO":"GRINCO M", "GRUPAJ":"GRUPAJE", "18":"HARINA", "60":"HAVOLINE", "HELAD":"HELADOS",
  "99":"HEPTANO", "HEXAMO":"HEXAMOLL", "HEXANO":"HEXANO", "HIDR":"HIDROXIDO POTASICO",
  "65":"HIDROXIDO SODICO", "HIELO":"HIELO", "HIERRO":"HIERRO", "HOJAL":"HOJALATA",
  "HOOPOL":"HOOPOL", "HUEVOS":"HUEVOS", "IBERPA":"IBERPAN", "ILUMIN":"ILUMINACION",
  "IMPRES":"IMPRESS", "INOPON":"INOPON", "IPA":"IPA", "IQOXIN":"IQOXINOL", "ISOB":"ISOBUTANOL",
  "91":"ISOPROPANOL", "16":"JABON", "JAYFLE":"JAYLEX DINP", "JUGUET":"JUGUETES",
  "KEMFLU":"KEMFLUID", "KYMENE":"KYMENE", "LACTEO":"LACTEOS", "LADRIL":"LADRILLO",
  "LASACI":"LASACID", "LATEX":"LATEX", "LAURIL":"LAURIL ETER", "25":"LAVADO",
  "LECHAV":"LECHAVIT", "LECHE":"LECHE", "LEUCOP":"LEUCOPHOR", "FLEX":"LG FLEX",
  "LIAS":"LIAS VINO", "LIBROS":"LIBROS", "38":"LIGNEX NAL", "42":"LIGNEX NAL",
  "LIGNOB":"LIGNOBOND", "KA\u00d1A":"LIGNOKAÑA", "LIGNOK":"LIGNOKAÑA", "34":"LIGNOSULFONATE",
  "LINOSU":"LINOSULFORATO", "ORGAN":"LIQ.ORGAN.CORROSIVO", "62":"LISINA", "LUPRO":"LUPROMIX",
  "MADERA":"MADERA", "MAGNES":"MAGNESITA", "MAMMFO":"MAMMFOR", "MANGAN":"MANGANESO",
  "MANTEC":"MANTECA", "MAQUIN":"MAQUINA", "MAQU":"MAQUINAS", "MARGAR":"MARGARINA",
  "MARMOL":"MARMOL", "MASPHA":"MASPHATE", "MAT":"MAT 330D", "OBRA":"MAT. OBRA",
  "1373":"MATERIAL FERIA", "MEG":"MEG", "MELAZA":"MELAZA", "VARIAS":"MERCANC.VARIAS",
  "METAL":"METAL", "METALT":"METALEST", "5":"METANOL", "METANO":"METANOL DEVUELTO",
  "METHAN":"METHAM-NA", "METHYL":"METHYL GLYCOL", "77":"METIL ESTER", "METIL":"METIL ESTER",
  "ETER":"METIL ETER", "22":"METIL ETIL CETONA", "METILP":"METIL PROXITOL",
  "METMET":"METILMETACRILATO", "97":"METILO", "METOXI":"METOXIPROPANOL",
  "METROX":"METROXIPROPILO", "MEXIFL":"MEXIFLEX", "MONOET":"MONOETHANOLAMINA",
  "MONOE":"MONOETILENGLICOL", "45":"MOWILIT", "MUEBLE":"MUEBLES", "N32":"N-32",
  "NARANJ":"NARANJAS", "NATA":"NATA", "NEMOL":"NEMOL", "AMONIC":"NITR.AMONICO",
  "ETILHE":"NITR.ETILHEXILO", "NITRMA":"NITRAT.MAGNES.", "36":"NOPCOMASTER", "NORLAN":"NORLAN",
  "73":"NORSODYNE", "NOVA":"NOVADEX", "1375":"NTA NA3", "NYFLEX":"NYFLEX", "NYTEX":"NYTEX",
  "29":"NYTRO", "NITRO":"NYTRO TAURUS", "OLCUPO":"OLCUPOL", "OLEINA":"OLEINA", "47":"OROTAN",
  "OXIDMA":"OXIDO DE MANGANESO", "OXILAN":"OXILAN", "OXSILA":"OXSILAN", "PAJA":"PAJA",
  "68":"PALATINOL", "PALETI":"PALETIZADO", "54":"PALETS", "PALLET":"PALLETS", "PAN":"PAN",
  "PANCON":"PAN CONGELADO", "RALLAD":"PAN RALLADO", "PANEL":"PANEL", "PANELE":"PANELES",
  "PAPEL":"PAPEL", "32":"PAPEL HIGIENICO", "PAQUET":"PAQUETERIA", "PARAC":"PARACHLOR-52",
  "4":"PARAFINA", "PARAFL":"PARAFLOU FO2", "39":"PARALIZACION", "PARALI":"PARALIZACION",
  "PASCAL":"PASCAL", "PASTAP":"PASTA DE PAPEL", "PASTA":"PASTA PAPEL", "66":"PATATAS",
  "PAVIME":"PAVIMENTOS", "PAX":"PAX", "PA\u00d1ALE":"PAÑALES", "PEAJES":"PEAJES",
  "PELLET":"PELLETS", "PERCLO":"PERCLORORETILENO", "92":"PESCADO", "12667":"PET 9331",
  "PETRIL":"PETRIL", "PETROS":"PETROSOL", "PIEDRA":"PIEDRA", "PIENSO":"PIENSO",
  "PIGMEN":"PIGMENTANTE", "PINATU":"PINATURE", "PINTUR":"PINTURA", "PIROTE":"PIROTECNIA",
  "PISCIN":"PISCINAS", "PIZARR":"PIZARRA", "PLADUR":"PLADUR", "PLANTA":"PLANTAS",
  "PLAS":"PLASTICOS", "PLASTI":"PLASTIFICANTE", "PLAXTE":"PLAXTER", "PLETIN":"PLETINA",
  "1372":"PO 1372 R", "POLIAM":"POLIAMINAS", "84":"POLICLORURO", "POLIET":"POLIETILENGLICOL",
  "POLIFL":"POLIFLUX", "POLIFO":"POLIFOSFATO", "POLI":"POLIOL", "POLIOL":"POLIOLESINA",
  "POLYFO":"POLYFOAN", "POLYNT":"POLYNT", "POLYOL":"POLYOL", "PHOSPH":"POLYPHOSPHATE",
  "POLYSO":"POLYSOL", "95":"PORCELANA", "POS":"POS COD", "POTASA":"POTASA CAUSTICA",
  "POZZO":"POZZOLITH", "PREFHO":"PREF.HORMIGON", "64":"PRIMAL", "FARMAC":"PROD.FARMAC.",
  "ADR":"PRODUCTO ADR", "NO ADR":"PRODUCTO NO ADR", "PROPAN":"PROPANO",
  "PROPIL":"PROPILENGLICOL", "PURE":"PURE MANZANA", "QUAT":"Q QUAT", "SOL":"Q-SOL",
  "FEED":"QD FEED", "QDPOL":"QDPOL", "QPOL":"QPOL", "QUAKER":"QUAKERCUT", "QUAK":"QUAKEROL",
  "QUATTR":"QUATTRO", "QUESO":"QUESO", "QUINTO":"QUINTOLUBRIC", "RADIAD":"RADIADORES",
  "57":"REBAJAR Y DESCARGAR", "RECICL":"RECICLAJE", "REDEMU":"REDEMUL", "REFRES":"REFRESCOS",
  "REFRIG":"REFRIGERADO", "7":"REPARTOS", "REPEX":"REPEX", "UF":"RES UF-85",
  "RESID":"RES.COD.LER 070504", "RESIDU":"RES.COD.LER 190814", "BIODEG":"RESID.BIODEGRADABLES",
  "12676":"RESIDUO UN 3082", "23":"RESINA", "RESINO":"RESINOLINE", "RETARD":"RETARDAN",
  "RETORN":"RETORNO", "RF-401":"RF-401", "74":"RHODIMET", "86":"RHODIMET", "RHODOP":"RHODOPAS",
  "52":"RM 245", "ROPA":"ROPA", "ROPOL":"ROPOL", "ROQUAT":"ROQUAT", "RP":"RP CIRCULACION",
  "RUEDAS":"RUEDAS", "SAL":"SAL", "SALMO":"SALMO-GAL", "SALMOG":"SALMOGAL",
  "SANITA":"SANITARIOS", "SCRIPT":"SCRIPTANE", "SECO":"SECO", "SEC/CG":"SECO/CONGELADO",
  "SIKACE":"SIKACERAM", "SIKAME":"SIKAMENT", "49":"SILICATO", "30":"SN 300",
  "COSTE":"SOBRECOSTE", "SODAL":"SODAL", "SODIO":"SODIO SILICATO", "SOKALA":"SOKALAN",
  "81":"SOLUC.NITROGENADA", "SOLUCI":"SOLUCION ACUOSA", "SOLVES":"SOLVESSO",
  "SORBIT":"SORBITOL", "51":"SOSA", "SOSALC":"SOSA-ALCOHOL", "SPIRDA":"SPIRDANE",
  "STAND":"STAND FERIA", "STEARI":"STEARINE", "69":"STYROFAN", "SUERO":"SUERO",
  "SULFAM":"SULF.AMONICO", "27":"SULFANONA", "56":"SULFATO ALUMINA",
  "SULFFE":"SULFATO FERRICO", "SULFSO":"SULFATO SODICO", "SUPERM":"SUPERMERCADO",
  "12674":"SUPLEM. DIESEL-FORESA 18.38%", "12675":"SUPLEM.DIESEL-QUIMIDROGA 5.96%",
  "SUPLEM":"SUPLEMENTO", "12673":"SUPLEMENTO DIESEL-HELM 8.02%", "SURFAC":"SURFACTAN",
  "SYNOLA":"SYNOLAC", "TABLER":"TABLERO", "88":"TADAFLOT", "TALL":"TALL OIL",
  "TALUPA":"TALUPAC", "TCPP":"TCPP", "TENSIO":"TENSION", "TEREMB":"TEREBEMTINA",
  "TERRAZ":"TERRAZO", "75":"TEXAPON", "TEXTIL":"TEXTIL", "78":"THERMISOL", "TIERRA":"TIERRA",
  "TINNOL":"TINNOL", "TINTAS":"TINTAS", "85":"TOLUENO", "TOMATE":"TOMATE", "TOTM":"TOTM-S",
  "TRACT":"TRACTORES", "SIDER":"TRANSF.SIDERURG.", "TRANSF":"TRANSFORMADORES",
  "TRIACE":"TRIACETINA", "TRIETA":"TRIETANOLAM.", "TRIETI":"TRIETILENGLICOL",
  "TRONCO":"TRONCOIL", "TUBO":"TUBOS", "TUBOS":"TUBOS PLASTICO", "UAN":"UAN-32", "19":"UF",
  "URALIT":"URALITA", "UREA":"UREA", "ZICLUS":"V-ZICLUS", "VACIO":"VACIO", "VANASO":"VANASOL",
  "9":"VARIOS", "VARNIS":"VARNISH", "VIDRIO":"VIDRIO", "VINAGE":"VINAGRE",
  "VINKA":"VINKA-PLAST", "40":"VINO", "VISCO":"VISCOCRETE", "VISOM":"VISOM", "VM 410":"VM 410",
  "VOLUTA":"VOLUTA H 300", "VORANO":"VORANOL", "12668":"WAC AB", "44":"WHITE SPIRIT",
  "WP70":"WP 70", "94":"XILENO", "71":"YOGUR", "ZINC":"ZINC", "72":"ZUMOS"
};

// ALIAS de material: como lo escriben los DOCUMENTOS y las FICHAS vs el nombre
// Gesruta. Derivados de los documentos reales analizados. Ampliable sin tocar
// logica. Clave = literal normalizado; valor = codigo Gesruta.
var ALIAS_MATERIAL = {
  // Resinas/colas de FORESA: la ficha y el albaran escriben "RES 0201",
  // "FORESA RES 0201", "Res 0541"... todas son COLA en Gesruta.
  'RES': '1', 'FORESA RES': '1', 'RESINA': '1', 'RESINA COLOFONIA': '1', 'COLA': '1',
  // Vinka-Plast (Quimidroga): en los documentos aparece "VINKA PLAST QD 390".
  'VINKA PLAST': 'VINKA', 'VINKAPLAST': 'VINKA', 'VINKA PLAST QD': 'VINKA',
  // La vision lee seguido "VINA PLAST" / "VINA-PLAST" (se come la K).
  'VINA PLAST': 'VINKA', 'VINAPLAST': 'VINKA',
  // Acidos y bases con nombre legal ADR largo.
  'ACIDO ACETICO GLACIAL': 'ACETIC', 'ACIDO ACETICO GLACIAL SOLUCION': 'ACETIC',
  'ACETIC ACID GLACIAL': 'ACETIC',
  // La ficha lo abrevia "A. Acetico".
  'A ACETICO': 'ACETIC', 'ACETICO': 'ACETIC',
  'SOSA CAUSTICA': '51', 'HIDROXIDO DE SODIO': '65', 'HIDROXIDO SODICO': '65',
  // Los documentos portugueses e ingleses la nombran distinto (guias de Bondalti,
  // RNM y los CMR internacionales): todas son SOSA en Gesruta.
  'SODA CAUSTICA': '51', 'CAUSTIC SODA': '51', 'CAUSTIC SODA LIQUOR': '51',
  'LIQUID CAUSTIC SODA': '51', 'SODA': '51',
  'ACIDO SULFURICO': '20', 'ACIDO NITRICO': '89',
  'METANOL': '5', 'ALCOHOL METILICO': '5',
  'FORMOL': '3', 'FORMALDEHIDO': '3',
  'LISINA': '62', 'L LISINA': '62', 'L LISINA LICA': '62',
  'MONOETILENGLICOL': 'MONOE', 'MEG': 'MONOE',
  'DIETILENGLICOL': '61', 'DEG': '61',
  'FENOL': 'FENOL', 'FENOL FUNDIDO': 'FENOL'
};

// --- Catalogo de CHOFER: codigo Gesruta -> nombre canonico ------------------
var CHOFERES = {
  'BREO': 'BREOGAN MARQUEZ', '37': 'CANDIDO JAMARDO', '2': 'CARLOS ABALO QUINTELA',
  '41': 'FRANCISCO ASENSI', 'JAC': 'JACOBO GRANDE MENDEZ', '45': 'JOSE ANTONIO VAZQUEZ HERMO',
  '39': 'JOSE CARLOS ALFONSIN', '19': 'JOSE CARLOS RODRIGUEZ', 'ARIA': 'JOSE ENRIQUE ARIAS',
  '5': 'JOSE JORGE FERREIRA GOLDAR', '34': 'JOSE MANUEL PAZ', '44': 'JOSE RAMON PIÑEIRO',
  '18': 'JOSE RUBEN ABALO RECUNA', '38': 'JUAN LUIS GLEZ LORENZO', '30': 'JUAN MANUEL ABAL',
  '42': 'LUIS M. TRIÑANES', '4': 'MANUEL ABOY GONZALEZ', '22': 'MANUEL FERREIRA GOLDAR',
  '40': 'MANUEL SABARIS', '12': 'MARCOS EIRIN FERNANDEZ', '36': 'NUNO FILIPE',
  '23': 'OSCAR SAYANS EIRIN', '6': 'PABLO CARLES SANTOS', '21': 'PEDRO FRAGA',
  '32': 'RODRIGO PEREZ BAHAMONDE'
};

function norm(s) {
  var t = (s === null || s === undefined) ? '' : String(s);
  return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Distancia de edicion (Levenshtein) para tolerar un caracter mal leido.
function distanciaTexto(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (!la) { return lb; }
  if (!lb) { return la; }
  var prev = [], i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i], ca = a.charAt(i - 1);
    for (j = 1; j <= lb; j++) {
      var cost = (ca === b.charAt(j - 1)) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[lb];
}

// Tokens de ruido en denominaciones de mercancia: concentraciones, envases,
// codigos ONU y palabras de embalaje que no distinguen el material.
var RUIDO_MATERIAL = /\b(UN\s*\d{3,4}|\d+\s*%|BULK|GRANEL|CISTERNA|SOLUCION|SOLUTION|GLACIAL|QD|CD|OD|KG|TN|ADR|CLASE|GRUPO)\b/g;

/**
 * Resuelve un material leido (ficha o documento) al codigo Gesruta.
 * Cascada: alias exacto -> nombre canonico exacto -> alias/canonico contenido
 * de forma UNIVOCA. Multi-candidato o sin match -> codigo null + motivo.
 *
 * @param {string} literal
 * @param {object} [catalogo] {materiales, alias} inyectables
 * @returns {{codigo:string|null, nombre:string|null, metodo:string, literal:string, revisar:boolean, motivo:string}}
 */
function resolverMaterial(literal, catalogo) {
  var mats = (catalogo && catalogo.materiales) || MATERIALES;
  var alias = (catalogo && catalogo.alias) || ALIAS_MATERIAL;
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var n = norm(lit);
  if (!n) {
    return { codigo: null, nombre: null, metodo: 'vacio', literal: lit, revisar: true, motivo: 'material vacio o ilegible' };
  }
  // Limpieza de ruido (concentraciones, ONU, envase) para comparar.
  var limpio = norm(n.replace(RUIDO_MATERIAL, ' '));

  var res = function (cod, metodo, revisar, motivo) {
    return { codigo: cod, nombre: mats[cod] || null, metodo: metodo, literal: lit, revisar: !!revisar, motivo: motivo || '' };
  };

  // 1) Alias exacto (con y sin ruido).
  if (Object.prototype.hasOwnProperty.call(alias, n)) { return res(alias[n], 'alias', false); }
  if (limpio && Object.prototype.hasOwnProperty.call(alias, limpio)) { return res(alias[limpio], 'alias', false); }

  // 2) Nombre canonico exacto.
  var k;
  for (k in mats) {
    if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
    if (norm(mats[k]) === n || (limpio && norm(mats[k]) === limpio)) { return res(k, 'canonico', false); }
  }

  // 3) Contencion UNIVOCA: el nombre Gesruta aparece dentro del literal, o un
  // alias aparece dentro del literal. Debe apuntar a UN SOLO codigo.
  // Contencion por LIMITE DE PALABRA, nunca por substring crudo: "RES" no debe
  // matchear dentro de "RESORCINOL" (paso de verdad y habria facturado COLA por
  // un producto distinto). Se compara token completo.
  var hits = {};
  var base = ' ' + (limpio || n) + ' ';
  var contiene = function (frag) { return frag && frag.length >= 3 && base.indexOf(' ' + frag + ' ') >= 0; };
  for (k in mats) {
    if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
    if (contiene(norm(mats[k]))) { hits[k] = true; }
  }
  for (k in alias) {
    if (!Object.prototype.hasOwnProperty.call(alias, k)) { continue; }
    if (contiene(k)) { hits[alias[k]] = true; }
  }
  var ids = Object.keys(hits);
  if (ids.length === 1) {
    return res(ids[0], 'contencion', true, 'material "' + lit + '" -> ' + mats[ids[0]] + ' (' + ids[0] + ') por contencion — verificar');
  }
  if (ids.length > 1) {
    var nombres = ids.map(function (i) { return mats[i]; }).join(', ');
    return { codigo: null, nombre: null, metodo: 'ambiguo', literal: lit, revisar: true, motivo: 'material "' + lit + '" coincide con varios de Gesruta (' + nombres + ') — revisar cual es' };
  }
  return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'material "' + lit + '" no esta en el listado de Gesruta — dar de alta o corregir' };
}

/**
 * Resuelve el chofer de la ficha al codigo Gesruta. La ficha trae el nombre
 * abreviado ("Juan Manuel Abal", "MARCOS", "PEDRO FRAGA") y Gesruta el nombre
 * completo. Match por CONTENCION de todos los tokens del literal en el canonico,
 * exigiendo unicidad (dos "JOSE CARLOS" distintos no se resuelven a ciegas).
 */
function resolverChofer(literal, catalogo) {
  var chs = (catalogo && catalogo.choferes) || CHOFERES;
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var n = norm(lit);
  if (!n) { return { codigo: null, nombre: null, metodo: 'vacio', literal: lit, revisar: true, motivo: 'chofer vacio o ilegible' }; }

  var k, exactos = [];
  for (k in chs) {
    if (!Object.prototype.hasOwnProperty.call(chs, k)) { continue; }
    if (norm(chs[k]) === n) { exactos.push(k); }
  }
  if (exactos.length === 1) { return { codigo: exactos[0], nombre: chs[exactos[0]], metodo: 'exacto', literal: lit, revisar: false, motivo: '' }; }

  // Contencion: TODOS los tokens del literal deben estar en el nombre canonico.
  // Se conservan las iniciales (1 caracter): 'M FERREIRA' necesita la M para
  // distinguir MANUEL FERREIRA de JOSE JORGE FERREIRA. Pesan poco (ver puntaje).
  var toks = n.split(' ').filter(function (t) { return t.length >= 1; });
  if (!toks.length) { return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" ilegible' }; }
  // PUNTAJE PONDERADO POR CARACTERES (mismo criterio que el padron de flota):
  // cada token del literal que aparece en el nombre canonico suma su longitud,
  // asi un apellido distintivo ("CANDIDO", 7) pesa mas que un nombre comun
  // ("JOSE", 4) y no empatan todos los Jose entre si. Un token cuenta si es
  // prefijo de un token canonico (o al reves) o si difiere en 1 caracter
  // (>=3 letras): la ficha manuscrita se lee "ABELO" por "ABALO", "GLZ" por
  // "GLEZ". Gana el mejor SOLO si le saca ventaja al segundo; si empatan, es
  // ambiguo y no se elige (no se adivina entre homonimos).
  var puntajes = [];
  for (k in chs) {
    if (!Object.prototype.hasOwnProperty.call(chs, k)) { continue; }
    var canon = norm(chs[k]).split(' ');
    var pts = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      for (var j = 0; j < canon.length; j++) {
        var c2 = canon[j];
        // El puntaje es el SOLAPAMIENTO real, no la longitud del token leido: una
        // inicial canonica ('M' de "LUIS M. TRIÑANES") solo puede sumar 1, y no
        // puede empatarle a un nombre completo ("MARCOS" = 6). Sin esto, "MARCOS"
        // empataba con "LUIS M. TRIÑANES" y quedaba ambiguo.
        if (c2.indexOf(t) === 0 || t.indexOf(c2) === 0) { pts += Math.min(t.length, c2.length); break; }
        if (t.length >= 3 && c2.length >= 3 && distanciaTexto(t, c2) <= 1) { pts += t.length; break; }
      }
    }
    if (pts > 0) { puntajes.push({ cod: k, pts: pts }); }
  }
  puntajes.sort(function (a, b) { return b.pts - a.pts; });
  var cands = [];
  if (puntajes.length === 1) { cands = [puntajes[0].cod]; }
  else if (puntajes.length > 1) {
    if (puntajes[0].pts > puntajes[1].pts) { cands = [puntajes[0].cod]; }
    else { cands = puntajes.filter(function (x) { return x.pts === puntajes[0].pts; }).map(function (x) { return x.cod; }); }
  }
  if (cands.length === 1) {
    return { codigo: cands[0], nombre: chs[cands[0]], metodo: 'contencion', literal: lit, revisar: false, motivo: '' };
  }
  if (cands.length > 1) {
    var nn = cands.map(function (c) { return chs[c]; }).join(', ');
    return { codigo: null, nombre: null, metodo: 'ambiguo', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" coincide con varios (' + nn + ') — revisar cual es' };
  }
  return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" no esta en el listado de Gesruta — dar de alta o corregir' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MATERIALES: MATERIALES, ALIAS_MATERIAL: ALIAS_MATERIAL, CHOFERES: CHOFERES,
    resolverMaterial: resolverMaterial, resolverChofer: resolverChofer,
    normalizarGesruta: norm,
  };
}

// ===== RESOLVEDOR CANONICO DE PUNTOS (modelo-dominio-lectura.md §9) ==========
//
// Los choferes y los documentos escriben lugares a mano; no coinciden con los
// nombres de las bases. Este modulo resuelve un literal cualquiera al PUNTO
// CANONICO (el id que entiende Gesruta), con una cascada de confianza explicita.
// NUNCA adivina en silencio: todo lo que no sea match exacto marca REVISAR
// (adivinar un punto envenena la tarifa, §2).
//
// Logica PURA (sin n8n), compartida por ingesta, auditor y (futuro) robot Gesruta.
//
// `catalogo`: Array<{ id_punto, nombre_canonico, alias, ... }>. `alias` es un
// string con variantes separadas por "|".

'use strict';

// Escalones de confianza (para poder "bajar un escalon" segun la fuente, §4).
var ESCALON = { alta: 3, media: 2, baja: 1, ninguna: 0 };
function bajarConfianza(c) {
  if (c === 'alta') { return 'media'; }
  if (c === 'media') { return 'baja'; }
  return c; // baja/ninguna no bajan mas
}

// Overrides INTENCIONALES de oficina (confirmados por Julio): un literal que
// coincide con un canonico Gesruta que EN LA PRACTICA no se usa para ese destino.
// Ganan sobre toda la cascada. Clave = literal normalizado; destino = nombre
// canonico al que debe resolver. Reversible: quitar la entrada revierte al
// comportamiento por catalogo. Trazabilidad: la nota viaja en el motivo del
// resultado aunque la confianza sea alta.
var OVERRIDES_LITERAL = {
  // 'Anleo' es una parroquia dentro de Navia (Asturias); la oficina SIEMPRE lo
  // carga como NAVIA. Gana sobre el canonico Gesruta 'ANLEO', que existe pero no
  // se usa en la practica (datos/alias-fichas-reales.md, confirmado por Julio).
  'ANLEO': { destino: 'NAVIA', nota: "'Anleo' es parroquia de Navia; la oficina siempre lo carga como NAVIA. Override intencional sobre el canonico Gesruta ANLEO (existe pero no se usa)." }
};

// Frases de ruido a quitar ANTES que los tokens sueltos (orden: mas larga primero).
var FRASES_RUIDO = [' S L U ', ' S A U ', ' S C A ', ' S L L ', ' S A ', ' S L ', ' S C ', ' C B ',
                    ' PUERTO DE ', ' POLIGONO INDUSTRIAL ', ' POL INDUSTRIAL ', ' POL IND '];
// Tokens de ruido sueltos.
var TOKENS_RUIDO = [' SA ', ' SL ', ' SLU ', ' SAU ', ' PLANTA ', ' FABRICA ', ' PTO ',
                    ' POLIGONO ', ' POL ', ' IND ', ' PUERTO ',
                    // Marcador de PAIS en el catalogo Gesruta: "LEIRIA (PT)",
                    // "ALCANENA(PT)". El documento escribe solo la localidad, asi
                    // que el marcador impide el match. No aporta identidad: el
                    // codigo del punto ya distingue.
                    ' PT ', ' PORTUGAL ', ' ESPANA ', ' SPAIN '];

// Abreviaturas toponimicas portuguesas/gallegas: la ficha y los documentos
// escriben "V.N. Famalicao" o "Vila Nova de Famalicao" y Gesruta "VILANOVA
// FAMALICAO". Es convencion de escritura, no ambiguedad: se unifican antes de
// comparar. Se aplican como frase, tras limpiar la puntuacion.
var ABREVIATURAS = [
  [' V N ', ' VILANOVA '], [' VILA NOVA ', ' VILANOVA '], [' VN ', ' VILANOVA '],
  [' STO ', ' SANTO '], [' STA ', ' SANTA '], [' S ', ' SAN ']
];

/**
 * Normaliza un literal: mayusculas, sin acentos, sin puntuacion, espacios
 * colapsados, y sin ruido (formas societarias, POL. IND., PLANTA, PUERTO DE...).
 */
function normalizar(literal) {
  var s = (literal === null || literal === undefined) ? '' : String(literal);
  s = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos
  s = s.replace(/[^A-Z0-9]+/g, ' ');                                    // puntuacion -> espacio
  s = ' ' + s.replace(/\s+/g, ' ').trim() + ' ';                        // bordes con espacio para matchear tokens
  var i;
  for (i = 0; i < FRASES_RUIDO.length; i++) { while (s.indexOf(FRASES_RUIDO[i]) >= 0) { s = s.replace(FRASES_RUIDO[i], ' '); } }
  for (i = 0; i < TOKENS_RUIDO.length; i++) { while (s.indexOf(TOKENS_RUIDO[i]) >= 0) { s = s.replace(TOKENS_RUIDO[i], ' '); } }
  for (i = 0; i < ABREVIATURAS.length; i++) { while (s.indexOf(ABREVIATURAS[i][0]) >= 0) { s = s.replace(ABREVIATURAS[i][0], ABREVIATURAS[i][1]); } }
  return s.replace(/\s+/g, ' ').trim();
}

// Distancia de edicion (Levenshtein). Reutilizable, sin dependencias.
function distanciaEdicion(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (la === 0) { return lb; }
  if (lb === 0) { return la; }
  var prev = [], i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i], ca = a.charAt(i - 1);
    for (j = 1; j <= lb; j++) {
      var cost = (ca === b.charAt(j - 1)) ? 0 : 1;
      var m = prev[j] + 1;
      if (cur[j - 1] + 1 < m) { m = cur[j - 1] + 1; }
      if (prev[j - 1] + cost < m) { m = prev[j - 1] + cost; }
      cur[j] = m;
    }
    prev = cur;
  }
  return prev[lb];
}

function tokens(norm) { return norm ? norm.split(' ') : []; }
function subconjuntoTokens(chico, grande) {
  // true si TODOS los tokens de `chico` estan en `grande` (y chico no vacio).
  var tc = tokens(chico), tg = {}, i;
  if (tc.length === 0) { return false; }
  tokens(grande).forEach(function (t) { tg[t] = true; });
  for (i = 0; i < tc.length; i++) { if (!tg[tc[i]]) { return false; } }
  return true;
}

// Indexa el catalogo: lista de { id_punto, nombre_canonico, norm } por cada
// nombre canonico y por cada alias.
function indexar(catalogo) {
  var entradas = [];
  (catalogo || []).forEach(function (p) {
    if (!p || !p.id_punto) { return; }
    if (p.nombre_canonico) { entradas.push({ id_punto: p.id_punto, nombre_canonico: p.nombre_canonico, norm: normalizar(p.nombre_canonico), es_alias: false }); }
    var al = (p.alias === null || p.alias === undefined) ? '' : String(p.alias);
    al.split('|').forEach(function (a) {
      var t = a.trim();
      if (t) { entradas.push({ id_punto: p.id_punto, nombre_canonico: p.nombre_canonico, norm: normalizar(t), es_alias: true }); }
    });
  });
  return entradas;
}

function resultadoResuelto(ent, confianza, metodo, literal, motivoExtra) {
  var revisar = (confianza !== 'alta');
  var motivo = 'punto "' + literal + '" -> ' + ent.nombre_canonico + ' (' + metodo + ', confianza ' + confianza + ')';
  if (motivoExtra) { motivo += '; ' + motivoExtra; }
  return {
    id_punto: ent.id_punto,
    nombre_canonico: ent.nombre_canonico,
    confianza: confianza,
    metodo: metodo,
    literal_original: literal,
    revisar: revisar,
    motivo: revisar ? motivo : ''
  };
}

function noReconocido(literal, motivoExtra) {
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var motivo = 'punto_no_reconocido: no se pudo resolver el literal "' + lit + '"';
  if (motivoExtra) { motivo += ' (' + motivoExtra + ')'; }
  return {
    id_punto: null, nombre_canonico: null, confianza: 'ninguna', metodo: 'punto_no_reconocido',
    literal_original: lit, revisar: true, motivo: motivo
  };
}

/**
 * Resuelve UN literal contra el catalogo. Cascada estricta (§9).
 * @param {string} literal
 * @param {'documento'|'ficha'} [fuente='documento'] la ficha es sospechosa (§4):
 *   si resuelve, se le baja la confianza un escalon.
 * @param {Array} catalogo
 */
function resolverPunto(literal, fuente, catalogo) {
  fuente = fuente || 'documento';
  var norm = normalizar(literal);
  if (!norm) { return noReconocido(literal, 'literal vacio tras normalizar'); }
  var idx = indexar(catalogo);

  // 0) Override intencional de oficina (gana sobre TODA la cascada). Busca el
  // canonico destino en el catalogo y resuelve a el, con la nota en el motivo.
  if (Object.prototype.hasOwnProperty.call(OVERRIDES_LITERAL, norm)) {
    var ov = OVERRIDES_LITERAL[norm];
    var normDest = normalizar(ov.destino);
    for (var k = 0; k < idx.length; k++) {
      if (!idx[k].es_alias && idx[k].norm === normDest) {
        return {
          id_punto: idx[k].id_punto, nombre_canonico: idx[k].nombre_canonico,
          confianza: 'alta', metodo: 'override', literal_original: literal,
          revisar: false, override: true,
          motivo: 'override intencional de oficina: "' + literal + '" -> ' + idx[k].nombre_canonico + '. ' + ov.nota
        };
      }
    }
    return noReconocido(literal, 'override a "' + ov.destino + '" pero ese punto no esta en el catalogo');
  }

  // 1) exacto contra un nombre_canonico. 2) exacto contra un alias.
  var canon = null, alias = null, i;
  var canonIds = {}; // id_punto distintos con match canonico exacto (para duplicados)
  for (i = 0; i < idx.length; i++) {
    if (idx[i].norm === norm) {
      if (!idx[i].es_alias) { if (!canon) { canon = idx[i]; } canonIds[idx[i].id_punto] = idx[i]; }
      if (idx[i].es_alias && !alias) { alias = idx[i]; }
    }
  }
  // Duplicado en catalogo: mismo nombre EXACTO, dos Cod.Pto. distintos (ej. GARNICA
  // GARNI/GARNL). No se puede saber cual se uso desde el nombre -> NO elegir, es
  // decision de Julio (§ dato: 5 duplicados marcados pendientes).
  if (Object.keys(canonIds).length > 1) {
    var cods = Object.keys(canonIds).join(', ');
    return noReconocido(literal, 'duplicado en catalogo: mismo nombre con varios Cod.Pto. (' + cods + ') — decision pendiente de Julio');
  }
  var base = null, metodo = null;
  if (canon) { base = resultadoResuelto(canon, 'alta', 'canonico', literal); metodo = 'canonico'; }
  else if (alias) { base = resultadoResuelto(alias, 'alta', 'alias', literal); metodo = 'alias'; }

  if (!base) {
    // 3) distancia de edicion <=1 contra EXACTAMENTE un canonico.
    var cercanos = {};
    for (i = 0; i < idx.length; i++) {
      if (idx[i].es_alias) { continue; }
      if (distanciaEdicion(norm, idx[i].norm) <= 1) { cercanos[idx[i].id_punto] = idx[i]; }
    }
    var idsCerca = Object.keys(cercanos);
    if (idsCerca.length === 1) {
      base = resultadoResuelto(cercanos[idsCerca[0]], 'media', 'distancia', literal, 'lectura parecida a un canonico (distancia 1) — verificar');
    }
  }
  if (!base) {
    // 4) contencion de tokens UNIVOCA (CALDAS subconjunto de CALDAS DE REIS).
    var contiene = {};
    for (i = 0; i < idx.length; i++) {
      if (subconjuntoTokens(norm, idx[i].norm)) { contiene[idx[i].id_punto] = idx[i]; }
    }
    var idsCont = Object.keys(contiene);
    if (idsCont.length === 1) {
      base = resultadoResuelto(contiene[idsCont[0]], 'media', 'contencion', literal, 'nombre contenido en un unico canonico — verificar');
    } else if (idsCont.length > 1) {
      var nombres = idsCont.map(function (k) { return contiene[k].nombre_canonico; }).join(', ');
      return noReconocido(literal, 'ambiguo: contenido en varios canonicos (' + nombres + ')');
    }
  }
  if (!base) {
    // 5) LOCALIDAD DENTRO DE UNA DIRECCION (encargo Julio 2026-08-25).
    // Los documentos no escriben el pueblo suelto: escriben la direccion entera
    // ("CELLMARK, MUELLE DE LA ENERGIA S/N, 08039 BARCELONA", "Finsa Cella 2,
    // CELLA-TERUEL 44370 España"). Los pasos 1-4 buscan el literal DENTRO del
    // canonico (CALDAS -> CALDAS DE REIS); aca se busca al reves: el nombre
    // canonico como TOKENS COMPLETOS dentro del literal largo. Es lo que permite
    // traducir origen/destino de un CMR o una orden a punto Gesruta sin listas
    // por cliente. Gana el canonico MAS LARGO (mas especifico: "VILA NOVA DE
    // FAMALICAO" sobre "FAMALICAO"); si dos distintos empatan, es ambiguo.
    // Gana el que aparece ANTES en el literal, no el mas largo: las direcciones
    // van de lo ESPECIFICO a lo GENERAL ("Navia Asturias", "Monte Redondo -
    // Leiria", "Teixeiro (Curtis)"). Con "el mas largo" se elegia ASTURIAS (la
    // provincia) sobre NAVIA (el pueblo), que es el punto real de descarga.
    // A igual posicion, desempata el mas largo (mas especifico).
    var dentro = {}, mejorPos = -1, mejorLen = 0;
    var espaciado = ' ' + norm + ' ';
    for (i = 0; i < idx.length; i++) {
      var cand = idx[i].norm;
      if (!cand || cand.length < 4) { continue; }
      var pos = espaciado.indexOf(' ' + cand + ' ');
      if (pos < 0) { continue; }
      if (mejorPos < 0 || pos < mejorPos || (pos === mejorPos && cand.length > mejorLen)) {
        mejorPos = pos; mejorLen = cand.length; dentro = {};
      }
      if (pos === mejorPos && cand.length === mejorLen) { dentro[idx[i].id_punto] = idx[i]; }
    }
    var idsDentro = Object.keys(dentro);
    if (idsDentro.length === 1) {
      base = resultadoResuelto(dentro[idsDentro[0]], 'media', 'localidad_en_direccion', literal,
        'nombre del punto hallado dentro de la direccion del documento — verificar');
    } else if (idsDentro.length > 1) {
      var nomsD = idsDentro.map(function (k) { return dentro[k].nombre_canonico; }).join(', ');
      return noReconocido(literal, 'la direccion menciona varios puntos (' + nomsD + ')');
    }
  }
  if (!base) { return noReconocido(literal); }

  // Precedencia por fuente (§4): la ficha es sospechosa -> baja un escalon.
  if (fuente === 'ficha' && base.confianza !== 'ninguna') {
    var cNueva = bajarConfianza(base.confianza);
    base.confianza = cNueva;
    base.revisar = (cNueva !== 'alta');
    var nota = 'valor de ficha (fuente sospechosa): confianza reducida a ' + cNueva;
    base.motivo = base.motivo ? (base.motivo + '; ' + nota) : ('punto "' + literal + '" -> ' + base.nombre_canonico + '; ' + nota);
  }
  return base;
}

/**
 * Resuelve un punto con precedencia documento > ficha (§4).
 * El documento manda; la ficha solo confirma. Si ambos resuelven y difieren,
 * gana el documento y se deja la correccion anotada en el motivo.
 */
function resolverPuntoDocFicha(literalDoc, literalFicha, catalogo) {
  var rDoc = literalDoc ? resolverPunto(literalDoc, 'documento', catalogo) : null;
  var rFicha = literalFicha ? resolverPunto(literalFicha, 'ficha', catalogo) : null;

  if (rDoc && rDoc.id_punto) {
    if (rFicha && rFicha.id_punto && rFicha.id_punto !== rDoc.id_punto) {
      rDoc.revisar = true;
      var corr = 'la ficha decia "' + literalFicha + '" (=' + rFicha.nombre_canonico + '); manda el documento (§4)';
      rDoc.motivo = rDoc.motivo ? (rDoc.motivo + '; ' + corr) : corr;
    }
    return rDoc;
  }
  if (rFicha && rFicha.id_punto) { return rFicha; } // solo ficha: ya viene con confianza reducida
  // Ninguno resolvio: reportar sobre el literal que exista (documento primero).
  return rDoc || rFicha || noReconocido(literalDoc || literalFicha);
}

/**
 * Aprendizaje automatico de alias (decision de Julio: sin cola de aprobacion).
 * Cuando el operador corrige un punto, el literal original se agrega como alias
 * del canonico elegido. Salvaguarda dura: un literal NO puede ser alias de dos
 * canonicos. Todo alias guarda procedencia (reversible).
 *
 * @returns {{escribir, alias, alias_norm, id_punto, procedencia, conflicto,
 *            id_conflicto, ya_existe, motivo}}
 */
function aprenderAlias(literal, idCanonicoElegido, catalogo, procedencia) {
  var norm = normalizar(literal);
  if (!norm) { return { escribir: false, conflicto: false, ya_existe: false, motivo: 'literal vacio, no se aprende alias' }; }
  var idx = indexar(catalogo);
  var duenoActual = null, i;
  for (i = 0; i < idx.length; i++) {
    if (idx[i].norm === norm) { duenoActual = idx[i].id_punto; break; }
  }
  if (duenoActual !== null) {
    if (duenoActual === idCanonicoElegido) {
      return { escribir: false, conflicto: false, ya_existe: true, id_punto: idCanonicoElegido, alias: literal, alias_norm: norm, motivo: 'el literal ya resuelve a ese canonico; no se duplica' };
    }
    // CONFLICTO: el literal ya es alias/canonico de OTRO punto. No se escribe.
    return {
      escribir: false, conflicto: true, ya_existe: true, id_punto: idCanonicoElegido, id_conflicto: duenoActual,
      alias: literal, alias_norm: norm,
      motivo: 'CONFLICTO: "' + literal + '" ya resuelve a ' + duenoActual + '; no puede ser alias de ' + idCanonicoElegido + ' — a cola-puntos.json'
    };
  }
  return {
    escribir: true, conflicto: false, ya_existe: false,
    id_punto: idCanonicoElegido, alias: literal, alias_norm: norm,
    procedencia: procedencia || null,
    motivo: 'alias nuevo "' + literal + '" -> ' + idCanonicoElegido
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizar: normalizar,
    distanciaEdicion: distanciaEdicion,
    resolverPunto: resolverPunto,
    resolverPuntoDocFicha: resolverPuntoDocFicha,
    aprenderAlias: aprenderAlias,
    indexar: indexar
  };
}

// ===== CLIENTES GESRUTA — nombre del cliente -> CODIGO Gesruta ================
//
// El codigo de cliente (RNM = 661, FORESA = 1, ...) es un dato de Gesruta que NO
// estaba en ningun modulo: la planilla y la vista de pendientes mostraban el
// NOMBRE resuelto pero no el codigo. Se mina del export real de facturacion
// PRUEBA_2608_LINEA_FACTURACION.CSV (columna cli_codcli -> cli_nomcli), 35
// clientes reales.
//
// Es un conjunto CERRADO como el resto (materiales, choferes, puntos): se elige
// dentro de la lista por coincidencia de nombre; si no hay match unico, se
// devuelve null con motivo. NUNCA se inventa un codigo.

'use strict';

var CLIG_CRUCE = (typeof norm === 'function') ? { norm: norm } : require('../ficha/cruce.js');

// [codigo, razon social] tal como Gesruta la factura.
var CLIENTES_GESRUTA = [
  ['1', 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.'],
  ['4', 'CLAVO FOOD FACTORY, S.A.'],
  ['10', 'BALTRANSA, S.A.'],
  ['16', 'TRANSP. ALONSO DE PALENCIA, S.L.'],
  ['19', 'TRANSPORTES SANTOS, S.A.'],
  ['20', 'TRANSTAMBRE, S.L.'],
  ['33', 'COMATRA, S.C.L.'],
  ['42', 'BRESFOR IND. DO FORMOL, S.A.'],
  ['64', 'TTES.ARAGUNDE E HIJOS, S.L.'],
  ['212', 'TRANSVEGA E HIJOS, S.L.L.'],
  ['242', 'TAMATA LOGISTICA, S.L.'],
  ['247', 'VICENTE AT LOGISTICA, S.L.'],
  ['268', 'A.G.E. GODOY, S.L.'],
  ['280', 'TRANSPORTES A MARTIN, S.L.U.'],
  ['309', 'FERQUIASTUR, S.L.'],
  ['321', 'FORESTAL DEL ATLANTICO, S.A.'],
  ['323', 'HELM IBERICA, S.A.'],
  ['329', 'ARACHEM, S.A.'],
  ['403', 'QUIMIDROGA, S.A.'],
  ['405', 'ABERRI-TRANS, S.L.'],
  ['450', 'TRANSVASA, S.A.'],
  ['499', 'R.O.R. OPERADOR DE TRANSPORTES, S.L.'],
  ['514', 'QUIMIDROGA PORTUGAL, LDA'],
  ['528', 'ORGANIZ.TRANSPORTES ONATRA, S.L.'],
  ['547', 'TRANSARE 81, S.L.'],
  ['628', 'SOCIEDAD AGRICOLA GALLEGA,SL'],
  ['637', 'QUIMICAS DEL JARAMA, S.A.'],
  ['642', 'AMBERES CHEMICAL, S.A.'],
  ['653', 'AROUSA SEAFOOD, S.L.'],
  ['658', 'TANK SOLUTIONS, S.L.'],
  ['661', 'RNM TRANSPORTES QUIMICOS, LDA'],
  ['662', 'MAXLOGTRANS, S.L.'],
  ['668', 'THINKFORWARD, S.L.'],
  ['670', 'LIQUIADUBOS, LDA'],
  ['672', 'HISPALENSE DE LIQUIDOS SL'],
];

/**
 * Codigo Gesruta de un cliente por su nombre (el que quedo en el viaje, ya sea
 * "RNM" o "RNM TRANSPORTES QUIMICOS, LDA"). Match por token contenido, el mas
 * largo gana (para que "QUIMIDROGA PORTUGAL" no matchee la fila de "QUIMIDROGA").
 *
 * @returns {{codigo:string|null, nombre:string|null, motivo:string|null}}
 */
var GENERICOS = { SL: 1, SA: 1, SAU: 1, SLU: 1, SLL: 1, SCL: 1, LDA: 1, IND: 1,
  DEL: 1, DE: 1, LA: 1, LAS: 1, LOS: 1, DO: 1, QUIMICAS: 1, QUIMICOS: 1, HIJOS: 1, E: 1, Y: 1 };

// norm de cruce.js sube a mayusculas y quita acentos, pero DEJA la puntuacion
// ("BALTRANSA, S.A." -> "BALTRANSA, S.A."), y la coma pegada al token distintivo
// impedia el match. Aca se quita toda puntuacion antes de tokenizar.
function normFuerte(s) {
  return CLIG_CRUCE.norm(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokensSig(nom) {
  return normFuerte(nom).split(' ').filter(function (t) { return t.length >= 3 && !GENERICOS[t]; });
}

/**
 * Codigo Gesruta de un cliente por su nombre (el que quedo en el viaje, sea
 * "RNM" o "RNM TRANSPORTES QUIMICOS, LDA"). Se puntua cada fila por CUANTOS de
 * sus tokens distintivos aparecen en el cliente; gana la de mayor cobertura, y a
 * igualdad, la de tokens mas largos. Asi "QUIMIDROGA" solo -> QUIMIDROGA S.A.
 * (403) y "QUIMIDROGA PORTUGAL" -> QUIMIDROGA PORTUGAL (514).
 *
 * @returns {{codigo:string|null, nombre:string|null, motivo:string|null}}
 */
function codigoCliente(cliente) {
  var cl = normFuerte(cliente);
  if (!cl) { return { codigo: null, nombre: null, motivo: 'cliente_no_leido' }; }
  var mejor = null, mejorCob = 0, mejorLen = 0;
  for (var i = 0; i < CLIENTES_GESRUTA.length; i++) {
    var toks = tokensSig(CLIENTES_GESRUTA[i][1]);
    if (!toks.length) { continue; }
    var cob = 0, len = 0;
    for (var j = 0; j < toks.length; j++) {
      if (cl.indexOf(toks[j]) >= 0) { cob++; len += toks[j].length; }
    }
    // Solo cuenta si AL MENOS un token distintivo aparece.
    if (cob > 0 && (cob > mejorCob || (cob === mejorCob && len > mejorLen))) {
      mejor = CLIENTES_GESRUTA[i]; mejorCob = cob; mejorLen = len;
    }
  }
  if (mejor) { return { codigo: mejor[0], nombre: mejor[1], motivo: null }; }
  return { codigo: null, nombre: null, motivo: 'cliente_sin_codigo_gesruta: ' + (cliente || '(no leido)') };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CLIENTES_GESRUTA: CLIENTES_GESRUTA, codigoCliente: codigoCliente };
}

// ===== VALIDACIONES DE FORMA (Capa 2) — CAMBIO 2 =====================
//
// Chequeos DETERMINISTAS sobre el valor ya leido, self-contained: no dependen
// del correlacionador ni de ningun estado del pipeline. Marcan la CELDA concreta
// que falla una regla de forma, para que en la vista de Pendientes lleve "!".
//
// Son la Capa 2 del "!". La Capa 1 (duda por campo del modelo de extraccion,
// alias `campos_dudosos` en el correlacionador) NO se implementa en este encargo
// (decision D del addendum): tocaria el nodo critico de lectura y queda como
// encargo futuro. Aca solo hay reglas de forma, que no razonan sobre confianza.
//
// Las tres reglas del encargo:
//   (a) patron de matricula (tractora / remolque)
//   (b) fecha de descarga >= fecha de carga
//   (c) cantidad > 0
//
// Filosofia de nulos: una regla NO marca "!" por dato AUSENTE (eso es otro eje:
// falta de documentacion / lectura a revisar, a nivel fila). Marca por dato
// PRESENTE pero mal formado. Excepcion pedida en el encargo: la cantidad 0 /
// vacia / no numerica SI lleva "!" (regla c explicita).

'use strict';

// --- (a) Matricula ---------------------------------------------------------
// Compacta (mayusculas, sin espacios ni guiones) y matchea contra los formatos
// reales que maneja la flota:
//   - actual (2000+):      NNNN LLL           -> 2498KZL, 1234-ABC
//   - remolque (prefijo R): R NNNN LL[L]      -> R1007BCV
//   - historico provincia: L[L] NNNN..NN L[L] -> M1234AB, PO1234K, GC12345
// Vacio -> valida (ausencia no es error de forma; la marca de "!" por forma es
// para un valor presente que no parece matricula, ej. "AVEIRO" en el campo).
var RE_MATRICULA_ACTUAL = /^\d{4}[A-Z]{3}$/;
var RE_MATRICULA_REMOLQUE = /^R\d{4}[A-Z]{2,3}$/;
var RE_MATRICULA_HISTORICA = /^[A-Z]{1,2}\d{4,6}[A-Z]{0,2}$/;

function compactarMatricula(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '');
}

/** ¿El valor tiene forma de matricula? Vacio -> true (no es error de forma). */
function esMatriculaValida(v) {
  var c = compactarMatricula(v);
  if (!c) { return true; }
  return RE_MATRICULA_ACTUAL.test(c) || RE_MATRICULA_REMOLQUE.test(c) || RE_MATRICULA_HISTORICA.test(c);
}

// --- (b) Fechas ------------------------------------------------------------
// Solo compara si AMBAS son fechas ISO parseables. Si falta una o no parsea,
// no se puede afirmar el desorden -> no marca (indeterminado != invalido).
function parseFechaISO(s) {
  if (!s) { return null; }
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
  if (!m) { return null; }
  var t = Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00Z');
  return isFinite(t) ? t : null;
}

/** ¿fecha_descarga >= fecha_carga? Indeterminado (falta o no parsea) -> true. */
function fechasEnOrden(fechaCarga, fechaDescarga) {
  var c = parseFechaISO(fechaCarga);
  var d = parseFechaISO(fechaDescarga);
  if (c === null || d === null) { return true; }
  return d >= c;
}

// --- (c) Cantidad ----------------------------------------------------------
/** ¿cantidad numerica > 0? Vacia / cero / no numerica -> false (regla c). */
function esCantidadValida(x) {
  if (x === null || x === undefined || x === '') { return false; }
  var n = (typeof x === 'number') ? x : Number(String(x).replace(',', '.'));
  return isFinite(n) && n > 0;
}

// --- Cantidad efectiva + unidad de medida ----------------------------------
// La cantidad que se muestra: el peso del documento si existe, si no el de la
// ficha. La unidad de los pesos cargados es kg (el numero sin U.M. miente).
function cantidadDe(viaje) {
  var v = viaje || {};
  var kgDoc = (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? v.kg_documento : null;
  var kgHoja = (typeof v.kg_hoja === 'number' && isFinite(v.kg_hoja)) ? v.kg_hoja : null;
  var valor = (kgDoc !== null) ? kgDoc : kgHoja;
  return { valor: valor, um: 'kg' };
}

// --- Dieta (se lee del JSON `detalle`, no es columna) ----------------------
// Decision C del addendum: la dieta es dato de LECTURA de la ficha (recuadro
// GASTOS DEL VIAJE), vive dentro del JSON `detalle`/gastos. Se lee con
// tolerancia: si el viaje no la trae, celda vacia (nunca "!").
function dietaDeDetalle(detalleStr) {
  if (!detalleStr) { return null; }
  var d;
  try { d = (typeof detalleStr === 'object') ? detalleStr : JSON.parse(detalleStr); } catch (e) { return null; }
  if (!d || typeof d !== 'object') { return null; }
  var gastos = Array.isArray(d.gastos) ? d.gastos : null;
  if (!gastos) { return null; }
  var total = 0;
  var hubo = false;
  for (var i = 0; i < gastos.length; i++) {
    var g = gastos[i] || {};
    if (String(g.tipo || '').toLowerCase() === 'dieta') {
      var imp = (typeof g.importe === 'number') ? g.importe : Number(String(g.importe || '').replace(',', '.'));
      if (isFinite(imp)) { total += imp; hubo = true; }
    }
  }
  return hubo ? total : null;
}

// --- Marcas de forma por celda ---------------------------------------------
/**
 * Devuelve, por campo, la lista de motivos de forma que le ponen "!" a esa
 * celda. Solo incluye campos que fallan; un viaje limpio devuelve {}.
 * Claves usadas: tractora, semi, fecha, fecha_descarga, cantidad.
 * @param {object} viaje  fila de la tabla Viajes.
 * @returns {Object<string,string[]>}
 */
function marcasForma(viaje) {
  var v = viaje || {};
  var marcas = {};
  var push = function (campo, motivo) {
    if (!marcas[campo]) { marcas[campo] = []; }
    marcas[campo].push(motivo);
  };

  if (!esMatriculaValida(v.tractora)) {
    push('tractora', 'matricula con formato invalido: "' + (v.tractora || '') + '"');
  }
  if (!esMatriculaValida(v.semi)) {
    push('semi', 'matricula con formato invalido: "' + (v.semi || '') + '"');
  }
  if (!fechasEnOrden(v.fecha, v.fecha_descarga)) {
    push('fecha', 'fecha de descarga anterior a la de carga');
    push('fecha_descarga', 'fecha de descarga anterior a la de carga');
  }
  var cant = cantidadDe(v);
  if (!esCantidadValida(cant.valor)) {
    push('cantidad', 'cantidad ausente, cero o no numerica');
  }
  return marcas;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esMatriculaValida: esMatriculaValida,
    fechasEnOrden: fechasEnOrden,
    esCantidadValida: esCantidadValida,
    cantidadDe: cantidadDe,
    dietaDeDetalle: dietaDeDetalle,
    marcasForma: marcasForma
  };
}

// ===== VISTA DE PENDIENTES — filtro y render =====
//
// Cierre v1 pieza 2 + v1.1 pieza 1 + CAMBIO 2 (tabla de resultado editable).
//
// Lista consultable de todo lo que quedo esperando algo: falta documentacion
// (estado === 'PENDIENTE_DOCUMENTACION') o la lectura fue dudosa
// (estado_lectura === 'REVISAR', incluye el cliente_no_reconocido de cierre-v1).
// Son DOS EJES independientes (un viaje puede estar en uno, el otro, los dos, o
// ninguno) — el filtro es OR, no AND.
//
// CAMBIO 2: cada viaje se muestra como una fila editable con las columnas reales
// de `viajes` (nombres resueltos; los codigos Gesruta son de la Pieza C, no van).
//   - "!" por celda = validaciones de FORMA (validaciones-forma.js): patron de
//     matricula, fecha descarga >= carga, cantidad > 0. Marca la celda concreta.
//   - Resaltado a nivel FILA: estado_lectura=REVISAR muestra el motivo como
//     observacion (no se puede atribuir a una celda sin campos_dudosos, que es
//     encargo futuro — decision D del addendum).
//   - Faltante de documentacion: marcado PROMINENTE (banda ⚠) con que falta y a
//     quien reclamar (dato ya en la base: PENDIENTE_DOCUMENTACION + pendiente_*).
//   - dieta: se lee del JSON `detalle`/gastos (dato de lectura, no columna); si
//     el viaje no la trae, celda vacia.
//   - Edicion de celda: postea a /webhook/viajes-accion. `cliente` va por el
//     verbo `corregir` (revalida regimen/pais); el resto por `corregir_celda`
//     (sin revalidar, el humano es la autoridad). `confirmar` marca la fila
//     lista para Gesruta (estado_carga -> confirmada).
//
// Lee directo de la tabla `Viajes` (lrBxWpTUxMtO8U48) via el nodo dataTable
// "Leer Viajes".

'use strict';

// Modulo de validaciones de forma: inlineado antes que este archivo en el nodo
// (build-nodo.js), o require en tests.
// Resolvedores de codigo Gesruta (conjunto cerrado). En el nodo se inlinean con
// build-nodo.js; en tests se hace require. cod_origen/cod_destino necesitan el
// catalogo de puntos, que llega por parametro (Leer Puntos Pendientes).
var GES = (typeof resolverMaterial === 'function')
  ? { resolverMaterial: resolverMaterial, resolverChofer: resolverChofer }
  : require('../catalogo/gesruta.js');
var PUN = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto }
  : require('../catalogo/resolver-punto.js');
var CLIG = (typeof codigoCliente === 'function')
  ? { codigoCliente: codigoCliente }
  : require('../catalogo/clientes-gesruta.js');

var VF = (typeof marcasForma === 'function')
  ? { marcasForma: marcasForma, cantidadDe: cantidadDe, dietaDeDetalle: dietaDeDetalle }
  : require('./validaciones-forma.js');

// URL del webhook de acciones. DEBE ser ABSOLUTA: la pagina se sirve desde
// studio-julio.duckdns.org/webhook/viajes-pendientes; una ruta relativa
// ("webhook/viajes-accion") resuelve mal en el navegador (DNS_PROBE_FINISHED_
// NXDOMAIN) y ninguna correccion/confirmacion se guarda. Igual que el HTML de
// ingesta, que postea a su webhook por URL absoluta.
var WEBHOOK_ACCION = 'https://studio-julio.duckdns.org/webhook/viajes-accion';

/** Dias transcurridos desde createdAt, redondeados hacia abajo, nunca negativo. */
function diasEsperando(createdAt, ahoraMs) {
  if (!createdAt) { return null; }
  var t = Date.parse(createdAt);
  if (!isFinite(t)) { return null; }
  var ahora = (typeof ahoraMs === 'number') ? ahoraMs : Date.now();
  return Math.max(0, Math.floor((ahora - t) / 86400000));
}

/**
 * ¿El viaje espera algo? Dos ejes independientes (§3 estado de documentacion,
 * estado_lectura de la ficha/cierre-v1): cualquiera de los dos alcanza.
 */
function esPendiente(v) {
  return v.estado === 'PENDIENTE_DOCUMENTACION' || v.estado_lectura === 'REVISAR';
}

// Lectura de historial_correcciones SOLO para mostrar notas (incidencias) en la
// fila. Copia deliberadamente chica de la logica que vive en
// acciones-pendientes.js (que ESCRIBE el historial), para no inflar este nodo.
function notasDeHistorial(historialStr) {
  if (!historialStr) { return []; }
  var lista;
  try { lista = JSON.parse(historialStr); } catch (e) { return []; }
  if (!Array.isArray(lista)) { return []; }
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var h = lista[i];
    if (h && h.accion === 'incidencia' && h.valor_nuevo) { out.push(h.valor_nuevo); }
  }
  return out;
}

/**
 * Filtra los viajes pendientes, enriquece cada uno con lo que la tabla editable
 * necesita (celdas + marcas de forma + dieta + faltante), calcula dias_esperando
 * y ordena por antiguedad descendente (lo mas viejo primero).
 * @param {Array<object>} viajes  filas crudas de la tabla Viajes.
 * @param {number} [ahoraMs]      instante de referencia (tests deterministas).
 * @returns {Array<object>}
 */
// El campo origen/destino del viaje puede venir ya con formato "CODIGO · NOMBRE"
// (lo arma Preparar Filas Viajes con puntoGesruta). Para la tabla se separa: el
// codigo va a su columna propia y el nombre a la columna origen/destino, sin
// duplicar el codigo pegado al nombre (era el "COGER · COGER" de la captura).
var SEP_PUNTO = ' \u00b7 '; // " · "
function soloNombrePunto(valor) {
  var s = (valor === null || valor === undefined) ? '' : String(valor);
  var i = s.indexOf('\u00b7');
  return (i >= 0) ? s.slice(i + 1).trim() : s.trim();
}
function codigoPunto(valor, puntos) {
  var s = (valor === null || valor === undefined) ? '' : String(valor);
  var i = s.indexOf('\u00b7');
  if (i > 0) { return s.slice(0, i).trim(); }       // ya trae el codigo delante
  var r = PUN.resolverPunto(s, 'documento', puntos); // fila vieja sin codigo: resolver
  return (r && r.id_punto) ? r.id_punto : null;
}

function filtrarPendientes(viajes, ahoraMs, puntos) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var v = lista[i] || {};
    if (!esPendiente(v)) { continue; }
    var cant = VF.cantidadDe(v);
    out.push({
      id: v.id,
      // --- resumen (compat cierre-v1) ---
      fecha_carga: v.fecha || null,
      chofer: v.conductor || null,
      cliente: v.cliente || null,
      ruta: (v.origen || '?') + ' → ' + (v.destino || '?'),
      que_falta: v.pendiente_falta || null,
      reclamar_a: v.pendiente_reclamar_a || null,
      motivo_revision: v.motivo_revision || null,
      dias_esperando: diasEsperando(v.createdAt, ahoraMs),
      notas: notasDeHistorial(v.historial_correcciones),
      // --- ejes de atencion ---
      falta_doc: v.estado === 'PENDIENTE_DOCUMENTACION',
      revisar: v.estado_lectura === 'REVISAR',
      // --- celdas de la tabla editable (valores crudos) ---
      tractora: v.tractora || '',
      semi: v.semi || '',
      conductor: v.conductor || '',
      origen: soloNombrePunto(v.origen),
      destino: soloNombrePunto(v.destino),
      material: v.material || '',
      referencia: v.referencia || '',
      fecha: v.fecha || '',
      fecha_descarga: v.fecha_descarga || '',
      cantidad_valor: cant.valor,
      cantidad_um: cant.um,
      // que columna real corrige la celda "cantidad" (el doc manda; si no, la hoja)
      cantidad_campo: (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? 'kg_documento' : 'kg_hoja',
      regimen_indexacion: v.regimen_indexacion || '',
      km_cargados: (v.km_cargados === null || v.km_cargados === undefined) ? '' : v.km_cargados,
      km_vacios: (v.km_vacios === null || v.km_vacios === undefined) ? '' : v.km_vacios,
      dieta: VF.dietaDeDetalle(v.detalle),
      estado_carga: v.estado_carga || 'pendiente_revision',
      // --- CODIGOS GESRUTA (display, read-only): las columnas amarillas ---
      codigo_cliente: CLIG.codigoCliente(v.cliente).codigo,
      codigo_chofer: GES.resolverChofer(v.conductor).codigo,
      codigo_material: GES.resolverMaterial(v.material).codigo,
      codigo_origen: codigoPunto(v.origen, puntos),
      codigo_destino: codigoPunto(v.destino, puntos),
      // marcas de forma por celda { campo: [motivos] }
      marcas: VF.marcasForma(v)
    });
  }
  out.sort(function (a, b) {
    var da = (a.dias_esperando === null) ? -1 : a.dias_esperando;
    var db = (b.dias_esperando === null) ? -1 : b.dias_esperando;
    if (db !== da) { return db - da; }
    return (a.id || 0) - (b.id || 0);
  });
  return out;
}

// --- HTML: server-rendered, sin framework, sin JS de cliente ----------------
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Motivo(s) de forma de una celda (unido), o '' si esta limpia. */
function marcaDe(p, campo) {
  var m = p.marcas && p.marcas[campo];
  return (m && m.length) ? m.join('; ') : '';
}

/**
 * Celda EDITABLE: valor + form inline [input][✓] que postea al webhook. `cliente`
 * usa el verbo `corregir` (revalida); el resto `corregir_celda` (sin revalidar).
 * El "!" (marca de forma) es una pista visual; corregir el valor lo limpia solo
 * en el proximo render.
 */
function celdaEditable(p, campo, valor, accion, marcaKey) {
  var marca = marcaDe(p, marcaKey || campo); // marcas indexadas por su clave real
  var warn = marca ? ' class="warn"' : '';
  var bang = marca ? '<span class="bang" title="' + escHtml(marca) + '">!</span> ' : '';
  var motivoHidden = marca ? '<input type="hidden" name="motivo" value="' + escHtml(marca) + '">' : '';
  return '<td' + warn + ' data-campo="' + escHtml(campo) + '">' + bang +
    '<form class="cell">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="hidden" name="accion" value="' + accion + '">' +
    '<input type="hidden" name="campo" value="' + escHtml(campo) + '">' +
    motivoHidden +
    '<input type="text" name="valor" value="' + escHtml(valor) + '" size="9">' +
    '<button type="submit" title="Guardar (se acepta como verdad, sin revalidar)">✓</button>' +
    '</form></td>';
}

/** Celda de cantidad: input editable (columna real) + U.M. al lado. */
function celdaCantidad(p) {
  var marca = marcaDe(p, 'cantidad');
  var warn = marca ? ' class="warn"' : '';
  var bang = marca ? '<span class="bang" title="' + escHtml(marca) + '">!</span> ' : '';
  var motivoHidden = marca ? '<input type="hidden" name="motivo" value="' + escHtml(marca) + '">' : '';
  var valor = (p.cantidad_valor === null || p.cantidad_valor === undefined) ? '' : p.cantidad_valor;
  return '<td' + warn + ' data-campo="' + escHtml(p.cantidad_campo) + '">' + bang +
    '<form class="cell">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="hidden" name="accion" value="corregir_celda">' +
    '<input type="hidden" name="campo" value="' + escHtml(p.cantidad_campo) + '">' +
    motivoHidden +
    '<input type="text" name="valor" value="' + escHtml(valor) + '" size="7">' +
    '<span class="um"> ' + escHtml(p.cantidad_um) + '</span>' +
    '<button type="submit" title="Guardar (sin revalidar)">✓</button>' +
    '</form></td>';
}

/** Celda de solo lectura (valor derivado o dato de lectura). */
function celdaDisplay(valor) {
  return '<td>' + escHtml((valor === null || valor === undefined || valor === '') ? '-' : valor) + '</td>';
}

/**
 * Acciones de fila: usuario compartido + valor (cliente/nota) + botones. El
 * cliente va por `corregir` (revalida); resolver/incidencia/confirmar completan.
 */
function accionesHTML(p) {
  return '<form class="acc">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="text" name="usuario" placeholder="Tu nombre" size="9">' +
    '<input type="text" name="valor" placeholder="Cliente correcto / nota" size="14">' +
    '<button type="submit" name="accion" value="corregir" title="Corrige el cliente y re-evalua el regimen (revalida)">Corregir cliente</button>' +
    '<button type="submit" name="accion" value="resolver" title="La documentacion llego por otra via">Marcar resuelto</button>' +
    '<button type="submit" name="accion" value="incidencia" title="Nota libre, no saca el viaje de la lista">Anotar incidencia</button>' +
    '<button type="submit" name="accion" value="confirmar" title="Revisado/ok: lista para Gesruta (estado_carga -> confirmada)">Confirmar viaje</button>' +
    '</form>';
}

var COLS_TABLA = [
  'Matricula tractora', 'Remolque', 'Chofer', 'Cod. chofer',
  'Cliente', 'Cod. cliente', 'Cod. origen', 'Origen', 'Cod. destino', 'Destino',
  'Material', 'Cod. material', 'Referencia', 'Fecha de carga', 'Fecha de descarga', 'Cantidad',
  'Regimen indexacion', 'Km cargado', 'Km vacio', 'Dieta', 'Estado carga', 'Acciones'
];

/** Fila principal (celdas) + fila de observaciones (faltante/motivo/notas). */
function filasDeViaje(p) {
  var main = '<tr data-viaje="' + escHtml(p.id) + '">' +
    celdaEditable(p, 'tractora', p.tractora, 'corregir_celda') +
    celdaEditable(p, 'semi', p.semi, 'corregir_celda') +
    celdaEditable(p, 'conductor', p.conductor, 'corregir_celda') +
    celdaDisplay(p.codigo_chofer) +
    // cliente: no inline por celda; se corrige por la barra de acciones (verbo
    // corregir, que revalida regimen/pais). Aca solo se muestra el valor.
    '<td class="cli">' + escHtml(p.cliente || '-') + '</td>' +
    celdaDisplay(p.codigo_cliente) +
    celdaDisplay(p.codigo_origen) +
    celdaEditable(p, 'origen', p.origen, 'corregir_celda') +
    celdaDisplay(p.codigo_destino) +
    celdaEditable(p, 'destino', p.destino, 'corregir_celda') +
    celdaEditable(p, 'material', p.material, 'corregir_celda') +
    celdaDisplay(p.codigo_material) +
    celdaEditable(p, 'referencia', p.referencia, 'corregir_celda') +
    celdaEditable(p, 'fecha', p.fecha, 'corregir_celda') +
    celdaEditable(p, 'fecha_descarga', p.fecha_descarga, 'corregir_celda') +
    // cantidad: corrige la columna real (kg_documento o kg_hoja); muestra la
    // U.M. al lado (el numero sin unidad miente). Marca indexada por 'cantidad'.
    celdaCantidad(p) +
    celdaDisplay(p.regimen_indexacion) +
    celdaEditable(p, 'km_cargados', p.km_cargados, 'corregir_celda') +
    celdaEditable(p, 'km_vacios', p.km_vacios, 'corregir_celda') +
    celdaDisplay(p.dieta === null ? '' : p.dieta) +
    '<td class="ecarga">' + escHtml(p.estado_carga) + '</td>' +
    '<td>' + accionesHTML(p) + '</td>' +
    '</tr>';

  // Fila de observaciones: faltante de doc PROMINENTE + motivo de revision + notas.
  var obs = [];
  if (p.falta_doc) {
    obs.push('<span class="falta">⚠ FALTA DOC: ' + escHtml(p.que_falta || 'documentacion del viaje') +
      ' — reclamar a: ' + escHtml(p.reclamar_a || '?') + '</span>');
  }
  if (p.revisar && p.motivo_revision) {
    obs.push('<span class="rev">REVISAR: ' + escHtml(p.motivo_revision) + '</span>');
  }
  if (p.notas && p.notas.length) {
    obs.push('<span class="notas">Notas: ' + p.notas.map(escHtml).join(' | ') + '</span>');
  }
  var obsRow = obs.length
    ? '<tr class="obs"><td colspan="' + COLS_TABLA.length + '">' + obs.join(' &nbsp; ') + '</td></tr>'
    : '';
  return main + obsRow;
}

// JS de cliente: envia las acciones por FETCH (no por form nativo), asi la
// pagina NO navega al guardar. El webhook responde JSON {ok, ...} y este script
// actualiza la fila IN-PLACE (quita el "!", refleja estado_carga/cliente). Ante
// error (HTTP !ok, ok:false o red) marca la celda sin navegar ni perder lo
// tipeado. Sin localStorage/sessionStorage/clipboard/createObjectURL: todo el
// estado vive en el DOM durante la sesion.
var SCRIPT_ACCIONES = [
  '(function(){',
  '  var WEBHOOK=' + JSON.stringify(WEBHOOK_ACCION) + ';',
  '  function filaDe(el){while(el&&el.tagName!=="TR"){el=el.parentNode;}return el;}',
  '  function flash(el,cls){if(!el)return;el.classList.add(cls);setTimeout(function(){el.classList.remove(cls);},1600);}',
  '  function limpiarErr(el){if(el){el.classList.remove("err");el.removeAttribute("title");}}',
  '  function aplicar(form,data){',
  '    var tr=filaDe(form), td=form.parentNode;',
  '    if(form.className.indexOf("cell")>=0){',
  '      td.classList.remove("warn");',
  '      var b=td.querySelector(".bang");if(b){b.parentNode.removeChild(b);}',
  '      var mv=form.querySelector(\'[name="motivo"]\');if(mv){mv.parentNode.removeChild(mv);}',
  '      limpiarErr(td);flash(td,"ok");',
  '    }',
  '    if(tr&&data){',
  '      if(data.estado_carga){var ec=tr.querySelector("td.ecarga");if(ec)ec.textContent=data.estado_carga;}',
  '      if(data.accion==="corregir"){var cc=tr.querySelector("td.cli");if(cc)cc.textContent=data.cliente||"-";}',
  '      if(form.className.indexOf("acc")>=0){limpiarErr(td);flash(tr,"ok");}',
  '    }',
  '  }',
  '  function error(form,msg){var td=form.parentNode;td.classList.add("err");td.setAttribute("title",msg||"Error al guardar");}',
  '  document.addEventListener("submit",function(e){',
  '    var form=e.target;',
  '    if(!form||!form.className||(form.className.indexOf("cell")<0&&form.className.indexOf("acc")<0)){return;}',
  '    e.preventDefault();',
  '    var fd=new FormData(form);',
  '    if(e.submitter&&e.submitter.name){fd.append(e.submitter.name,e.submitter.value);}',
  '    var body=new URLSearchParams();fd.forEach(function(v,k){body.append(k,v);});',
  '    if(!body.get("accion")){return;}',
  '    fetch(WEBHOOK,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()})',
  '      .then(function(r){if(!r.ok){throw new Error("HTTP "+r.status);}return r.json().catch(function(){return {ok:true};});})',
  '      .then(function(d){if(d&&d.ok===false){throw new Error(d.error||"accion rechazada");}aplicar(form,d||{});})',
  '      .catch(function(err){error(form,err&&err.message);});',
  '  });',
  '})();'
].join('\n');

/**
 * Pagina HTML autocontenida: tabla editable ordenada por dias_esperando desc.
 * Lista vacia -> mensaje claro. @param {Array<object>} pendientes salida de
 * filtrarPendientes().
 */
function renderHTML(pendientes) {
  var lista = Array.isArray(pendientes) ? pendientes : [];
  var cuerpo;
  if (lista.length === 0) {
    cuerpo = '<tr><td colspan="' + COLS_TABLA.length + '" class="vacio">No hay viajes pendientes ni en revision. Todo al dia.</td></tr>';
  } else {
    cuerpo = lista.map(filasDeViaje).join('');
  }
  var ths = COLS_TABLA.map(function (t) { return '<th>' + escHtml(t) + '</th>'; }).join('');
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<title>Pendientes - Transliquidos Estevez</title>',
    '<style>',
    'body{font-family:system-ui,Arial,sans-serif;margin:1.5rem;background:#f7f7f7;color:#222}',
    'h1{font-size:1.3rem;margin-bottom:.2rem}',
    'p.sub{color:#555;margin-top:0}',
    'table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    'th,td{border:1px solid #ddd;padding:.35rem .45rem;text-align:left;font-size:.82rem;vertical-align:top}',
    'th{background:#333;color:#fff;position:sticky;top:0}',
    '.vacio{text-align:center;padding:2rem;color:#666}',
    'td.warn{background:#fff5d6}',
    '.bang{color:#b34700;font-weight:bold}',
    'td.cli{font-weight:bold}',
    'td.ecarga{white-space:nowrap;color:#555}',
    'form.cell{display:flex;gap:2px;margin:0}',
    'form.cell input[type=text]{padding:.1rem;font-size:.78rem;width:6.5rem}',
    'form.cell button{font-size:.75rem;padding:0 .3rem;cursor:pointer}',
    'form.acc{display:flex;flex-wrap:wrap;gap:.2rem;min-width:230px}',
    'form.acc input{padding:.15rem;font-size:.75rem}',
    'form.acc button{font-size:.72rem;padding:.15rem .35rem;cursor:pointer}',
    'tr.obs td{background:#fbfbfb;font-size:.8rem}',
    '.falta{color:#a11;font-weight:bold}',
    '.rev{color:#b34700}',
    '.notas{color:#555}',
    // feedback in-place del fetch (CAMBIO fetch-acciones): guardado / error.
    'td.ok{background:#d7f5dd !important;transition:background .25s}',
    'tr.ok>td{background:#eafaef}',
    'td.err{outline:2px solid #d11;outline-offset:-2px}',
    '</style></head><body>',
    '<h1>Pendientes (' + lista.length + ')</h1>',
    '<p class="sub">Documentacion faltante o lectura a revisar. Celdas con ! fallan una validacion de forma; corregilas y confirma. Ordenado por antiguedad, lo mas viejo primero.</p>',
    '<table><thead><tr>', ths, '</tr></thead><tbody>',
    cuerpo,
    '</tbody></table>',
    '<script>' + SCRIPT_ACCIONES + '</script>',
    '</body></html>'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    diasEsperando: diasEsperando,
    esPendiente: esPendiente,
    notasDeHistorial: notasDeHistorial,
    filtrarPendientes: filtrarPendientes,
    escHtml: escHtml,
    accionesHTML: accionesHTML,
    renderHTML: renderHTML,
    COLS_TABLA: COLS_TABLA
  };
}

// Nodo Code "Pendientes" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Lee dos tablas por NOMBRE (no por $input, porque los lectores van en serie y
// el input directo es el ultimo de la cadena):
//   - "Leer Viajes": la tabla Viajes (lrBxWpTUxMtO8U48).
//   - "Leer Puntos Pendientes": la tabla puntos (YjxcHHb5B4hT0RFU), para resolver
//     los CODIGOS Gesruta de origen/destino (columnas amarillas).
// Ambos lectores: Execute Once. El de puntos, ademas, Always Output Data (con la
// tabla vacia debe emitir un item, no cero, o el nodo siguiente se saltea).
//
// Toda la logica vive en pendientes.js; build-nodo.js la pega delante.

function _leer(nombre) {
  try { return $(nombre).all().map(function (it) { return it.json || {}; }); } catch (e) { return []; }
}
const viajes = _leer('Leer Viajes');
const puntos = _leer('Leer Puntos Pendientes');
const pendientes = filtrarPendientes(viajes, undefined, puntos);
return [{ json: { html: renderHTML(pendientes), total: pendientes.length } }];
