// Criação de estações: lista, geração por IA, importação (pacote .rvpack, PDF/imagem), editor e exportação.
// Serve a versão web e a desktop (o Electron abre esta mesma tela; os diálogos de arquivo são os do próprio navegador).
// Tudo que vem da IA ou de arquivo entra como RASCUNHO e só vira estação depois que a pessoa revisa e publica.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './estacoes.css';

const AREAS = [['clinica_medica', 'Clínica Médica'], ['cirurgia', 'Cirurgia'], ['ginecologia_obstetricia', 'Ginecologia e Obstetrícia'], ['pediatria', 'Pediatria'], ['mfc', 'Medicina de Família e Comunidade']];
const TIPOS = [['laboratorial', 'Exame laboratorial'], ['imagem', 'Imagem'], ['biopsia', 'Biópsia'], ['laudo', 'Laudo'], ['outro', 'Outro']];
const DIFICULDADES = ['básica', 'intermediária', 'avançada'];
const ORIGEM = { ia: ['ia', 'Gerada por IA'], importada: ['imp', 'Importada'], manual: ['manual', 'Manual'], inep: ['imp', 'INEP'], comunidade: ['manual', 'Comunidade'] };
const STATUS = { rascunho: ['rasc', 'Rascunho'], revisao: ['rev', 'Em revisão'], aprovada: ['apr', 'Aprovada'] };
const MAX_ARQUIVO = 8 * 1024 * 1024;
const MIME_POR_EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const nomeArea = (a) => AREAS.find(([k]) => k === a)?.[1] ?? a;
const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

/** Baixa um texto como arquivo (no desktop o Electron abre a janela de "salvar como"). */
function baixar(nome, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const lerTexto = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('Não consegui ler o arquivo.')); r.readAsText(f); });
const lerBase64 = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => no(new Error('Não consegui ler o arquivo.')); r.readAsDataURL(f); });

/** Campo com rótulo e marca de "conferir". Fica FORA do editor: declarado dentro, remontaria os campos a cada tecla. */
function Campo({ rotulo, incerto, children }) {
  return <label className={`campo${incerto ? ' incerto' : ''}`}><span>{rotulo}{incerto && <em className="est-conferir"> conferir</em>}</span>{children}</label>;
}
function Espera({ children }) { return <div className="est-espera" role="status"><i className="est-giro" aria-hidden="true" />{children}</div>; }

