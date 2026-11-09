import React, { useEffect, useRef, useState } from 'react';

/** Secreto-Bot em 3D (modelo three.js de /secreto-bot-3d.html, embutido em iframe transparente).
 *  `pose`: sit (sentado) | stand (em pé) | wave (acenando). `girar`: gira devagar (respeita "reduzir movimento").
 *  Enquanto o 3D não carrega (ou se o navegador/rede não permitir), mostra a foto do mascote. Arrastar gira; o rosto segue o ponteiro. */
export default function Mascote3D({ pose = 'sit', tamanho = 220, girar = false, zoom = 7.5, titulo = 'Secreto-Bot, o mascote', className = '' }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const ouvir = (e) => { if (e.origin === window.location.origin && e.data && e.data.rv3d === 'ok' && ref.current && e.source === ref.current.contentWindow) setPronto(true); };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);
  const src = `/secreto-bot-3d.html?embed=1&pose=${encodeURIComponent(pose)}&r=${zoom}${girar ? '&auto=1' : ''}`;
  const alt = Math.round(tamanho * 1.05);
  return (
    <div className={`mascote3d ${className}`} style={{ width: tamanho, height: alt }}>
      {!pronto && <img className="mascote3d-foto" src="/marca/secreto-bot.jpg" alt={titulo} width={tamanho} height={alt} />}
      <iframe ref={ref} title={titulo} src={src} loading="lazy" style={{ opacity: pronto ? 1 : 0 }} />
    </div>
  );
}
