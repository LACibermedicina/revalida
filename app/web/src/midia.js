// Diagnóstico de câmera e microfone do navegador. Puro e injetável (recebe o `navigator`), para testar sem navegador.
// Estados: ok · negada (permissão bloqueada) · sem_dispositivo · em_uso (outro app/aba usa) · indisponivel (sem suporte ou página não segura) · erro.

const POR_ERRO = { NotAllowedError: 'negada', SecurityError: 'negada', PermissionDeniedError: 'negada', NotFoundError: 'sem_dispositivo', DevicesNotFoundError: 'sem_dispositivo', NotReadableError: 'em_uso', TrackStartError: 'em_uso', AbortError: 'em_uso' };

async function sondar(nav, tipo) {
  let fluxo;
  try {
    fluxo = await nav.mediaDevices.getUserMedia({ [tipo]: true });
    return 'ok';
  } catch (e) { return POR_ERRO[e?.name] ?? 'erro'; }
  finally { fluxo?.getTracks?.().forEach((t) => t.stop()); }
}

/** Confere se o navegador PERMITE ligar câmera e microfone (abre e fecha cada um, sem publicar nada). */
export async function diagnosticarMidia(nav = globalThis.navigator, { seguro = globalThis.isSecureContext } = {}) {
  const d = { seguro: seguro !== false, camera: 'indisponivel', microfone: 'indisponivel', dispositivos: { camera: 0, microfone: 0 } };
  if (!nav?.mediaDevices?.getUserMedia) return d;
  try {
    const l = await nav.mediaDevices.enumerateDevices();
    d.dispositivos = { camera: l.filter((x) => x.kind === 'videoinput').length, microfone: l.filter((x) => x.kind === 'audioinput').length };
  } catch { /* segue sem a contagem */ }
  for (const [chave, tipo, perm] of [['camera', 'video', 'camera'], ['microfone', 'audio', 'microphone']]) {
    let bloqueada = false;
    try { bloqueada = (await nav.permissions?.query?.({ name: perm }))?.state === 'denied'; } catch { /* permissions não conhece o nome */ }
    d[chave] = bloqueada ? 'negada' : await sondar(nav, tipo);
  }
  return d;
}

const TEXTO = {
  camera: { negada: 'A câmera está bloqueada para este site.', sem_dispositivo: 'Nenhuma câmera foi encontrada.', em_uso: 'A câmera está em uso por outro aplicativo ou aba.', indisponivel: 'Este navegador não deixou usar a câmera.', erro: 'Não foi possível abrir a câmera.' },
  microfone: { negada: 'O microfone está bloqueado para este site.', sem_dispositivo: 'Nenhum microfone foi encontrado.', em_uso: 'O microfone está em uso por outro aplicativo ou aba.', indisponivel: 'Este navegador não deixou usar o microfone.', erro: 'Não foi possível abrir o microfone.' },
};
const COMO = {
  negada: 'Clique no cadeado ao lado do endereço, permita o acesso e toque em "Verificar de novo".',
  sem_dispositivo: 'Conecte o aparelho e toque em "Verificar de novo".',
  em_uso: 'Feche o outro aplicativo (ou a outra aba) que usa o aparelho e toque em "Verificar de novo".',
  indisponivel: 'Abra o sistema por um endereço seguro (https) e use um navegador atualizado.',
  erro: 'Recarregue a página e tente de novo.',
};

/** Lista de problemas em linguagem simples: [{ item, texto, como }]. Vazia = tudo certo. */
export function problemasDe(d) {
  const r = [];
  if (!d.seguro) r.push({ item: 'pagina', texto: 'A página não é segura (sem https): o navegador bloqueia câmera e microfone.', como: COMO.indisponivel });
  for (const k of ['camera', 'microfone']) if (d[k] !== 'ok') r.push({ item: k, texto: TEXTO[k][d[k]] ?? TEXTO[k].erro, como: COMO[d[k]] ?? COMO.erro });
  return r;
}

/** A mídia da sala está "desconectada"? (sem entrar no vídeo, ou câmera/microfone desligados no modo real). */
export function midiaDesconectada({ modo, cam, mic }) {
  if (modo === null || modo === undefined) return true;
  if (modo === 'demo') return false;
  return !cam || !mic;
}

/** Só quem tem função na estação (chefe, avaliador ou candidato) vê o botão de solucionar problemas, e só com a mídia desconectada. */
export function mostrarSolucionar({ papel, eAvaliador, video }) {
  return (papel === 'candidato' || papel === 'admin' || Boolean(eAvaliador)) && midiaDesconectada(video);
}
