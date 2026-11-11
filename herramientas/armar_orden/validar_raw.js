// ===== VALIDADOR DEL RAW (lo que se lee del escaneo, ANTES del armador) =======
//
// El armador hace bien las cuentas, pero confia en que el `raw` este bien
// escrito. Este validador atrapa lo que el armador NO ve y que hoy pasa en
// silencio: una clave mal tipeada (dato que se pierde), un numero escrito como
// texto (el armador lo toma como "no vino"), una fecha imposible, la cabeza que
// no corresponde a la matricula, un odometro que retrocede, una referencia que
// ya esta en el registro (juego repetido).
//
//   ERRORES  = el raw esta mal escrito -> NO se arma la orden hasta corregir.
//   AVISOS   = dato sospechoso -> se arma igual, pero hay que mirarlo.
//
// No repite los avisos del armador (cliente/punto/carga sin codigo, tarifa
// pendiente, peso redondo): esos los sigue dando el armador.
//
// uso:  node validar_raw.js <raw.json> [<raw2.json> ...]
//       node validar_raw.js --todos            (todos los de raw/)
// exit 0 = sin errores (puede haber avisos); exit 1 = hay errores.
'use strict';

var fs = require('fs');
var path = require('path');
var datos = require('./lib/datos.js');
var clientes = require('../../ficha/clientes.js');
var clientesGesruta = require('../../catalogo/clientes-gesruta.js');

// ---------- claves permitidas (las que el armador lee) ----------
var CLAVES = {
  raiz: ['empresa', 'escaneo', 'fecha_inicio', 'chofer', 'cabeza', 'proveedor', 'km_proveedor_vacio', 'viajes'],
  viaje: ['matricula', 'cabeza', 'remolque', 'duo_secundario', 'albaranes'],
  albaran: ['cliente_lit', 'origen_lit', 'destino_lit', 'carga_lit', 'referencia', 'salida', 'llegada',
    'peso_kg', 'peso_pendiente', 'peso_ok_redondo', 'precio_fijo', 'idx_incluida', 'idx_pct', 'reparto',
    'km_inicio', 'km_fin', 'km_vacio', 'km_pendiente', 'um',
    'facturacion', 'sentido', 'km_facturable', 'origenes', 'destinos'],
};
var NUMERICAS = ['peso_kg', 'precio_fijo', 'reparto', 'km_inicio', 'km_fin', 'km_vacio', 'km_facturable', 'idx_pct'];
var BOOLEANAS = ['peso_pendiente', 'peso_ok_redondo', 'idx_incluida', 'km_pendiente'];
var TEXTO_OBLIGATORIO = ['cliente_lit', 'origen_lit', 'destino_lit', 'carga_lit', 'salida', 'llegada'];

// limites de plausibilidad (avisos, no errores)
var PESO_MIN = 3000, PESO_MAX = 30000;   // kg de una cisterna
var KM_MIN = 5, KM_MAX = 1800;           // km con carga de un tramo
var SALTO_VACIO_MAX = 1500;              // km en vacio entre dos tramos
var DIAS_ATRAS_MAX = 180;
var TOL_VACIO = 20;                      // km de diferencia tolerada entre vacio declarado y odometro

