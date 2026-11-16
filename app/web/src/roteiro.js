// Leitura do roteiro do ator: "## Argumento" + pares "P:"/"R:" (e roteiros antigos em texto corrido).
/** Converte o texto do roteiro em argumentos com pares pergunta/resposta. */
export function lerRoteiro(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n');
  const args = [];
  let atual = null;
  const novo = (nome) => { atual = { nome: nome.trim() || 'Roteiro', itens: [] }; args.push(atual); };
  for (const bruta of linhas) {
    const l = bruta.trim();
    if (!l) continue;
    const titulo = /^#{1,4}\s*(.+)$/.exec(l) || /^\*\*(.+?)\*\*:?$/.exec(l) || /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.?!:]{2,60}):$/.exec(l);
    if (titulo) { novo(titulo[1].replace(/:$/, '')); continue; }
    if (!atual) novo('Roteiro');
    const p = /^(?:P|Pergunta|Médico|Medico)\s*[:\-–]\s*(.+)$/i.exec(l);
    const r = /^(?:R|Resposta|Paciente)\s*[:\-–]\s*(.+)$/i.exec(l);
    if (p) { atual.itens.push({ p: p[1], r: '' }); continue; }
    if (r) {
      const ult = atual.itens[atual.itens.length - 1];
      if (ult && !ult.r && ult.p) ult.r = r[1]; else atual.itens.push({ p: '', r: r[1] });
      continue;
    }
    // texto corrido (roteiros antigos): "Se perguntado sobre X: resposta" vira par; o resto vira um item por linha
    const se = /^[-•*]?\s*(?:se (?:for )?pergunt(?:ad[oa]|arem)\s+(?:sobre|se|por)?\s*)(.+?)[:,–-]\s*(.+)$/i.exec(l);
    if (se) { atual.itens.push({ p: se[1], r: se[2] }); continue; }
    atual.itens.push({ p: '', r: l.replace(/^[-•*]\s*/, '') });
  }
  return args.filter((a) => a.itens.length);
}

