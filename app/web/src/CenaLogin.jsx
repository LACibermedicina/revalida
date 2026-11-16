import React, { useEffect, useRef, useState } from 'react';
import Logo, { Wordmark } from './Logo.jsx';
import Mascote3D from './Mascote3D.jsx';
import { createPortal } from 'react-dom';
import Pets from './Pets.jsx';
import Contagem from './Contagem.jsx';

const DICAS = [
  'Leia o enunciado com calma: um minuto lendo evita três minutos corrigindo o rumo.',
  'Apresente-se e explique o que vai fazer. O PEP pontua a comunicação.',
  'Higienize as mãos antes do exame físico. É ponto fácil.',
  'Resuma o caso em voz alta antes da conduta: organiza você e o examinador.',
  'Treine em dupla, com cronômetro. O tempo faz parte da prova.',
  'Itens críticos do PEP pesam muito: priorize a conduta segura.',
  'Feche com orientações e pergunte se o paciente tem dúvidas.',
  'Depois de cada estação, anote o que errou. O caderno de erros agradece.',
];

/** Cena do login. No computador, o Epi fica direto sobre o fundo do hospital (sem moldura), os cachorrinhos passeiam
 *  pelo chão e o fundo acompanha o mouse de leve. Tocar no Epi troca a dica e ele responde com um gesto.
 *  No celular continua o quadro compacto. Com "reduzir movimento", nada se mexe sozinho. */
export default function CenaLogin() {
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);
  const [cutuca, setCutuca] = useState(0);
  const [largo, setLargo] = useState(() => document.documentElement.dataset.layout === 'largo');
  const ciclo = useRef(0);

  const trocar = (passo = 1) => {
    setOn(false);
    setTimeout(() => { setI((k) => (k + passo + DICAS.length) % DICAS.length); setOn(true); }, 300);
  };
  // dicas automáticas; um toque reinicia a contagem para a dica nova não sumir logo
  useEffect(() => {
    const a = setTimeout(() => setOn(true), 900);
    ciclo.current = setInterval(() => trocar(), 9000);
    return () => { clearTimeout(a); clearInterval(ciclo.current); };
  }, []);
  const tocar = () => {
    clearInterval(ciclo.current); ciclo.current = setInterval(() => trocar(), 9000);
    trocar(); setCutuca((n) => n + 1);
  };

  // layout largo (computador) x compacto
  useEffect(() => {
    const ob = new MutationObserver(() => setLargo(document.documentElement.dataset.layout === 'largo'));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout'] });
    return () => ob.disconnect();
  }, []);

  // fundo com profundidade: desloca poucos pixels seguindo o mouse
  useEffect(() => {
    const raiz = document.documentElement;
    if (!largo || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let q = 0;
    const mover = (e) => {
      if (q) return;
      q = requestAnimationFrame(() => {
        q = 0;
        raiz.style.setProperty('--px', `${((e.clientX / innerWidth) - 0.5) * -18}px`);
        raiz.style.setProperty('--py', `${((e.clientY / innerHeight) - 0.5) * -10}px`);
      });
    };
    addEventListener('pointermove', mover, { passive: true });
    return () => { removeEventListener('pointermove', mover); cancelAnimationFrame(q); raiz.style.removeProperty('--px'); raiz.style.removeProperty('--py'); };
  }, [largo]);

  return (
    <section className="cena" aria-label="Epi, o mascote da M3D, no Revalida Prático">
      <div className="cena-marca">
        <Logo tamanho={96} />
        <div><b><Wordmark /></b><small>Estudos preparatórios · 2ª fase</small></div>
      </div>
      <Contagem compacta />
      <div className="cena-palco">
        <i className="cena-luz" aria-hidden="true" />
        <Mascote3D fluido pose="sit" cutucar={cutuca} titulo="Epi, o mascote da M3D: um robozinho de juta com jaleco, sentado com o balão da m3d.pro." />
        <button type="button" className="cena-toque" onClick={tocar} aria-label="Ver outra dica do Epi" />
        <div className={`cena-nota${on ? ' on' : ''}`} role="status" aria-live="polite">
          <span>Dica do Epi</span>{DICAS[i]}
          <small>Toque no Epi para outra dica</small>
        </div>
      </div>
      {largo && createPortal(<div className="login-chao" aria-hidden="true"><Pets reserva={0} /></div>, document.body)}
    </section>
  );
}
