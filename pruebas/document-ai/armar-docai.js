// A: una llamada por banda recortada. B: pagina completa (para filtrar por bbox).
const resp = $input.first().json || {};
const paginas = Array.isArray(resp.paginas) ? resp.paginas : [];
const out = [];
for (let i = 0; i < paginas.length; i++) {
  const p = paginas[i];
  const regs = Array.isArray(p.regiones) ? p.regiones : [];
  for (const r of regs) {
    if (!r || !r.png_base64) continue;
    out.push({ json: { modalidad: 'A', pagina: i + 1, banda: r.nombre, body: { rawDocument: { content: r.png_base64, mimeType: 'image/png' } } } });
  }
  if (p.png_base64) {
    out.push({ json: { modalidad: 'B', pagina: i + 1, banda: 'PAGINA', body: { rawDocument: { content: p.png_base64, mimeType: 'image/png' } } } });
  }
}
return out;
