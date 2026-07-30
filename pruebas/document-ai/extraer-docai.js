const metas = $('Armar DocAI').all();
const items = $input.all();
const BANDAS = { band_matricula: [0.15, 0.212], km_v1: [0.29, 0.35], km_v2: [0.425, 0.485], km_v3: [0.565, 0.625] };
function tokenText(text, layout) { let s = ''; if (layout && layout.textAnchor && Array.isArray(layout.textAnchor.textSegments)) { for (const seg of layout.textAnchor.textSegments) { const a = parseInt(seg.startIndex || 0, 10), b = parseInt(seg.endIndex || 0, 10); s += text.substring(a, b); } } return s.replace(/\s+/g, ' ').trim(); }
function ctr(layout, k) { try { const v = layout.boundingPoly.normalizedVertices; let s = 0, n = 0; for (const p of v) { if (typeof p[k] === 'number') { s += p[k]; n++; } } return n ? s / n : null; } catch (e) { return null; } }
const out = [];
for (let i = 0; i < items.length; i++) {
  const meta = metas[i] && metas[i].json ? metas[i].json : {};
  const doc = (items[i].json && items[i].json.document) ? items[i].json.document : {};
  const text = doc.text || '';
  const pages = Array.isArray(doc.pages) ? doc.pages : [];
  if (meta.modalidad === 'A') {
    const toks = [];
    for (const pg of pages) { for (const t of (pg.tokens || [])) { const seg = tokenText(text, t.layout); const c = (t.layout && typeof t.layout.confidence === 'number') ? Math.round(t.layout.confidence * 1000) / 1000 : null; if (seg) toks.push({ t: seg, c: c }); } }
    out.push({ json: { modalidad: 'A', pagina: meta.pagina, banda: meta.banda, text: text.replace(/\s+/g, ' ').slice(0, 300), tokens: toks } });
  } else {
    const pg = pages[0] || {};
    const toks = Array.isArray(pg.tokens) ? pg.tokens : [];
    const porBanda = {}; for (const n in BANDAS) porBanda[n] = [];
    for (const t of toks) {
      const cy = ctr(t.layout, 'y'), cx = ctr(t.layout, 'x');
      if (cy === null) continue;
      const seg = tokenText(text, t.layout);
      if (!/\d/.test(seg)) continue;
      const c = (t.layout && typeof t.layout.confidence === 'number') ? Math.round(t.layout.confidence * 1000) / 1000 : null;
      for (const n in BANDAS) { const r = BANDAS[n]; if (cy >= r[0] && cy <= r[1]) porBanda[n].push({ t: seg, c: c, x: cx }); }
    }
    for (const n in porBanda) { porBanda[n].sort(function (a, b) { return a.x - b.x; }); out.push({ json: { modalidad: 'B', pagina: meta.pagina, banda: n, tokens: porBanda[n].map(function (o) { return { t: o.t, c: o.c }; }) } }); }
  }
}
return out;