// ---------- utilidades ----------
function distancia(a, b) { // Levenshtein
  var m = [], i, j;
  for (i = 0; i <= b.length; i++) { m[i] = [i]; }
  for (j = 0; j <= a.length; j++) { m[0][j] = j; }
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
    }
  }
  return m[b.length][a.length];
}
function sugerir(clave, lista) {
  var mejor = null, d = 99;
  lista.forEach(function (k) { var x = distancia(clave, k); if (x < d) { d = x; mejor = k; } });
  return d <= 3 ? mejor : null;
}
function fecha(s) { // dd/mm/aaaa -> Date (UTC) o null si no existe
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || ''));
  if (!m) { return null; }
  var d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return (d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1]) ? d : null;
}
function sinCeros(s) { return String(s).replace(/^0+/, ''); }
function digitos(mat) { var m = /^(\d+)/.exec(String(mat || '')); return m ? m[1] : ''; }
function esClavo(alb) {
  if (alb.facturacion === 'km') { return true; }
  var ident = clientes.resolverCliente(alb.cliente_lit);
  return clientesGesruta.codigoCliente(ident.razonSocial || alb.cliente_lit).codigo === '4';
}
function referenciasDelRegistro() {
  var f = path.join(datos.ROOT, 'datos/registro-procesamiento.csv');
  var set = {};
  if (!fs.existsSync(f)) { return set; }
  fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
    var c = l.split(';');
    if (c.length > 9 && c[9]) { set[c[9]] = c[1]; } // referencia -> escaneo del juego
  });
  return set;
}

function clavesDesconocidas(obj, permitidas, donde, errores) {
  Object.keys(obj).forEach(function (k) {
    if (k[0] === '_' || permitidas.indexOf(k) >= 0) { return; }
    var s = sugerir(k, permitidas);
    errores.push(donde + ': clave desconocida "' + k + '"' + (s ? ' (¿quisiste decir "' + s + '"?)' : '') + ' -> el armador la ignora y ese dato se pierde');
  });
}

