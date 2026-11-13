import React, { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import Mascote3D from './Mascote3D.jsx';

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

/** Cena do login: logomarca + Epi, o mascote da M3D, numa manhã ensolarada, com a trilha até o hospital.
 *  As dicas aparecem sozinhas, uma de cada vez, no balão de fala. */
export default function CenaLogin() {
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setOn(true), 900);
    const t = setInterval(() => {
      setOn(false);
      setTimeout(() => { setI((k) => (k + 1) % DICAS.length); setOn(true); }, 450);
    }, 7000);
    return () => { clearTimeout(a); clearInterval(t); };
  }, []);

  return (
    <section className="cena" aria-label="Epi, o mascote da M3D, no Revalida Prático">
      <div className="cena-marca">
        <Logo tamanho={96} />
        <div><b>Revalida Prático</b><small>Estudos preparatórios · 2ª fase</small></div>
      </div>
      <div className="cena-palco">
        <i className="cena-luz" aria-hidden="true" />
        <Mascote3D fluido pose="sit" titulo="Epi, o mascote da M3D: um robozinho de juta com jaleco, sentado com o balão da m3d.pro." />
        <figure className="cena-placa" aria-hidden="true"><b>REVALIDA.M3D</b><span>Estudos preparatórios</span></figure>
        <div className={`cena-nota${on ? ' on' : ''}`} role="status" aria-live="polite"><span>Dica do Epi</span>{DICAS[i]}</div>
      </div>
    </section>
  );
}
