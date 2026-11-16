// O que o Epi explica em cada tela e os atalhos que ele oferece. Cada atalho tem o "caminho" (passos do tour) para a pessoa
// aprender onde ele fica sem precisar do Epi: no modo mesa (dock → caixa do grupo) e no menu clássico (barra lateral).
import { GRUPOS } from './useMesa.js';

const grupoDe = (tela) => GRUPOS.find((g) => g.telas.includes(tela));

/** Passos do tour até uma tela (e, opcionalmente, até uma aba/botão dentro dela). */
export function caminhoAte(tela, { mesa, dentro = [] } = {}) {
  const g = grupoDe(tela);
  const ate = tela === 'painel'
    ? [{ seletor: mesa ? '.dock .dk-item[data-tela=painel], .dock .dk-grupo:first-child .dk-item' : '.nav > button:first-of-type', texto: 'Aqui fica o Início.' }]
    : mesa && g
      ? [{ seletor: `[data-grupo=${g.id}]`, texto: `Clique no grupo ${g.nome}, no dock.` },
        { seletor: `[data-widget=grupo-${g.id}] .gc-item[data-tela=${tela}]`, texto: 'Agora clique aqui.' }]
      : [{ seletor: `.nav [data-tela=${tela}]`, texto: 'Fica aqui, no menu.' }];
  return [...ate, ...dentro];
}

export const GUIA = {
  painel: {
    titulo: 'Início',
    faz: 'Mostra como você está indo, a contagem para a prova e o que treinar agora.',
    passos: ['Veja a sugestão em “Treinar agora”.', 'Ou toque em “Sortear outras 5” para um bloco com IA (uma estação por área).', 'Escolha seguir sozinho com a IA ou chamar um colega.'],
    atalhos: ['solo', 'ciclos', 'estudo'],
  },
  solo: {
    titulo: 'Praticar com IA',
    faz: 'Eu faço o paciente. Você conduz a estação no tempo e no fim recebe a correção pelo checklist (PEP).',
    passos: ['Escolha a dificuldade e o tempo.', 'Toque em “Gerar e praticar”.', 'Converse comigo como se eu fosse o paciente.', 'No fim, leia a correção e o que faltou.'],
    atalhos: ['estudo', 'desempenho'],
  },
  ciclos: {
    titulo: 'Sala e ciclos',
    faz: 'Videochamada para treinar em dupla ou grupo, com a fila de estações e os papéis (candidato, ator, avaliador).',
    passos: ['Crie ou entre numa sala.', 'O chefe monta o ciclo na aba “Ciclo”.', 'Ao iniciar, abre o painel da estação e os cartões aparecem à direita.', 'No fim, a aba “Resultado” mostra a nota e os próximos passos.'],
    atalhos: ['comunidade', 'estacoes'],
  },
  estacoes: {
    titulo: 'Estações',
    faz: 'O banco de estações: buscar, criar do zero, gerar com IA e revisar.',
    passos: ['Use os filtros de área e dificuldade.', 'Toque numa estação para ver e praticar.', '“Gerar com IA” cria uma estação nova para você revisar.'],
    atalhos: ['ciclos', 'solo'],
  },
  estudo: {
    titulo: 'Estudo',
    faz: 'Trilha de temas, cartões de revisão, mapa e fluxograma da conduta das estações que você fez, e caderno de erros.',
    passos: ['Na “Trilha”, comece pelos temas em vermelho.', 'Em “Mapa e fluxograma”, escolha uma estação e o tema para ver o raciocínio.', 'Em “Cartões”, revise todo dia um pouquinho.'],
    atalhos: ['desempenho', 'podcast'],
  },
  podcast: { titulo: 'Podcast e Rádio', faz: 'Episódios curtos com os temas da prova, para ouvir no caminho.', passos: ['Escolha um episódio ou peça um novo sobre um tema.'], atalhos: ['estudo'] },
  desempenho: { titulo: 'Desempenho', faz: 'Suas notas por área, a evolução e os pontos fracos.', passos: ['Filtre por área e período.', 'Os pontos fracos viram sugestões de treino.'], atalhos: ['estudo', 'solo'] },
  comunidade: { titulo: 'Comunidade', faz: 'Encontre colegas para treinar em dupla e responda convites.', passos: ['Procure por área ou fique disponível para o sorteio de dupla.'], atalhos: ['ciclos'] },
  conta: { titulo: 'Conta', faz: 'Seu perfil, senha e preferências.', passos: [], atalhos: [] },
  notas: { titulo: 'Notas', faz: 'Anotações rápidas que ficam na mesa.', passos: [], atalhos: [] },
};

/** Depois de uma estação: o que dá para fazer (cada opção abre direto ou mostra onde fica). */
export const DEPOIS_DA_ESTACAO = [
  { id: 'revisar', rotulo: 'Revisar o tema', tela: 'estudo', aba: 'mapa', dentro: [{ seletor: '[role=tab]', textoAlvo: 'Mapa e fluxograma', texto: 'O mapa e o fluxograma do tema ficam nesta aba.' }] },
  { id: 'cards', rotulo: 'Criar cartões de revisão', tela: 'estudo', aba: 'biblioteca', dentro: [{ seletor: '[role=tab]', textoAlvo: 'Biblioteca', texto: 'Os cartões das suas estações ficam aqui.' }] },
  { id: 'faltou', rotulo: 'Ver o que faltou', tela: 'estudo', aba: 'erros', dentro: [{ seletor: '[role=tab]', textoAlvo: 'Caderno de erros', texto: 'Tudo o que faltou nas estações fica no caderno de erros.' }] },
  { id: 'desempenho', rotulo: 'Ver meu desempenho', tela: 'desempenho' },
  { id: 'outra', rotulo: 'Treinar outra estação', tela: 'solo' },
];
