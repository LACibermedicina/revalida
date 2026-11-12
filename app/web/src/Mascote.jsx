import React from 'react';
import Mascote3D from './Mascote3D.jsx';

/** Mascote do Revalida Prático: o Secreto-Bot de jaleco.
 *  `corpo`: corpo inteiro animado e não interativo (pose parado = sentado, acenando = acenando, em-pe); sem `corpo`, só o avatar redondo. */
export default function Mascote({ corpo = false, pose = 'parado', tamanho = 56, titulo = 'Secreto-Bot, o mascote', className = '' }) {
  if (corpo) return <Mascote3D pose={{ acenando: 'wave', 'em-pe': 'stand' }[pose] || 'sit'} tamanho={tamanho} titulo={titulo} className={className} />;
  return <img className={`mascote mascote-avatar ${className}`} src="/marca/avatar.png" width={tamanho} height={tamanho} alt={titulo} />;
}
