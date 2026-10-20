// Menu do desktop: cada item de "Estações" e "Ciclos" manda um comando para a tela web (a mesma do navegador).
// Função pura (recebe as ações) para poder ser testada sem abrir o Electron.
export const COMANDOS = {
  novaEstacao: { tela: 'estacoes', aba: 'novo' },
  gerarIA: { tela: 'estacoes', aba: 'gerar' },
  importar: { tela: 'estacoes', aba: 'importar' },
  exportar: { tela: 'estacoes', aba: 'exportar' },
  minhasEstacoes: { tela: 'estacoes', aba: 'lista' },
  ciclos: { tela: 'ciclos' },
  trilha: { tela: 'estudo', aba: 'trilha' },
  cartoes: { tela: 'estudo', aba: 'cartoes' },
  mapa3d: { tela: 'estudo', aba: 'mapa' },
  erros: { tela: 'estudo', aba: 'erros' },
  diretrizes: { tela: 'estudo', aba: 'diretrizes' },
  guia: { tela: 'estudo', aba: 'guia' },
};

/** Só aceita comandos conhecidos (o canal IPC é uma fronteira de confiança). */
export function comandoValido(c) {
  return Object.values(COMANDOS).some((k) => k.tela === c?.tela && (k.aba ?? null) === (c.aba ?? null));
}

export function montarMenu({ enviar, servidorAtivo, trocarServidor, recarregar }) {
  const cmd = (rotulo, chave, accelerator) => ({ label: rotulo, accelerator, enabled: servidorAtivo(), click: () => enviar(COMANDOS[chave]) });
  return [
    { label: 'Revalida', submenu: [
      { label: 'Trocar servidor…', click: trocarServidor },
      { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: recarregar },
      { type: 'separator' }, { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Estações', submenu: [
      cmd('Nova estação', 'novaEstacao', 'CmdOrCtrl+N'),
      cmd('Gerar com IA…', 'gerarIA', 'CmdOrCtrl+G'),
      cmd('Importar (pacote, PDF ou imagem)…', 'importar', 'CmdOrCtrl+I'),
      cmd('Exportar estações…', 'exportar', 'CmdOrCtrl+E'),
      { type: 'separator' },
      cmd('Minhas estações', 'minhasEstacoes'),
    ] },
    { label: 'Ciclos', submenu: [cmd('Salas e ciclos', 'ciclos', 'CmdOrCtrl+L')] },
    { label: 'Estudo', submenu: [
      cmd('Trilha de aprendizagem', 'trilha', 'CmdOrCtrl+T'),
      cmd('Cartões (repetição espaçada)', 'cartoes', 'CmdOrCtrl+K'),
      cmd('Mapa 3D de temas', 'mapa3d', 'CmdOrCtrl+M'),
      cmd('Caderno de erros', 'erros'),
      cmd('Guia de treino', 'guia'),
      cmd('Diretrizes de referência', 'diretrizes'),
    ] },
    { label: 'Tela', submenu: [{ role: 'togglefullscreen', label: 'Tela cheia' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }] },
  ];
}