// ---------- validacion ----------
// opciones.registro: mapa referencia->escaneo (para detectar juego repetido); false para no chequear.
// opciones.hoy: Date de referencia (tests).
function validarRaw(raw, deps, opciones) {
  opciones = opciones || {};
  var errores = [], avisos = [];
  var flota = (deps && deps.flota) || datos.cargarFlota();
  var registro = (opciones.registro === false) ? {} : (opciones.registro || referenciasDelRegistro());
  var hoy = opciones.hoy || new Date();

  if (!raw || typeof raw !== 'object') { return { errores: ['el raw no es un objeto JSON'], avisos: [] }; }
  clavesDesconocidas(raw, CLAVES.raiz, 'raiz', errores);

  if (['TLE', 'THEC'].indexOf(raw.empresa) < 0) { errores.push('raiz: "empresa" debe ser "TLE" o "THEC" (vino ' + JSON.stringify(raw.empresa) + ')'); }
  if (typeof raw.chofer !== 'string' || !raw.chofer.trim()) { errores.push('raiz: falta "chofer"'); }
  if (typeof raw.cabeza !== 'string' || !raw.cabeza.trim()) {
    errores.push('raiz: "cabeza" debe ser TEXTO entre comillas (vino ' + JSON.stringify(raw.cabeza) + '); como numero se pierde el cero a la izquierda (03729 != 3729)');
  }
  if (!Array.isArray(raw.viajes) || !raw.viajes.length) { errores.push('raiz: falta "viajes" (lista con al menos un viaje)'); return { errores: errores, avisos: avisos }; }

  var refsVistas = {};
  var finPorMatricula = {}; // cadena de odometro por tractora
  var hayClavo = false, hayOtro = false;

  raw.viajes.forEach(function (v, vi) {
    var dv = 'viaje ' + (vi + 1);
    if (!v || typeof v !== 'object') { errores.push(dv + ': no es un objeto'); return; }
    clavesDesconocidas(v, CLAVES.viaje, dv, errores);
    if (typeof v.matricula !== 'string' || !v.matricula.trim()) { errores.push(dv + ': falta "matricula"'); }
    if (!Array.isArray(v.albaranes) || !v.albaranes.length) { errores.push(dv + ': falta "albaranes"'); return; }

    // CABEZA <-> MATRICULA (error real 03/11: cabeza 3729 llevaba a OTRO camion).
    // La cabeza puede declararse POR VIAJE (v.cabeza) cuando un juego tiene mas de
    // una tractora; si no viene, se usa la del raiz (raw.cabeza). Se valida la
    // cabeza EFECTIVA de cada viaje contra SU matricula.
    var mat = String(v.matricula || '').toUpperCase().replace(/[\s-]/g, '');
    var fl = flota[mat];
    if (v.cabeza != null && (typeof v.cabeza !== 'string' || !v.cabeza.trim())) {
      errores.push(dv + ': "cabeza" debe ser TEXTO entre comillas (vino ' + JSON.stringify(v.cabeza) + '); como numero se pierde el cero a la izquierda (03729 != 3729)');
    }
    var cabezaEfectiva = (typeof v.cabeza === 'string' && v.cabeza.trim()) ? v.cabeza : raw.cabeza;
    if (typeof cabezaEfectiva === 'string' && mat) {
      if (fl && fl.cabeza && fl.cabeza !== cabezaEfectiva) {
        errores.push(dv + ': la matricula ' + mat + ' lleva cabeza "' + fl.cabeza + '" en la flota, pero el raw dice "' + cabezaEfectiva + '" -> se cargaria en OTRO camion');
      } else if (sinCeros(cabezaEfectiva) !== sinCeros(digitos(mat))) {
        errores.push(dv + ': la cabeza "' + cabezaEfectiva + '" no corresponde a la matricula ' + mat + ' (deberia ser ' + digitos(mat) + ')');
      }
    }
    if (mat && !/^\d{4}[A-Z]{3}$/.test(mat)) { avisos.push(dv + ': matricula "' + v.matricula + '" con formato inusual (se espera 4 digitos + 3 letras)'); }
    var esAutonomo = !!(fl && fl.tipo === 'autonomo');

    v.albaranes.forEach(function (a, ai) {
      var da = dv + ' albaran ' + (ai + 1) + (a && a.referencia ? ' [' + a.referencia + ']' : '');
      if (!a || typeof a !== 'object') { errores.push(da + ': no es un objeto'); return; }
      clavesDesconocidas(a, CLAVES.albaran, da, errores);

      TEXTO_OBLIGATORIO.forEach(function (k) {
        if (typeof a[k] !== 'string' || !a[k].trim()) { errores.push(da + ': falta "' + k + '"'); }
      });
      NUMERICAS.forEach(function (k) {
        if (k in a && (typeof a[k] !== 'number' || !isFinite(a[k]))) {
          errores.push(da + ': "' + k + '" debe ser un NUMERO sin comillas (vino ' + JSON.stringify(a[k]) + '); como texto el armador lo toma como si no hubiera venido');
        }
      });
      BOOLEANAS.forEach(function (k) {
        if (k in a && typeof a[k] !== 'boolean') { errores.push(da + ': "' + k + '" debe ser true o false (vino ' + JSON.stringify(a[k]) + ')'); }
      });
      if ('sentido' in a && ['S', 'R', 'U', 'C'].indexOf(String(a.sentido).toUpperCase()) < 0) { errores.push(da + ': "sentido" debe ser S, R, U o C'); }
      if ('facturacion' in a && a.facturacion !== 'km') { errores.push(da + ': "facturacion" solo admite "km"'); }
      ['origenes', 'destinos'].forEach(function (k) {
        if (k in a && (!Array.isArray(a[k]) || a[k].some(function (x) { return typeof x !== 'string'; }))) { errores.push(da + ': "' + k + '" debe ser una lista de nombres'); }
      });

      var clavo = false;
      try { clavo = esClavo(a); } catch (e) { clavo = false; }
      if (clavo) { hayClavo = true; } else { hayOtro = true; }

      // REFERENCIA
      var ref = (a.referencia === undefined || a.referencia === null) ? '' : String(a.referencia).trim();
      if (!('referencia' in a)) { errores.push(da + ': falta la clave "referencia" (para CLAVO va vacia: "")'); }
      if (!ref && !clavo) { avisos.push(da + ': referencia VACIA (solo CLAVO va sin referencia)'); }
      if (ref) {
        if (refsVistas[ref]) { avisos.push(da + ': referencia REPETIDA dentro del mismo juego (' + ref + ')'); }
        refsVistas[ref] = true;
        if (registro[ref] && registro[ref] !== raw.escaneo) { avisos.push(da + ': la referencia ' + ref + ' YA ESTA en el registro (juego ' + registro[ref] + ') -> ¿juego repetido?'); }
        var cli = String(a.cliente_lit || '').toUpperCase();
        if (cli.indexOf('FORESA') >= 0 && /^5030/.test(ref)) { avisos.push(da + ': referencia FORESA que empieza en 5030: ese es el numero LARGO; la referencia es el corto (empieza en 20/26)'); }
        if (cli.indexOf('BRESFOR') >= 0 && !/^5050/.test(ref)) { avisos.push(da + ': referencia BRESFOR que no empieza en 5050 (verificar; salvo documento de formato provisorio)'); }
      }

      // FECHAS
      var fs_ = fecha(a.salida), fl_ = fecha(a.llegada);
      if (typeof a.salida === 'string' && a.salida.trim() && !fs_) { errores.push(da + ': "salida" no es una fecha dd/mm/aaaa valida (' + a.salida + ')'); }
      if (typeof a.llegada === 'string' && a.llegada.trim() && !fl_) { errores.push(da + ': "llegada" no es una fecha dd/mm/aaaa valida (' + a.llegada + ')'); }
      if (fs_ && fl_) {
        var dias = (fl_ - fs_) / 86400000;
        if (dias < 0) { errores.push(da + ': la llegada (' + a.llegada + ') es ANTERIOR a la salida (' + a.salida + ')'); }
        else if (dias > 10) { avisos.push(da + ': ' + dias + ' dias entre carga y descarga (verificar fechas)'); }
      }
      if (fs_) {
        var atras = (hoy - fs_) / 86400000;
        if (atras < -1) { avisos.push(da + ': fecha de carga en el FUTURO (' + a.salida + ')'); }
        if (atras > DIAS_ATRAS_MAX) { avisos.push(da + ': fecha de carga de hace mas de ' + DIAS_ATRAS_MAX + ' dias (' + a.salida + ') -> ¿año o mes mal leido?'); }
      }

      // PESO
      if (!clavo && typeof a.precio_fijo !== 'number') {
        if (typeof a.peso_kg !== 'number' && a.peso_pendiente !== true) { avisos.push(da + ': sin peso_kg y sin peso_pendiente -> saldra PESO PENDIENTE'); }
        if (typeof a.peso_kg === 'number' && (a.peso_kg < PESO_MIN || a.peso_kg > PESO_MAX)) {
          avisos.push(da + ': peso ' + a.peso_kg + ' kg fuera de lo habitual (' + PESO_MIN + '-' + PESO_MAX + ') -> ¿TN en vez de kg, o un digito mal leido?');
        }
      }
      if (a.um === 'UN' && typeof a.precio_fijo !== 'number') { avisos.push(da + ': dice um "UN" pero no trae precio_fijo -> el armador lo facturaria por TN'); }
      if (clavo && typeof a.reparto === 'number') { avisos.push(da + ': CLAVO no lleva linea de reparto (REP); el multi-destino ya esta en los km'); }

      // KM / ODOMETRO
      var tieneKm = typeof a.km_inicio === 'number' && typeof a.km_fin === 'number';
      if (tieneKm) {
        var kmc = a.km_fin - a.km_inicio;
        if (kmc <= 0) { errores.push(da + ': km_fin (' + a.km_fin + ') debe ser mayor que km_inicio (' + a.km_inicio + ')'); }
        else if (kmc < KM_MIN || kmc > KM_MAX) { avisos.push(da + ': ' + kmc + ' km con carga, fuera de lo habitual (' + KM_MIN + '-' + KM_MAX + ') -> revisar odometros'); }
        if (typeof a.km_facturable === 'number' && Math.abs(a.km_facturable - kmc) > 5) {
          avisos.push(da + ': km_facturable (' + a.km_facturable + ') no coincide con el odometro (' + kmc + ')');
        }
        if (!v.duo_secundario && mat) {
          var previo = finPorMatricula[mat];
          if (typeof previo === 'number') {
            var vacio = a.km_inicio - previo;
            if (vacio < 0) { avisos.push(da + ': el odometro RETROCEDE (inicio ' + a.km_inicio + ' < fin del tramo anterior ' + previo + ') -> un odometro esta mal leido o los tramos estan desordenados'); }
            else if (vacio > SALTO_VACIO_MAX) { avisos.push(da + ': ' + vacio + ' km en vacio desde el tramo anterior (mas de ' + SALTO_VACIO_MAX + ') -> ¿falta un tramo o un odometro mal leido?'); }
            if (typeof a.km_vacio === 'number' && vacio >= 0 && Math.abs(a.km_vacio - vacio) > TOL_VACIO) {
              avisos.push(da + ': km_vacio declarado (' + a.km_vacio + ') no coincide con el odometro (' + vacio + ')');
            }
          }
          finPorMatricula[mat] = a.km_fin;
        }
      } else if (!a.km_pendiente && !raw.proveedor) {
        avisos.push(da + ': sin km_inicio/km_fin y sin km_pendiente -> saldra KM PENDIENTE');
      }
      if (esAutonomo && tieneKm && typeof a.km_vacio !== 'number') { avisos.push(da + ': chofer AUTONOMO sin km_vacio (sus km van en Gastos; el vacio sale de la ficha)'); }
    });
  });

  // EMPRESA / PROVEEDOR (reglas confirmadas por Julio)
  if (raw.empresa === 'THEC' && hayOtro && !raw.proveedor) {
    avisos.push('raiz: empresa "THEC" con clientes que no son CLAVO: un viaje de THEC para esos clientes se carga en el perfil TLE como PROVE -> empresa "TLE" + "proveedor": "5"');
  }
  if (raw.proveedor && hayClavo) {
    avisos.push('raiz: trae "proveedor" y el cliente es CLAVO: CLAVO con chofer THEC NO va por PROVE; el armador lo manda al perfil THEC (empresa THEC, cabecera normal)');
  }
  return { errores: errores, avisos: avisos };
}

