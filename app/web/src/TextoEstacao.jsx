// Apresentação legível do texto de uma estação (cenário, instruções, roteiro, materiais): títulos, listas, pares "rótulo: valor" em
// grade, e destaque de medidas (PA, FC, doses, temperatura…) sem alterar uma palavra do conteúdo. Só estrutura e estilo.
import React from 'react';
import './texto-estacao.css';

const ITEM = /^(?:[•\-*–]|\d{1,2}[.)]|[a-z][.)])\s+(.*)$/i;
const NUM = /^\d{1,2}[.)]\s/;
const TITULO_MD = /^#{1,4}\s+(.*)$/;
const CAIXA_ALTA = (l) => l.length >= 4 && l.length <= 48 && l === l.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(l) && !/\d{3,}/.test(l);
const TERMINA_DOIS_PONTOS = (l) => /^[^:]{2,48}:$/.test(l);
const PAR = /^([A-ZÀ-Ú][\wÀ-ÿ/().%+ -]{1,30}?):\s+(\S.*)$/;
const MEDIDA = /(\b\d{1,3}(?:[.,]\d+)?\s?(?:x\s?\d{1,3}(?:[.,]\d+)?\s?)?(?:mmHg|bpm|irpm|rpm|°C|ºC|%|mg\/dL|mg\/kg|mg|mcg|µg|g\/dL|mL|ml|kg|cm|mm|UI|U\/L|mEq\/L|mmol\/L|SpO2|semanas|dias|horas|h|min)\b)/gi;

/** Divide o texto em blocos tipados. Exportada para teste e reutilização. */
export function formatarTexto(corpo) {
  const linhas = String(corpo ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocos = []; let lista = null; let pares = null;
  const fecha = () => { lista = null; pares = null; };
  for (const l of linhas) {
    const md = l.match(TITULO_MD);
    if (md) { fecha(); blocos.push({ tipo: 'titulo', texto: md[1] }); continue; }
    if (CAIXA_ALTA(l) || TERMINA_DOIS_PONTOS(l)) { fecha(); blocos.push({ tipo: 'titulo', texto: l.replace(/:$/, '') }); continue; }
    const it = l.match(ITEM);
    if (it) {
      const num = NUM.test(l);
      if (!lista || lista.num !== num) { lista = { tipo: 'lista', num, itens: [] }; blocos.push(lista); }
      pares = null; lista.itens.push(it[1]); continue;
    }
    const par = l.match(PAR);
    if (par && par[1].split(' ').length <= 4) {
      if (!pares) { pares = { tipo: 'pares', itens: [] }; blocos.push(pares); }
      lista = null; pares.itens.push([par[1], par[2]]); continue;
    }
    fecha(); blocos.push({ tipo: 'p', texto: l });
  }
  return blocos;
}

/** Realça medidas e unidades (só estilo). */
export function Realce({ texto }) {
  const partes = String(texto).split(MEDIDA);
  return <>{partes.map((x, i) => (i % 2 ? <mark key={i} className="tx-val">{x}</mark> : <React.Fragment key={i}>{x}</React.Fragment>))}</>;
}

export default function TextoEstacao({ corpo, compacto = false }) {
  const blocos = formatarTexto(corpo);
  if (blocos.length === 0) return null;
  return (
    <div className={`tx${compacto ? ' compacto' : ''}`} data-testid="texto-estacao">
      {blocos.map((b, i) => {
        if (b.tipo === 'titulo') return <h5 key={i} className="tx-tit">{b.texto}</h5>;
        if (b.tipo === 'lista') { const L = b.num ? 'ol' : 'ul'; return <L key={i} className="tx-lista">{b.itens.map((x, k) => <li key={k}><Realce texto={x} /></li>)}</L>; }
        if (b.tipo === 'pares') return <dl key={i} className="tx-pares">{b.itens.map(([r, v], k) => <React.Fragment key={k}><dt>{r}</dt><dd><Realce texto={v} /></dd></React.Fragment>)}</dl>;
        return <p key={i} className="tx-p"><Realce texto={b.texto} /></p>;
      })}
    </div>
  );
}
