// Frase inspiradora da mesa (vira um widget do Início no modo mesa).
import React, { useEffect, useState } from 'react';

const FRASES = [
  ['Cada estação treinada é um passo a mais até o seu CRM.', 'Bora para a próxima fase!'],
  ['Hoje você treina; amanhã você atende.', 'Constância vence talento.'],
  ['Errar no treino é o jeito mais barato de acertar na prova.', 'Anote, revise, repita.'],
  ['Um paciente bem acolhido começa com um bom-dia.', 'Comunicação também pontua.'],
  ['Pequenos plantões de estudo, grandes conquistas.', 'Você está mais perto do que imagina.'],
];

/** Frase inspiradora da mesa: troca sozinha a cada 14 s (sem interação). */
export default function FraseMesa() {
  const [i, setI] = useState(() => new Date().getDate() % FRASES.length);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => { setOn(false); setTimeout(() => { setI((k) => (k + 1) % FRASES.length); setOn(true); }, 500); }, 14000);
    return () => clearInterval(t);
  }, []);
  return <p className={`mesa-frase${on ? ' on' : ''}`} aria-live="off"><b>{FRASES[i][0]}</b><small>{FRASES[i][1]}</small></p>;
}