module.exports = { validarRaw: validarRaw, CLAVES: CLAVES };

// ---------- CLI ----------
if (require.main === module) {
  var args = process.argv.slice(2);
  var archivos = args.filter(function (a) { return a.slice(0, 2) !== '--'; });
  var sinRegistro = args.indexOf('--sin-registro') >= 0;
  if (args.indexOf('--todos') >= 0) {
    var dir = path.join(__dirname, 'raw');
    archivos = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).map(function (f) { return path.join(dir, f); });
  }
  if (!archivos.length) { console.error('uso: node validar_raw.js <raw.json> [...] | --todos   [--sin-registro]'); process.exit(2); }
  var deps = { flota: datos.cargarFlota() };
  var totalErr = 0, totalAv = 0;
  archivos.forEach(function (f) {
    var raw;
    try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.log('\n' + path.basename(f) + '\n  ❌ JSON invalido: ' + e.message); totalErr++; return; }
    var r = validarRaw(raw, deps, { registro: sinRegistro ? false : undefined });
    totalErr += r.errores.length; totalAv += r.avisos.length;
    console.log('\n' + path.basename(f) + '  ' + (r.errores.length ? '❌ ' + r.errores.length + ' error(es)' : '✅ sin errores') + (r.avisos.length ? ' · ' + r.avisos.length + ' aviso(s)' : ''));
    r.errores.forEach(function (e) { console.log('  ❌ ' + e); });
    r.avisos.forEach(function (a) { console.log('  ⚠️  ' + a); });
  });
  console.log('\n' + (totalErr ? 'RAW CON ERRORES — ' + totalErr + ' error(es): corregir antes de armar la orden' : 'RAW OK') + (totalAv ? ' (' + totalAv + ' aviso(s) para mirar)' : ''));
  process.exit(totalErr ? 1 : 0);
}
