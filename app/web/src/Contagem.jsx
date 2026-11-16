// Contagem regressiva para a próxima prova prática (2ª etapa) do Revalida. A data vem do servidor (/api/prova) e o
// administrador pode mudá-la em Admin › Sistema. Animada: cada número vira como um placar quando muda.
// Interativa: um toque troca a visão (dias-horas-min-seg → semanas → treinos possíveis até a prova).
import React, { useEffect, useState } from 'react';

let cache = null;
const ouvintes = new Set();
export function recarregarProva() {
  cache = fetch('/api/prova').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  cache.then((p) => ouvintes.forEach((f) => f(p)));
  return cache;
}
function useProva() {
  const [p, setP] = useState(null);
  useEffect(() => {
    if (!cache) recarregarProva();
    let vivo = true; cache.then((x) => vivo && setP(x));
    ouvintes.add(setP);
    return () => { vivo = false; ouvintes.delete(setP); };
  }, []);
  return p;
}

/** Um número no estilo placar: quando o valor muda, a peça "vira". */
function Placa({ valor, rotulo, largura = 2 }) {
  const txt = String(valor).padStart(largura, '0');
  return (
    <span className="ct-placa">
      <span className="ct-num" aria-hidden="true">{[...txt].map((d, i) => <b key={`${i}-${d}`} className="ct-dig">{d}</b>)}</span>
      <small>{rotulo}</small>
    </span>
  );
}

const MODOS = ['completo', 'semanas', 'treinos'];

export default function Contagem({ compacta = false }) {
  const p = useProva();
  const [agora, setAgora] = useState(() => Date.now());
  const [modo, setModo] = useState(() => { try { return localStorage.getItem('rv_contagem_modo') || 'completo'; } catch { return 'completo'; } });
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!p) return null;
  const alvo = Date.parse(p.inicio);
  const falta = alvo - agora;
  const dataTxt = new Date(alvo).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const trocar = () => { const n = MODOS[(MODOS.indexOf(modo) + 1) % MODOS.length]; setModo(n); try { localStorage.setItem('rv_contagem_modo', n); } catch { /* ok */ } };

  if (Number.isNaN(alvo)) return null;
  if (falta <= 0) {
    const dia = falta > -2 * 86400000;
    return (
      <div className={`ct ct-fim${compacta ? ' compacta' : ''}`} data-testid="contagem">
        <p className="ct-tit">{p.nome}</p>
        <p className="ct-msg">{dia ? 'É hoje! Respira, apresenta-se ao paciente e segue o roteiro. Boa prova!' : 'Prova realizada. A próxima data aparece aqui assim que for definida.'}</p>
      </div>
    );
  }
  const s = Math.floor(falta / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sg = s % 60;
  const urgente = d < 15;
  let corpo;
  if (modo === 'semanas') corpo = <><Placa valor={Math.floor(d / 7)} rotulo="semanas" /><i className="ct-sep">+</i><Placa valor={d % 7} rotulo="dias" largura={1} /></>;
  else if (modo === 'treinos') corpo = <><Placa valor={d * 2} rotulo="estações, treinando 2 por dia" largura={3} /></>;
  else corpo = <><Placa valor={d} rotulo="dias" largura={d > 99 ? 3 : 2} /><i className="ct-sep">:</i><Placa valor={h} rotulo="horas" /><i className="ct-sep">:</i><Placa valor={m} rotulo="min" /><i className="ct-sep">:</i><Placa valor={sg} rotulo="seg" /></>;

  return (
    <button type="button" className={`ct${urgente ? ' urgente' : ''}${compacta ? ' compacta' : ''}`} onClick={trocar} data-testid="contagem"
      title={`${p.nome} · ${dataTxt}. Toque para mudar a visão.`} aria-label={`Faltam ${d} dias, ${h} horas e ${m} minutos para ${p.nome}, em ${dataTxt}. Toque para mudar a visão.`}>
      <span className="ct-tit"><span className="ct-relogio" aria-hidden="true">⏳</span>Faltam para a prova prática</span>
      <span className="ct-linha" aria-hidden="true">{corpo}</span>
      <span className="ct-data">{compacta ? '' : <><b>{p.nome}</b><br /></>}{dataTxt}{p.definida ? '' : ' · data prevista'}<em> · toque para mudar a visão</em></span>
    </button>
  );
}
