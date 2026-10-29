// Barra de ferramentas da sala: fica FIXA no alto (não rola com o resto) e os ícones podem ser reordenados por arrastar e soltar
// (ou Alt + setas no teclado). A ordem é guardada por nome da ferramenta, nunca por posição: ao redimensionar a janela
// ou mudar de papel, nada se perde nem sai do lugar. Em tela estreita a barra rola na horizontal em vez de quebrar linhas.
import React from 'react';
import { useReordenar } from './Quadros.jsx';
import './ferramentas.css';

const P = {
  video: 'M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3zM16 11l5-3v8l-5-3',
  cam: 'M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3M5 11a7 7 0 0 0 14 0M12 18v3',
  pessoas: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M17 11a2.5 2.5 0 1 0 0-5M18 14a4 4 0 0 1 3 4v2',
  convidar: 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M16 11h6',
  estacao: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  transcricao: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  checklist: 'M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M4 20h.01M12 21h8',
  fila: 'M4 6h16M4 12h16M4 18h10',
  pedidos: 'M8 11V5a1.5 1.5 0 0 1 3 0v5M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 14',
  codigo: 'M9 9h10v11H9zM5 15V4h10',
  audio: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  fim: 'M5 21V4M5 4h12l-2 4 2 4H5',
};
export const Ic = ({ n }) => <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] ?? P.estacao} /></svg>;

/** ferramentas: [{ id, rotulo, icone, ativo, aviso(n), aoClicar, desabilitado }] — só entram as que o papel/estado atual permite. */
export default function FerramentasSala({ ferramentas }) {
  const ids = ferramentas.map((f) => f.id);
  const { ordem, propsDe, restaurar, personalizada } = useReordenar('rv_sala_ferramentas', ids);
  const por = Object.fromEntries(ferramentas.map((f) => [f.id, f]));
  return (
    <nav className="fs-barra" aria-label="Ferramentas da sala" data-testid="ferramentas-sala">
      <ul role="list">
        {ordem.map((id) => {
          const f = por[id];
          return (
            <li key={id}>
              <button type="button" className={`fs-bt${f.ativo ? ' on' : ''}`} data-ordem-id={id} data-testid={`ferramenta-${id}`} aria-pressed={f.ativo === undefined ? undefined : Boolean(f.ativo)}
                aria-label={`${f.rotulo} (ferramenta)`} title={`${f.rotulo} — arraste para mudar a ordem`} disabled={f.desabilitado} onClick={f.aoClicar} {...propsDe(id)}>
                <span className="fs-ic"><Ic n={f.icone ?? id} /></span>
                <span className="fs-tx">{f.curto ?? f.rotulo}</span>
                {f.aviso > 0 && <i className="fs-aviso" aria-label={`${f.aviso} pendente(s)`}>{f.aviso}</i>}
              </button>
            </li>
          );
        })}
      </ul>
      {personalizada && <button type="button" className="fs-reset" onClick={restaurar} title="Voltar à ordem original" aria-label="Restaurar a ordem original das ferramentas">↺</button>}
      <span className="fs-dica" id="fs-dica">Arraste os ícones para reorganizar. No teclado: Alt e setas.</span>
    </nav>
  );
}
