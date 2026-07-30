// Modalidad A: una llamada Document AI por banda recortada.
const resp = $input.first().json || {};
const paginas = Array.isArray(resp.paginas) ? resp.paginas : [];
const out = [];
for (let i = 0; i < paginas.length; i++) {
  const p = paginas[i];
  const regs = Array.isArray(p.regiones) ? p.regiones : [];
  for (const r of regs) {
    if (!r || !r.png_base64) continue;
    out.push({ json: { pagina: i + 1, banda: r.nombre, body: { rawDocument: { content: r.png_base64, mimeType: 'image/png' } } } });
  }
}
return out;
