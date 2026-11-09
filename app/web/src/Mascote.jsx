import React from 'react';
import Mascote3D from './Mascote3D.jsx';

/** Mascote do Revalida Prático: o Secreto-Bot (foto + modelo 3D em /secreto-bot-3d.html).
 *  `corpo`: corpo inteiro em 3D (pose parado = sentado, acenando = acenando); sem `corpo`, só o avatar redondo (imagem leve, sem WebGL). */
export default function Mascote({ corpo = false, pose = 'parado', tamanho = 56, titulo = 'Secreto-Bot, o mascote', className = '' }) {
  if (corpo) return <Mascote3D pose={{ acenando: 'wave', 'em-pe': 'stand' }[pose] || 'sit'} tamanho={tamanho} titulo={titulo} className={className} />;
  return <img className={`mascote mascote-avatar ${className}`} src="/marca/avatar.png" width={tamanho} height={tamanho} alt={titulo} />;
}
