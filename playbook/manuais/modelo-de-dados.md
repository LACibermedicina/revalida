# Modelo de dados (gerado de db/schema.sql)

PostgreSQL 16. Tabelas e colunas principais.

- **usuarios**: id, nome, email, senha_hash, papel_app, reputacao, ativo, criado_em
- **tokens_acesso**: id, hash, tipo, email_preso, usos_max, usos, expira_em, revogado, criado_em
- **estacoes**: id, titulo, area, duracao_min, origem, status, script_ator, criado_em
- **pep_itens**: id, estacao_id, secao, ordem, descricao, pontos_total, pontos_parcial, critico
- **sessoes**: id, estacao_id, dono_id, modo, status, canal_video, permite_observadores, max_observadores, timer_status, timer_inicio_em, timer_acumulado_ms, criado_em
- **sessao_participantes**: id, sessao_id, usuario_id, papel, entrou_em
- **avaliacoes**: id, sessao_id, avaliador_id, candidato_id, nota, nota_max, finalizada_em, criado_em
- **avaliacao_itens**: avaliacao_id, pep_item_id, nivel, pontos
- **comentarios_observador**: id, sessao_id, autor_id, tempo_ms, texto, criado_em
- **recuperacoes_senha**: id, usuario_id, hash, origem, expira_em, usado_em, criado_em
- **solicitacoes_acesso**: id, nome, email, mensagem, status, decidido_por, decidido_em, criado_em
- **auditoria_admin**: id, ator_id, acao, alvo, detalhes, criado_em
- **config_servidor**: chave, valor, segredo, atualizado_em
- **salas**: id, dono_id (só registra quem criou; não dá poder), admin_id (o chefe é uma função), nome, expira_vazia_horas (1–720, padrão 24), vazia_desde (preenchida por gatilho quando ninguém está na sala), canal_video, ciclo_ativo_id, estado, audio_observadores, versao, criada_em. `rv_salas_expirar()` encerra salas vazias além do prazo (a cada 10 min e ao listar); o histórico das estações fica.
- **sala_mensagens**: id, sala_id, autor_id, texto (≤ 1000), em — chat interno; o candidato não envia durante a estação.
- **execucoes**: ganhou `pausada_em` e `pausa_seg` (o tempo pausado não conta no relógio).
- **ciclos**: id, sala_id, admin_id, candidato_id, estado, origem_id, motivo_pausa, versao, criado_em, pausado_em
- **ciclo_itens**: id, ciclo_id, estacao_id, posicao, liberada_ao_candidato, grupo
- **execucoes**: id, sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, iniciada_em, finalizada_em, nota, versao
- **sala_participantes**: sala_id, usuario_id, papel, e_avaliador, video_pausado_por, entrou_em, saiu_em
- **solicitacoes_papel**: id, sala_id, solicitante_id, papel_pedido, estado, criada_em, decidida_em
- **paused_cycles**: ciclo_id, execucao_id, snapshot, proximo_item_id, retomavel_por, pausado_em
- **sala_eventos**: id, sala_id, ciclo_id, tipo, ator_id, dados, em
- **usuario_estacao**: usuario_id, estacao_id, vezes_realizada, melhor_nota, ultima_em
- **estacao_materiais**: id, estacao_id, ordem, tipo, titulo, conteudo, gatilho
- **sessao_materiais**: sessao_id, material_id, liberado_em, liberado_por
- **temas**: id, nome, nome_norm, area, relevancia, descricao, origem, criado_em
- **tema_relacoes**: de, para, tipo, peso, motivo, origem
- **estacao_temas**: estacao_id, tema_id
- **diretrizes**: id, titulo, fonte, url, area, texto, criado_por, criado_em
- **lacunas**: id, usuario_id, execucao_id, estacao_id, pep_item_id, categoria, erro_tipo, 'exame_generico','exame_sem_interpretar','diagnostico_sem_conduta','medicacao_incompleta','excesso_fala','sem_orientacao_final','sem_cronometro')),, descricao, criada_em
- **cartoes**: id, tema_id, serie, frente, verso, origem, diretriz_id, criado_por, criado_em
- **cartao_progresso**: usuario_id, cartao_id, facilidade, intervalo_dias, repeticoes, proximo_em, ultima_em, acertos, erros
- **resumos**: id, tema_id, foco, titulo, corpo, diretriz_id, origem, criado_por, criado_em
- **execucao_materiais**: execucao_id, material_id, liberado_por, liberado_em
- **transcricoes**: id, execucao_id, ordem, texto, inicio_ms, fonte, criado_em
- **analises_transcricao**: execucao_id, final, fonte, itens, resumo, segmentos, gerada_em
- **catalogo_estudo**: usuario_id, codigo, status, prioridade, observacoes, estacao_id, atualizado_em
- **convites_sala**: id, sala_id, convidante_id, convidado_id, estado, papel_aceito, criado_em, decidido_em
- **usuarios** (acrescentado na 013): `suspenso_ate` — fim da suspensão semanal decidida pelo administrador
- **bloqueios**: bloqueador_id, bloqueado_id, origem (`manual`|`denuncia`), criado_em — vale nos dois sentidos (`rv_bloqueados(a,b)`)
- **denuncias**: id, denunciante_id, denunciado_id, sala_id, motivo, detalhe, estado, resposta, respondida_em, decisao, decisao_nota, decidida_por, decidida_em, criada_em
- **suspensoes**: id, usuario_id, denuncia_id, inicio, fim, revogada_em, criada_por
- **notificacoes**: id, usuario_id, tipo, dados, lida_em, criada_em
- **chamados**: id, usuario_id, tipo (`randomico`|`comunidade`), origem (`plataforma`|`trilha`), area, estacoes, minutos, mensagem, estado, sala_id, criado_em, expira_em
- **ciclos_randomicos**: sala_id, estacoes (sorteadas, em ordem), indice, fase (0|1 = papéis invertidos), origem, estado, criado_em
- **trilhas**: usuario_id, minutos_dia, dias (0=domingo … 6=sábado; padrão todos), ultimo_modo, atualizada_em

## Prática solo, podcast e rádio (migrações 014 e 015)

| Tabela | Função |
|---|---|
| `praticas_solo` | cada prática solo iniciada: tema sorteado, área, dificuldade, tempo, nº de itens, motivo do sorteio e a estação gerada |
| `podcast_playlists` | playlists do usuário (título, prompt de detalhamento, link público opcional) |
| `podcast_itens` | episódios (tema ou revisão de cartões): prompt do tópico, roteiro/transcrição, arquivo de áudio (MP3 padrão universal: `audio_normalizado`), `token_publico` do link público do episódio, publicação na radIA |
| `podcast_posicoes` | ponto em que o usuário parou em cada episódio (pausar e continuar depois) |
| `podcast_tokens` | credencial por usuário dos links privados de feed (revogável) |
| `radia_pool` | pool de pacotes de temas para a Rádio Revalida: data da solicitação, status (pendente/sincronizado/erro) e tentativas |
