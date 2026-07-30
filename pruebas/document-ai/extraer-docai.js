// Parsea la respuesta de Document AI a algo chico y legible: texto + confianza por token.
const metas = $('Armar DocAI').all();
const items = $input.all();
return items.map(function (it, i) {
  const meta = metas[i] && metas[i].json ? metas[i].json : {};
  const doc = (it.json && it.json.document) ? it.json.document : {};
  const text = doc.text || '';
  const toks = [];
  const pages = Array.isArray(doc.pages) ? doc.pages : [];
  for (const pg of pages) {
    const tokens = Array.isArray(pg.tokens) ? pg.tokens : [];
    for (const t of tokens) {
      const c = (t.layout && typeof t.layout.confidence === 'number') ? t.layout.confidence : null;
      let seg = '';
      if (t.layout && t.layout.textAnchor && Array.isArray(t.layout.textAnchor.textSegments)) {
        for (const s of t.layout.textAnchor.textSegments) {
          const a = parseInt(s.startIndex || 0, 10), b = parseInt(s.endIndex || 0, 10);
          seg += text.substring(a, b);
        }
      }
      seg = seg.replace(/\s+/g, ' ').trim();
      if (seg) toks.push({ t: seg, c: (c === null ? null : Math.round(c * 1000) / 1000) });
    }
  }
  return { json: { pagina: meta.pagina, banda: meta.banda, text: text.replace(/\s+/g, ' ').slice(0, 400), tokens: toks } };
});
