// Nodo Code "Extraer DocAI" del workflow [ESTEVEZ] Ingesta Viaje (WD0q9Ic0oDvUoJwp).
//
// Toma las respuestas de Document AI (una por pagina, en $input) y las empareja
// por indice con las metas de "Preparar DocAI" (que traen el numero de pagina).
// Por cada pagina extrae los odometros de sus 3 bandas de km ya evaluados por la
// guarda de confianza/formato. Toda la logica vive en docai.js (analizarPaginaDocai);
// `node ficha/build-nodo.js` la pega delante de este envoltorio.

const metas = $('Preparar DocAI').all().map(function (it) { return it.json || {}; });
const items = $input.all();
const out = [];
for (let i = 0; i < items.length; i++) {
  const meta = metas[i] || {};
  const doc = (items[i].json && items[i].json.document) ? items[i].json.document : {};
  const bandas = analizarPaginaDocai(doc);
  out.push({ json: { pagina: meta.pagina, km_v1: bandas.km_v1, km_v2: bandas.km_v2, km_v3: bandas.km_v3 } });
}
return out;
