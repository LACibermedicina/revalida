// Zoom do sistema: "Ajustar" (automático) reduz a escala em janelas médias para caber todo o conteúdo; manual de 60% a 130%.
import React, { useEffect, useState } from 'react';

import { PASSOS, escalaAuto } from './zoom.js';
const CHAVE = 'rp-zoom';
const lerCfg = () => { try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null'); if (v && (v.modo === 'auto' || (v.modo === 'manual' && PASSOS.includes(v.pct)))) return v; } catch { /* sem storage */ } return { modo: 'auto', pct: 100 }; };

export default function ZoomTela() {
  const [cfg, setCfg] = useState(lerCfg);
  const [larg, setLarg] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => { const f = () => setLarg(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const escala = cfg.modo === 'auto' ? escalaAuto(larg) : cfg.pct / 100;
  useEffect(() => {
    const el = document.documentElement; if (escala === 1) { el.style.removeProperty('zoom'); el.style.removeProperty('--zoom'); } else { el.style.zoom = String(escala); el.style.setProperty('--zoom', String(escala)); }
    return () => { el.style.removeProperty('zoom'); el.style.removeProperty('--zoom'); };
  }, [escala]);
  const salvar = (v) => { setCfg(v); try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem storage */ } };
  const atual = Math.round(escala * 100);
  const passo = (d) => { const i = PASSOS.reduce((m, p, k) => (Math.abs(p - atual) < Math.abs(PASSOS[m] - atual) ? k : m), 0); salvar({ modo: 'manual', pct: PASSOS[Math.max(0, Math.min(PASSOS.length - 1, i + d))] }); };
  return (
    <div className="zoom-tela" role="group" aria-label="Zoom do sistema" data-testid="zoom-tela">
      <button type="button" className="btn mini" onClick={() => passo(-1)} aria-label="Diminuir o zoom" disabled={atual <= PASSOS[0]}>−</button>
      <output aria-live="polite" data-testid="zoom-valor">{atual}%</output>
      <button type="button" className="btn mini" onClick={() => passo(1)} aria-label="Aumentar o zoom" disabled={atual >= PASSOS[PASSOS.length - 1]}>+</button>
      <button type="button" className={`btn mini${cfg.modo === 'auto' ? ' menta' : ''}`} aria-pressed={cfg.modo === 'auto'} onClick={() => salvar({ modo: 'auto', pct: 100 })} title="Ajustar: o zoom se adapta para todo o conteúdo caber na janela" aria-label="Ajustar o zoom à janela">⤢</button>
    </div>
  );
}