/* ======================= tela principal ======================= */
export default function TelaEstacoes({ token, usuario, api, comando }) {
  const [vista, setVista] = useState('lista');             // lista | gerar | importar | editor
  const [lista, setLista] = useState(null);
  const [ia, setIa] = useState(null);
  const [marcadas, setMarcadas] = useState(new Set());
  const [editorId, setEditorId] = useState(null);
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState({ t: '', e: false });
  const dicaExportar = useRef(null);

  const carregar = useCallback(async () => {
    try { setLista(await api('/api/estacoes/minhas', { token })); } catch (e) { setLista([]); setMsg({ t: e.message, e: true }); }
  }, [api, token]);
  useEffect(() => { carregar(); api('/api/ia/estado', { token }).then(setIa).catch(() => setIa({ configurado: false })); }, [api, token, carregar]);

  // pedidos vindos do menu da versão desktop
  useEffect(() => {
    if (comando?.abrir) { setEditorId(comando.abrir); setNota(comando.nota ?? ''); setVista('editor'); return; }
    if (!comando?.aba) return;
    if (comando.aba === 'novo') { setEditorId('novo'); setNota(''); setVista('editor'); }
    else if (comando.aba === 'exportar') { setVista('lista'); setMarcadas(new Set((lista ?? []).map((x) => x.id))); setTimeout(() => dicaExportar.current?.focus?.(), 50); }
    else if (['gerar', 'importar', 'lista'].includes(comando.aba)) setVista(comando.aba);
  }, [comando?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (id, texto = '') => { setEditorId(id); setNota(texto); setVista('editor'); };
  const alternar = (id) => setMarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportar = async (ids) => {
    setMsg({ t: '', e: false });
    try {
      const pacote = await api('/api/estacoes/exportar', { metodo: 'POST', token, corpo: { ids } });
      baixar(`revalida-estacoes-${new Date().toISOString().slice(0, 10)}.rvpack`, JSON.stringify(pacote));
      setMsg({ t: `${ids.length} estaç${ids.length === 1 ? 'ão exportada' : 'ões exportadas'}.`, e: false });
    } catch (e) { setMsg({ t: e.message, e: true }); }
  };
  const voltar = () => { setVista('lista'); carregar(); };

  if (vista === 'gerar') return <Gerar token={token} api={api} ia={ia} aoPronta={(id, txt) => abrir(id, txt)} aoVoltar={voltar} />;
  if (vista === 'importar') return <Importar token={token} api={api} ia={ia} aoAbrir={(id, txt) => abrir(id, txt)} aoVoltar={voltar} />;
  if (vista === 'editor') return <Editor key={editorId} id={editorId} token={token} usuario={usuario} api={api} nota={nota} aoVoltar={voltar} aoExportar={(id) => exportar([id])} aoAbrir={abrir} ia={ia} />;

  return (
    <div className="tela est-tela">
      <div className="est-topo"><h2>Estações</h2>
        <div className="est-acoes" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn mini" onClick={() => abrir('novo')}>Nova</button>
          <button type="button" className="btn mini menta" onClick={() => setVista('gerar')}>Gerar com IA</button>
          <button type="button" className="btn mini" onClick={() => setVista('importar')}>Importar</button>
        </div>
      </div>
      <p className="sub">Crie do zero, gere por IA ou importe. Tudo que vem de IA ou de arquivo entra como rascunho e só vira estação depois da sua revisão.</p>
      <div className="est-topo">
        <span className="sub">{lista ? `${lista.length} estaç${lista.length === 1 ? 'ão' : 'ões'}` : 'Carregando…'}</span>
        <button type="button" ref={dicaExportar} className="btn mini" disabled={marcadas.size === 0} onClick={() => exportar([...marcadas])}>Exportar selecionadas ({marcadas.size})</button>
      </div>
      <div className={`msg${msg.e ? ' e' : ''}`} role="status">{msg.t}</div>
      {lista && lista.length === 0 && <div className="cartao"><p className="sub">Você ainda não criou nenhuma estação. Comece por <b>Gerar com IA</b> ou <b>Nova</b>.</p></div>}
      <div className="est-lista">
        {(lista ?? []).map((x) => {
          const [oc, ot] = ORIGEM[x.origem] ?? ['manual', x.origem];
          const [sc, st] = STATUS[x.status] ?? ['rasc', x.status];
          return (
            <div className="est-item" key={x.id}>
              <input type="checkbox" checked={marcadas.has(x.id)} onChange={() => alternar(x.id)} aria-label={`Selecionar ${x.titulo}`} />
              <div className="corpo">
                <button type="button" className="abrir" onClick={() => abrir(x.id)}>{x.titulo}</button>
                <span className="sub">{nomeArea(x.area)} · {x.duracao_min} min</span>
                <div className="est-tags">
                  <span className={`tag ${oc}`}>{ot}</span><span className={`tag ${sc}`}>{st}</span>
                  {x.incertos > 0 && <span className="tag conf">{x.incertos} a conferir</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ======================= gerar por IA ======================= */
function Gerar({ token, api, ia, aoPronta, aoVoltar }) {
  const [f, setF] = useState({ area: '', subtema: '', dificuldade: '', instrucoes: '', prioridade: '', cenario: '', perfil: '', queixa: '', diagnostico_alvo: '', objetivos: '' });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const gerar = async () => {
    setErro(''); setOcupado(true);
    try {
      const { objetivos, ...resto } = f;
      const r = await api('/api/estacoes/gerar', { metodo: 'POST', token, corpo: { ...resto, objetivos: objetivos.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6) } });
      const rot = { area: 'a área', subtema: 'o tema', dificuldade: 'a dificuldade' };
      const sorteados = (r.sorteados ?? []).map((k) => rot[k]).filter(Boolean);
      aoPronta(r.id, sorteados.length ? `O sistema sorteou ${sorteados.join(', ')} porque você deixou em branco. Revise tudo antes de publicar.` : 'Revise tudo antes de publicar.');
    } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  const semIA = ia && !ia.configurado;
  return (
    <div className="tela est-tela">
      <div className="est-topo"><h2>Gerar com IA</h2><button type="button" className="ln" onClick={aoVoltar}>Voltar</button></div>
      {semIA && <div className="aviso" role="alert">A IA não está configurada neste servidor. Peça ao administrador para cadastrar uma chave de IA.</div>}
      <div className="cartao est-form">
        <p className="est-ajuda">Deixe em branco o que quiser que o sistema escolha: a área, o tema e a dificuldade são sorteados e você vê o que foi sorteado.</p>
        <div className="est-grade">
          <label className="campo"><span>Área</span>
            <select value={f.area} onChange={set('area')}><option value="">Sortear</option>{AREAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="campo"><span>Dificuldade</span>
            <select value={f.dificuldade} onChange={set('dificuldade')}><option value="">Sortear</option>{DIFICULDADES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
        </div>
        <label className="campo"><span>Tema</span><input value={f.subtema} maxLength={120} onChange={set('subtema')} placeholder="Ex.: pré-eclâmpsia (ou deixe em branco)" /></label>
        <label className="campo"><span>Se o tema ficar em branco, sortear entre</span>
          <select value={f.prioridade} onChange={set('prioridade')} disabled={!!f.subtema.trim()}>
            <option value="">Todos os temas</option><option value="relevantes">Os mais relevantes (base de referência)</option><option value="fracos">Meus pontos mais fracos</option>
          </select></label>
        <details className="est-modelo"><summary>Modelo da estação (opcional)</summary>
          <div className="est-grade">
            <label className="campo"><span>Cenário de atendimento</span><input value={f.cenario} maxLength={200} onChange={set('cenario')} placeholder="UBS, pronto-socorro, ambulatório…" /></label>
            <label className="campo"><span>Perfil do paciente</span><input value={f.perfil} maxLength={200} onChange={set('perfil')} placeholder="Mulher, 45 anos" /></label>
          </div>
          <label className="campo"><span>Queixa principal</span><input value={f.queixa} maxLength={300} onChange={set('queixa')} placeholder="Dispneia súbita e tosse seca" /></label>
          <label className="campo"><span>Diagnóstico alvo</span><input value={f.diagnostico_alvo} maxLength={200} onChange={set('diagnostico_alvo')} placeholder="Asma agudizada" /></label>
          <label className="campo"><span>Objetivos de avaliação (um por linha, até 6)</span><textarea value={f.objetivos} maxLength={1500} onChange={set('objetivos')} placeholder={'Investigar fatores desencadeantes\nPrescrever broncodilatador de resgate'} /></label>
        </details>
        <label className="campo"><span>Instruções extras (opcional)</span>
          <textarea value={f.instrucoes} maxLength={2000} onChange={set('instrucoes')} placeholder="Ex.: paciente idoso, atendimento na UPA, com exame de imagem para liberar." /></label>
        {ocupado && <Espera>Gerando a estação… isso pode levar até um minuto.</Espera>}
        <div className="msg e" role="alert">{erro}</div>
        <button type="button" className="btn menta" disabled={ocupado || semIA} onClick={gerar}>{ocupado ? 'Gerando…' : 'Gerar estação'}</button>
        <p className="est-ajuda">O texto é gerado por IA e pode conter erros clínicos. Ele fica como rascunho até você conferir e publicar.</p>
      </div>
    </div>
  );
}

/* ======================= importar ======================= */
function Importar({ token, api, ia, aoAbrir, aoVoltar }) {
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [rel, setRel] = useState(null);
  const [sobre, setSobre] = useState(false);

  const tratar = async (file) => {
    if (!file) return;
    setErro(''); setRel(null);
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'rvpack' || ext === 'json') {
        setOcupado('Importando o pacote…');
        let pacote; try { pacote = JSON.parse(await lerTexto(file)); } catch { throw new Error('Esse arquivo não é um pacote .rvpack válido.'); }
        setRel(await api('/api/estacoes/importar-pacote', { metodo: 'POST', token, corpo: { pacote } }));
      } else if (MIME_POR_EXT[ext]) {
        if (file.size > MAX_ARQUIVO) throw new Error('O arquivo precisa ter até 8 MB.');
        if (ia && !ia.configurado) throw new Error('A IA não está configurada neste servidor; por isso não consigo ler PDF ou imagem.');
        setOcupado('Lendo o documento com IA… isso pode levar até um minuto.');
        const r = await api('/api/estacoes/importar-arquivo', { metodo: 'POST', token, corpo: { mime: MIME_POR_EXT[ext], base64: await lerBase64(file) } });
        aoAbrir(r.id, r.incertos?.length ? `A IA marcou ${r.incertos.length} campo(s) que não leu com segurança (em amarelo). Compare com o original antes de publicar.` : 'Compare com o original antes de publicar.');
      } else throw new Error('Formato não aceito. Use .rvpack, PDF, PNG, JPEG ou WEBP.');
    } catch (e) { setErro(e.message); } finally { setOcupado(''); }
  };
  const soltar = (e) => { e.preventDefault(); setSobre(false); tratar(e.dataTransfer.files?.[0]); };

  return (
    <div className="tela est-tela">
      <div className="est-topo"><h2>Importar</h2><button type="button" className="ln" onClick={aoVoltar}>Voltar</button></div>
      <div className={`cartao est-solta${sobre ? ' sobre' : ''}`} onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={soltar}>
        <b>Solte um arquivo aqui</b>
        <span className="sub">Pacote <b>.rvpack</b> (várias estações de uma vez) ou <b>PDF / imagem</b> de uma estação (a IA lê e você revisa).</span>
        <label className="btn mini" style={{ display: 'inline-grid', placeItems: 'center', padding: '0 18px', cursor: 'pointer' }}>
          Escolher arquivo
          <input type="file" accept=".rvpack,.json,.pdf,.png,.jpg,.jpeg,.webp" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => { tratar(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {ocupado && <Espera>{ocupado}</Espera>}
      <div className="msg e" role="alert">{erro}</div>
      {rel && (
        <div className="cartao est-form" role="status">
          <b>{rel.importadas} importada(s), {rel.rejeitadas} rejeitada(s).</b>
          <span className="sub">{rel.status === 'aprovada' ? 'Entraram como aprovadas (importação de administrador).' : 'Entraram na fila de revisão da moderação.'}</span>
          <ul className="est-relatorio">
            {rel.resultado.map((r) => (
              <li key={r.posicao} className={r.ok ? '' : 'erro'}><span>{r.ok ? '✔' : '✘'}</span><div>{r.titulo || '(sem título)'}{!r.ok && <small>{r.erros.join(' · ')}</small>}</div></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ======================= editor ======================= */
const VAZIA = { titulo: '', area: 'clinica_medica', duracao_min: '10', sintese: '', objetivos: '', perfil_paciente: '', diagnostico_alvo: '', instrucoes_candidato: '', cenario: '', script_ator: '', conceitos: '', pep: [], materiais: [] };
const doServidor = (e) => ({
  titulo: e.titulo ?? '', area: e.area ?? 'clinica_medica', duracao_min: String(e.duracao_min ?? 10), instrucoes_candidato: e.instrucoes_candidato ?? '', cenario: e.cenario ?? '', script_ator: e.script_ator ?? '',
  sintese: e.sintese ?? '', objetivos: (e.objetivos ?? []).join('\n'), perfil_paciente: e.perfil_paciente ?? '', diagnostico_alvo: e.diagnostico_alvo ?? '',
  conceitos: (e.conceitos ?? []).join(', '),
  pep: (e.pep ?? []).map((p) => ({ secao: p.secao ?? 'Geral', descricao: p.descricao ?? '', criterio: p.criterio ?? '', pontos_total: String(p.pontos_total ?? ''), pontos_parcial: p.pontos_parcial === null || p.pontos_parcial === undefined ? '' : String(p.pontos_parcial), critico: !!p.critico })),
  materiais: (e.materiais ?? []).map((m) => ({ tipo: m.tipo ?? 'outro', titulo: m.titulo ?? '', gatilho: m.gatilho ?? '', conteudo: m.conteudo ?? '' })),
});
const paraServidor = (e) => ({
  titulo: e.titulo, area: e.area, duracao_min: Math.round(num(e.duracao_min)), instrucoes_candidato: e.instrucoes_candidato, cenario: e.cenario, script_ator: e.script_ator,
  sintese: e.sintese, objetivos: e.objetivos.split('\n').map((l) => l.trim()).filter(Boolean), perfil_paciente: e.perfil_paciente, diagnostico_alvo: e.diagnostico_alvo,
  conceitos: e.conceitos.split(',').map((c) => c.trim()).filter(Boolean),
  pep: e.pep.map((p) => ({ secao: p.secao, descricao: p.descricao, criterio: p.criterio, pontos_total: num(p.pontos_total), pontos_parcial: String(p.pontos_parcial).trim() === '' ? null : num(p.pontos_parcial), critico: p.critico })),
  materiais: e.materiais.map((m) => ({ tipo: m.tipo, titulo: m.titulo, gatilho: m.gatilho, conteudo: m.conteudo })),
});

/** Variação: a IA refaz a estação mudando só o que o autor pedir (perfil, cenário, diagnóstico, dificuldade). A base não é alterada. */
function Variacao({ base, token, api, ia, aoAbrir }) {
  const [f, setF] = useState({ perfil: '', cenario: '', diagnostico_alvo: '', dificuldade: '', instrucoes: '' });
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState('');
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const criar = async () => {
    setOcupado(true); setErro('');
    try { const r = await api(`/api/estacoes/${base}/variar`, { metodo: 'POST', token, corpo: f }); aoAbrir(r.id, 'Variação criada pela IA a partir da estação anterior (que não foi alterada). Revise tudo antes de publicar.'); }
    catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  return (
    <details className="cartao est-variacao">
      <summary>Criar variação com IA</summary>
      <p className="est-ajuda">Parte desta estação e muda só o que você preencher; exames, roteiro e conduta são refeitos para continuar coerentes.</p>
      {ia && !ia.configurado && <div className="aviso" role="alert">A IA não está configurada neste servidor.</div>}
      <div className="est-grade">
        <label className="campo"><span>Novo perfil do paciente</span><input value={f.perfil} maxLength={200} onChange={set('perfil')} placeholder="Criança de 6 anos" /></label>
        <label className="campo"><span>Novo cenário</span><input value={f.cenario} maxLength={200} onChange={set('cenario')} placeholder="UBS, pronto-socorro…" /></label>
        <label className="campo"><span>Outro diagnóstico alvo</span><input value={f.diagnostico_alvo} maxLength={200} onChange={set('diagnostico_alvo')} /></label>
        <label className="campo"><span>Dificuldade</span><select value={f.dificuldade} onChange={set('dificuldade')}><option value="">Manter</option>{DIFICULDADES.map((d) => <option key={d}>{d}</option>)}</select></label>
      </div>
      <label className="campo"><span>Orientações (opcional)</span><textarea value={f.instrucoes} maxLength={2000} onChange={set('instrucoes')} placeholder="Ex.: incluir diabetes como comorbidade" /></label>
      {erro && <div className="msg e" role="alert">{erro}</div>}
      <button type="button" className="btn menta" disabled={ocupado || (ia && !ia.configurado)} onClick={criar}>{ocupado ? 'Criando variação…' : 'Criar variação'}</button>
    </details>
  );
}

function Editor({ id, token, usuario, api, nota, aoVoltar, aoExportar, aoAbrir, ia }) {
  const novo = id === 'novo';
  const [e, setE] = useState(novo ? VAZIA : null);
  const [meta, setMeta] = useState({ id: novo ? null : id, status: 'rascunho', origem: 'manual', criado_por: usuario?.id });
  const [incertos, setIncertos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [msg, setMsg] = useState({ t: '', e: false, d: [] });
  const [ocupado, setOcupado] = useState(false);
  const [conferi, setConferi] = useState(false);

  useEffect(() => {
    if (novo) return;
    api(`/api/estacoes/${id}`, { token }).then((r) => {
      setE(doServidor(r)); setIncertos(r.incertos ?? []); setAvisos(r.avisos ?? []);
      setMeta({ id: r.id, status: r.status, origem: r.origem, criado_por: r.criado_por });
    }).catch((x) => setMsg({ t: x.message, e: true, d: [] }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gestor = ['admin', 'root'].includes(usuario?.papel_app);
  const publicaDireto = ['moderador', 'admin', 'root'].includes(usuario?.papel_app);   // o servidor aprova direto; os demais vão para a fila de revisão
  const leitura = meta.status !== 'rascunho' && !gestor;
  const inc = useCallback((p) => incertos.some((x) => x === p || x.startsWith(`${p}.`) || x.startsWith(`${p}[`)), [incertos]);
  const soma = useMemo(() => (e ? Math.round(e.pep.reduce((s, p) => s + (num(p.pontos_total) || 0), 0) * 100) / 100 : 0), [e]);
  const exigeConferir = !leitura && (meta.origem === 'ia' || meta.origem === 'importada');

  if (!e) return <div className="tela est-tela"><div className="est-topo"><h2>Estação</h2><button type="button" className="ln" onClick={aoVoltar}>Voltar</button></div>{msg.t ? <div className="msg e" role="alert">{msg.t}</div> : <Espera>Carregando…</Espera>}</div>;

  const set = (k) => (ev) => setE((x) => ({ ...x, [k]: ev.target.value }));
  const setLista = (k, i, campo, valor) => setE((x) => ({ ...x, [k]: x[k].map((it, j) => (j === i ? { ...it, [campo]: valor } : it)) }));
  const addPep = () => setE((x) => ({ ...x, pep: [...x.pep, { secao: x.pep.at(-1)?.secao ?? 'Geral', descricao: '', criterio: '', pontos_total: '1', pontos_parcial: '', critico: false }] }));
  const delPep = (i) => setE((x) => ({ ...x, pep: x.pep.filter((_, j) => j !== i) }));
  const movPep = (i, d) => setE((x) => { const l = [...x.pep]; const j = i + d; if (j < 0 || j >= l.length) return x; [l[i], l[j]] = [l[j], l[i]]; return { ...x, pep: l }; });
  const addMat = () => setE((x) => ({ ...x, materiais: [...x.materiais, { tipo: 'laboratorial', titulo: '', gatilho: '', conteudo: '' }] }));
  const delMat = (i) => setE((x) => ({ ...x, materiais: x.materiais.filter((_, j) => j !== i) }));

  const falha = (x) => setMsg({ t: x.message, e: true, d: x.detalhes ?? [] });
  const salvar = async () => {
    const corpo = paraServidor(e);
    if (corpo.pep.some((p) => Number.isNaN(p.pontos_total) || Number.isNaN(p.pontos_parcial))) throw Object.assign(new Error('Confira os pontos do checklist: use números.'), { detalhes: [] });
    if (Number.isNaN(corpo.duracao_min)) throw Object.assign(new Error('A duração precisa ser um número de minutos.'), { detalhes: [] });
    if (meta.id) { const r = await api(`/api/estacoes/${meta.id}`, { metodo: 'PUT', token, corpo }); setAvisos(r.avisos ?? []); setIncertos([]); return meta.id; }
    const r = await api('/api/estacoes', { metodo: 'POST', token, corpo });
    setMeta((m) => ({ ...m, id: r.id })); return r.id;
  };
  const acao = (fn) => async () => { setMsg({ t: '', e: false, d: [] }); setOcupado(true); try { await fn(); } catch (x) { falha(x); } finally { setOcupado(false); } };
  const aoSalvar = acao(async () => { await salvar(); setMsg({ t: 'Rascunho salvo.', e: false, d: [] }); });
  const aoPublicar = acao(async () => {
    const eid = await salvar();
    const r = await api(`/api/estacoes/${eid}/publicar`, { metodo: 'POST', token });
    setMeta((m) => ({ ...m, status: r.status }));
    setMsg({ t: r.status === 'aprovada' ? 'Estação publicada.' : 'Enviada para a fila de revisão da moderação.', e: false, d: [] });
  });
  const aoExcluir = acao(async () => {
    if (!window.confirm('Apagar este rascunho? Isso não pode ser desfeito.')) return;
    await api(`/api/estacoes/${meta.id}`, { metodo: 'DELETE', token }); aoVoltar();
  });

  return (
    <div className={`tela est-tela est-editor${leitura ? ' est-leitura' : ''}`}>
      <div className="est-topo"><h2>{novo && !meta.id ? 'Nova estação' : 'Estação'}</h2><button type="button" className="ln" onClick={aoVoltar}>Voltar</button></div>
      {nota && <div className="aviso">{nota}</div>}
      {meta.id && aoAbrir && <Variacao base={meta.id} token={token} api={api} ia={ia} aoAbrir={aoAbrir} />}
      {leitura && <div className="aviso">Esta estação já foi enviada e não pode mais ser editada por aqui.</div>}
      {incertos.length > 0 && !nota && <div className="aviso" role="alert">Campos em amarelo: a IA não leu com segurança. Compare com o documento original.</div>}
      <fieldset disabled={leitura || ocupado} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <div className="est-bloco cartao">
          <Campo rotulo="Título" incerto={inc('titulo')}><input value={e.titulo} maxLength={120} onChange={set('titulo')} /></Campo>
          <div className="est-grade">
            <Campo rotulo="Área" incerto={inc('area')}><select value={e.area} onChange={set('area')}>{AREAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Campo>
            <Campo rotulo="Duração (min)" incerto={inc('duracao_min')}><input inputMode="numeric" value={e.duracao_min} onChange={set('duracao_min')} /></Campo>
          </div>
          <Campo rotulo="Síntese da estação" incerto={inc('sintese')}><textarea value={e.sintese} maxLength={3000} onChange={set('sintese')} placeholder="Perfil do paciente, queixa e o que a estação avalia." /></Campo>
          <div className="est-grade">
            <Campo rotulo="Perfil do paciente" incerto={inc('perfil_paciente')}><input value={e.perfil_paciente} maxLength={300} onChange={set('perfil_paciente')} /></Campo>
            <Campo rotulo="Diagnóstico alvo" incerto={inc('diagnostico_alvo')}><input value={e.diagnostico_alvo} maxLength={200} onChange={set('diagnostico_alvo')} /></Campo>
          </div>
          <Campo rotulo="Objetivos (um por linha)" incerto={inc('objetivos')}><textarea value={e.objetivos} maxLength={2000} onChange={set('objetivos')} /></Campo>
          <Campo rotulo="Instruções ao candidato (folha do candidato)" incerto={inc('instrucoes_candidato')}><textarea value={e.instrucoes_candidato} maxLength={4000} onChange={set('instrucoes_candidato')} /></Campo>
          <Campo rotulo="Cenário de atuação" incerto={inc('cenario')}><textarea value={e.cenario} maxLength={4000} onChange={set('cenario')} /></Campo>
          <Campo rotulo="Roteiro do ator / avaliador" incerto={inc('script_ator')}><textarea style={{ minHeight: 160 }} value={e.script_ator} maxLength={8000} onChange={set('script_ator')} /></Campo>
          <Campo rotulo="Conceitos (separados por vírgula)" incerto={inc('conceitos')}><input value={e.conceitos} onChange={set('conceitos')} placeholder="Ex.: pré-eclâmpsia, sulfato de magnésio" /></Campo>
        </div>

        <div className="est-bloco cartao">
          <div className="est-topo"><span className="sec">Checklist (PEP)</span><span className="est-soma">{soma} pontos</span></div>
          {e.pep.map((p, i) => (
            <div className={`est-pep${inc(`pep[${i}]`) ? ' incerto' : ''}`} key={i}>
              <label className="campo"><span>Item {i + 1}{inc(`pep[${i}]`) && <em className="est-conferir"> conferir</em>}</span><textarea style={{ minHeight: 64 }} value={p.descricao} maxLength={500} onChange={(ev) => setLista('pep', i, 'descricao', ev.target.value)} /></label>
              <label className="campo"><span>Critério de pontuação</span><input value={p.criterio ?? ''} maxLength={400} onChange={(ev) => setLista('pep', i, 'criterio', ev.target.value)} placeholder="Ex.: 5 a 6 itens = adequado; 3 a 4 = parcial; 0 a 2 = inadequado" /></label>
              <div className="est-linha">
                <label className="campo"><span>Seção</span><input value={p.secao} maxLength={80} onChange={(ev) => setLista('pep', i, 'secao', ev.target.value)} /></label>
                <label className="campo"><span>Pontos</span><input inputMode="decimal" value={p.pontos_total} onChange={(ev) => setLista('pep', i, 'pontos_total', ev.target.value)} /></label>
                <label className="campo"><span>Parcial</span><input inputMode="decimal" value={p.pontos_parcial} onChange={(ev) => setLista('pep', i, 'pontos_parcial', ev.target.value)} placeholder="opcional" /></label>
              </div>
              <div className="est-item-acoes">
                <label className="est-check"><input type="checkbox" checked={p.critico} onChange={(ev) => setLista('pep', i, 'critico', ev.target.checked)} /> Item crítico</label>
                <button type="button" className="btn mini" onClick={() => movPep(i, -1)} aria-label={`Subir item ${i + 1}`}>↑</button>
                <button type="button" className="btn mini" onClick={() => movPep(i, 1)} aria-label={`Descer item ${i + 1}`}>↓</button>
                <button type="button" className="btn mini coral" onClick={() => delPep(i)} aria-label={`Remover item ${i + 1}`}>Remover</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn mini" onClick={addPep}>+ Item do checklist</button>
        </div>

        <div className="est-bloco cartao">
          <span className="sec">Materiais extras (liberados sob demanda)</span>
          <p className="est-ajuda">Exames, imagens, biópsias e laudos que o avaliador libera só quando o candidato pedir.</p>
          {e.materiais.map((m, i) => (
            <div className={`est-mat${inc(`materiais[${i}]`) ? ' incerto' : ''}`} key={i}>
              <div className="est-linha">
                <label className="campo"><span>Tipo</span><select value={m.tipo} onChange={(ev) => setLista('materiais', i, 'tipo', ev.target.value)}>{TIPOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
                <label className="campo"><span>Título{inc(`materiais[${i}]`) && <em className="est-conferir"> conferir</em>}</span><input value={m.titulo} maxLength={120} onChange={(ev) => setLista('materiais', i, 'titulo', ev.target.value)} /></label>
              </div>
              <label className="campo"><span>Libera quando o candidato…</span><input value={m.gatilho} maxLength={300} onChange={(ev) => setLista('materiais', i, 'gatilho', ev.target.value)} placeholder="Ex.: solicitar hemograma" /></label>
              <label className="campo"><span>Conteúdo (texto do exame/laudo)</span><textarea value={m.conteudo} maxLength={6000} onChange={(ev) => setLista('materiais', i, 'conteudo', ev.target.value)} /></label>
              <button type="button" className="btn mini coral" onClick={() => delMat(i)}>Remover material</button>
            </div>
          ))}
          <button type="button" className="btn mini" onClick={addMat}>+ Material extra</button>
        </div>
      </fieldset>

      {avisos.length > 0 && <div className="aviso est-largo"><b>Confira:</b><ul className="est-avisos">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
      <div className={`msg${msg.e ? ' e' : ''} est-largo`} role="status">{msg.t}</div>
      {msg.d.length > 0 && <ul className="est-avisos est-largo" role="alert">{msg.d.map((d, i) => <li key={i}>{d}</li>)}</ul>}

      {exigeConferir && (
        <label className="est-check est-largo"><input type="checkbox" checked={conferi} onChange={(ev) => setConferi(ev.target.checked)} />
          Li e conferi todo o conteúdo (gerado por IA ou lido de um documento).</label>
      )}
      <div className="est-rodape">
        {!leitura && <button type="button" className="btn mini" disabled={ocupado} onClick={aoSalvar}>Salvar rascunho</button>}
        {!leitura && <button type="button" className="btn mini menta" disabled={ocupado || (exigeConferir && !conferi)} onClick={aoPublicar}>{publicaDireto ? 'Publicar' : 'Enviar para revisão'}</button>}
        {meta.id && <button type="button" className="btn mini" disabled={ocupado} onClick={() => aoExportar(meta.id)}>Exportar</button>}
        {meta.id && meta.status !== 'aprovada' && !leitura && <button type="button" className="btn mini coral" disabled={ocupado} onClick={aoExcluir}>Apagar</button>}
      </div>
    </div>
  );
}
