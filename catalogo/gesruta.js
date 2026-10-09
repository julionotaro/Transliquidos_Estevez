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
