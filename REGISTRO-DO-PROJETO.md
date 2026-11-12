# Registro do projeto: Diário de Treino 2 (app instalável)

Última atualização: 18/10/2026

## O que é
O app é um **site instalável** (PWA). Ele se atualiza sozinho e funciona em Android e iPhone. Um **programa central** no Google Apps Script cuida dos dados. Cada aluno tem a própria planilha no Drive do professor.

Substitui a versão 1 (APK, pasta `diario-de-treino-app`).

## Endereços
| O quê | Onde |
|---|---|
| App | https://cleytonarthur-debug.github.io/diario-de-treino/ |
| Política de Privacidade | https://cleytonarthur-debug.github.io/diario-de-treino/privacidade.html |
| Termos de Uso | https://cleytonarthur-debug.github.io/diario-de-treino/termos.html |
| Código (GitHub, público, sem dados) | https://github.com/cleytonarthur-debug/diario-de-treino |
| Planilha Painel do Professor (abas Alunos e Catálogo de exercícios) | https://docs.google.com/spreadsheets/d/1kSZaLnRL5UL4TQWexPt2faBxP8Ls3_8k9En3OezKT5E/edit |
| Programa central (Apps Script ligado ao Painel) | scriptId `1_EhLQqx4sZXgKoYlL3CXs76ry1mkkoBcwF_fqMfi6_k4RqSvBAz2MH4n` |
| Implantação (URL /exec, não muda) | `AKfycbztFNMiyDaVQpbpO3ZJXdEmDmfXKXqQCOeY6rTGflYqE1sjyXS5W_MsZVF3o8zGMn1djQ` |
| Planilhas dos alunos | pasta "Diário de Treino — Alunos" no Drive |
| Planilha do professor (como aluno) | "Treino evolução" `1futpdUQZ8uzgw3Y42YHhcpfOZUgFzrBLddzABwdUS8I` |

- **Link de professor:** abra o Painel e use o menu **Diário de Treino → Meu link de professor**. A chave fica nas Propriedades do script, não no código.
- **Links dos alunos:** ficam no app (Perfil do aluno) e na coluna "Código de acesso" da aba Alunos.

## Versão e atualização do app (desde 24/10/2026, custo zero)
- **No app:** aba **Configurações** mostra a versão instalada e tem o botão **Buscar atualizações**. O app também confere sozinho ao abrir (no máximo a cada 6 h) e mostra "Versão nova disponível · Atualizar agora".
- **Como funciona:** `docs/versao.json` anuncia a versão do site. O app compara com a versão dele (`docs/js/atualizacao.js`). Ao atualizar, apaga a cópia guardada pelo service worker e recarrega. O acesso e o rascunho do treino ficam guardados.
- **A cada publicação, antes do git push:** `node tools/versao.mjs X.Y.Z "o que mudou" "outra mudança"`. O script troca a versão nos 3 lugares (versao.json, atualizacao.js e nome do cache no sw.js).
- **Play Store/TWA foi cancelada:** o usuário quer custo zero.

## Como publicar uma mudança (feito pelo Claude neste PC)
- **App:** editar `docs/` e depois `git push`. O GitHub Pages atualiza em cerca de 1 minuto e os celulares pegam sozinhos.
- **Programa central:** em `backend/`, rodar `clasp push -f` e depois `clasp deploy -i <implantação> -d "descrição"`. A URL continua a mesma.
- **Ferramentas instaladas no PC:** Node, Git, GitHub CLI (logado como cleytonarthur-debug) e clasp 2.4.2 (logado como cleytonarthur@gmail.com).
- **Testar antes de publicar:** existe um simulador local que roda o Code.gs de verdade (scratchpad da sessão, `gas-sim/server.mjs`). Se ele tiver sumido, recriar.

## Fluxo combinado
1. O professor cadastra só **nome e WhatsApp**. O app cria a planilha do aluno e o link.
2. O professor envia o link pelo WhatsApp. O aluno abre no Chrome, instala e **completa o cadastro** (nascimento, sexo, altura, peso, objetivo, dias por semana e restrições).
3. O app do professor mostra o aviso **"montar treino"** (aba Alunos e faixa no topo).
4. O professor toca em **Montar treinos**, cria Treino A, B… com exercícios do catálogo, e salva. O treino aparece na hora para o aluno.
5. **No treino, o aluno pode:** trocar exercício (⇄), marcar "não fiz", "parei aqui" e escrever observações por série, por exercício e pelo treino.
6. **Avaliação física (só o professor lança):** desenho do corpo (frente e costas), perímetros, dobras (JP7 ou JP3) ou bioimpedância. O app calcula IMC, RCQ, % de gordura e massa magra/gorda.
7. **Evolução:** força (1RM por exercício), peso e composição, medidas, volume e recordes.

## Métodos de treino (desde 18/10/2026)
- Os métodos ficam em arquivos próprios em `docs/metodos/`. O índice é `index.json` e o primeiro método é `metodo-par.json`.
- **Para criar um método novo:** copie o formato do metodo-par.json (dias, aquecimento, descanso, músculos, exercícios com alternativas, treinos em pares, fases e progressão) e acrescente no index.json.
- **Ligar no aluno:** Montar treinos → Método de treino → escolher o método e a data de início. Fica gravado nas colunas "Método" e "Início do método" da aba Alunos.
- **No treino:** fase pela data (ciclo de 13 semanas que recomeça), séries, reps e reps sobrando da fase, pares a/b, cronômetro (45–60 s entre a e b, 60–90 s entre pares, vibra), aquecimento, zona 2 pela idade e cardio no fim (vai para o Histórico).
- **Avisos:** "⬆ Subir carga" (progressão dupla, olhando a última sessão) e "Sem evolução há 2 semanas: conferir sono e alimentação".
- **No Histórico:** Treino = "Método Par A" ou "Método Par B". A primeira linha leva "[Método Par · semana X · Fase]" nas Observações.

## Coach, academias, unilaterais e planos (desde 01/11/2026)
- **Coach (docs/js/coach.js):** aba para professor e alunos. Regras sem IA externa (custo zero): avaliação ao salvar o treino, resumo do mês e comparação de academias. Lê comentários por palavras-chave (sono, cansaço, ânimo, dor, alimentação, tempo, academia).
- **Períodos do Coach:** últimas 4 ou 12 semanas, 6 meses, tudo, um mês ou datas escolhidas. Compara com o período anterior de mesmo tamanho.
- **Academias antigas preenchidas pelos comentários (01/11/2026):** 05/10 Harmos, 13/10 Smartfit, 19 e 20/10 Force One Itajaí. O resto está sem academia.
- **Academia:** coluna N "Academia" no Histórico, criada sozinha em cada planilha. Peso e "última vez" vêm da academia escolhida.
- **Ânimo e duração:** vão como marcação nas Observações da 1ª linha do treino: [Ânimo: bom], [Duração: 72 min].
- **Unilaterais:** "... E" e "... D" viram um cartão com séries intercaladas (só na tela); na planilha continuam linhas com o nome do lado.
- **Biblioteca e planos:** docs/metodos/biblioteca.json (trocas por grupo) e docs/metodos/planos.json (6 planos gerais em "Treinos prontos").
- **Atualizar:** botão ↻ no topo relê a planilha e atualiza o app. Evolução: tocar no título fecha o bloco.
- **Acesso master:** só o link com a chave de professor. O link do aluno não tem a chave e o programa central recusa as funções de professor (testado).

## Tela inicial, tema e recado do coach (desde 01/11/2026, v2.6)
- **Navegação:** a barra de abas saiu. Tudo começa na tela inicial (mosaico com Treinar, Avaliação do Coach, Evolução, Avaliação física e Perfil; caixa Alunos só no acesso de professor). A seta ← e o Voltar do celular levam para a tela inicial. Configurações fica na engrenagem do topo.
- **Tema:** design Oceano, só claro ou escuro, escolhido em Configurações (`dt2-tema` no aparelho). Antes da escolha, segue o celular.
- **Recado do coach:** balão no topo da escolha do treino e do treino aberto, com o último parecer e o que esperar de hoje. Cada exercício mostra "Meta do coach". Aquecimento não vira meta.
- **Ânimo duplo:** marcado ao chegar e na tela Finalizar treino. Vai na 1ª linha, nas Observações: [Ânimo início: x], [Ânimo fim: x]. O antigo [Ânimo: x] conta como saída.
- **Parecer:** explica o porquê, compara com os últimos treinos iguais (volume, séries, tempo) e com outros dias de ânimo parecido, e dá metas por exercício. Continua por regras, sem IA paga (`docs/js/coach.js`).
- **Ícones:** Phosphor Icons Light (MIT), embutidos em `docs/js/icones.js` para funcionar sem internet.
- **Rascunhos do design:** pasta `rascunhos-design/`, só local, fora do site.

## IA do coach e memória (desde 01/11/2026, v2.7)
- **Visual (v2.9):** preto, prata e detalhes em azul. Treinar em prata com halter em 45 graus; ícones Phosphor Light, grandes, no canto inferior direito das caixas.
- **IA:** Cloudflare Workers AI, plano grátis, modelo `IA_MODELO` no Code.gs. Passou do limite grátis, dá erro e não cobra: o app mantém o parecer por regras. Máximo de 6 pareceres por aluno por dia.
- **Chaves:** `CF_CONTA` e `CF_TOKEN` nas Propriedades do script, gravadas pelo menu **Diário de Treino → Configurar IA do coach**. Nunca no código nem no celular.
- **Quem usa:** todos os alunos que aceitaram os termos, e sempre o professor na própria planilha (`PROF_PLANILHA`). Para desligar, a propriedade `IA_ALUNOS` = `nenhum`.
- **Aceite:** tela única ao abrir o link do aluno. A data fica na coluna "Aceite dos termos" da aba Alunos.
- **Voz do coach:** em `IA_SISTEMA` (Code.gs), com exemplos no jeito de falar do professor. Sem frases de efeito. O app garante uma frase final sobre o próximo treino (`fecho`).
- **Volume:** `avaliacaoVolume` compara as séries da semana com a média das 4 semanas anteriores (alto, bom ou abaixo). O coach só pede mais quando a semana e o grupo estão abaixo; senão, as metas são manter.
- **Nomes de academia:** `nomeAcademia()` em coach.js. Rex, Rex Fit e CT viram REX FIT CT; Smartfit vira Smartfit Batel. PHD, Braves e Force One levam o bairro, informado no treino.
- **Histórico preenchido em 01/11/2026 pelos comentários:** 22/07 PHD Mercês; 29/07 e 13/10 Smartfit Batel; 01/09, 16/10, 24/10, 26/10 e 29/10 REX FIT CT; 05/10 Harmos; 09/10 Braves Xaxim; 19, 20 e 22/10 Force One Itajaí.
- **Rosa e azul:** pelo campo Sexo da pessoa aberta (`data-genero`). Feminino usa rosa, e os demais usam azul, no nome, no Treinar, nos ícones e nos botões principais. A saudação é "Olá, nome. Vamos treinar!", com uma frase motivacional por dia (`FRASES` em app.js). O horário da planilha não aparece mais. O botão final é "Concluir treino", com fogos.
- **Gordura sem adipômetro:** `estimarGordura` em body.js, só para adultos. Ordem do valor principal: dobras, bioimpedância, medidas (Marinha dos EUA; sem pescoço, RFM) e, por último, peso, altura e idade (Deurenberg). O app avisa que é aproximado e mostra as duas estimativas. Bioimpedância, dobras e pressão arterial ficam escondidas no formulário quando vazias.
- **Páginas do professor:** a primeira tela é sempre do professor (aluno master, `master` em alunoParaProfessor_), com Treinar, quatro caixas à direita e Alunos em faixa. Em Alunos: cartões com linha de força, barra de baixo, Calendário de todos, Comparar e Escolher quem aparece (lista guardada no aparelho, `dt2-ocultos`). Ao abrir um aluno, `S.ctxAluno` liga a página do aluno, sem Treinar. Os dados vêm da ação `painel`, com resumo de 400 dias guardado por 6 horas e apagado quando o aluno grava. "Pede atenção" é montar treino ou 10 dias sem treinar.
- **Auxiliar do Coach (só professor):** a cada 30 dias corridos, com pelo menos 4 treinos, o app avisa "Relatório pronto". `docs/js/auxiliar.js` calcula os números e as regras (estratégia, cargas, volume e trocas); a IA só explica. Os limites são regras do app: força sobe a partir de +2,5% e cai a partir de −2,5%, mínimo de 10 e máximo de 20 séries por semana. Relatórios na aba "Auxiliar do Coach" da planilha do aluno. A IA só sugere métodos aprovados na aba "Métodos de treino" do Painel. O texto escrito na decisão abre a página Conferir mudança: a IA transforma o texto em alterações (`planejarDecisao_`), sem gravar, e o programa recusa exercícios que não existem. A página mostra só os treinos citados, já preenchidos e editáveis. Se o texto citar só o músculo, abre os treinos que têm esse músculo (`propostaPorMusculo_`), com os exercícios dele marcados. A aba Modelos só muda em Confirmar e salvar (`confirmarDecisao_`), e apenas nesses treinos. O treino anterior fica na coluna I, para Desfazer. A decisão "Não vou aplicar" não muda nada. A conversa não fica salva. Limite: 40 usos de IA por dia.
- **Treinos iniciais:** nos 3 primeiros treinos da pessoa, o coach é mais animado, mostra a porcentagem entregue e não pede carga nem volume.
- **Metas:** a lista "Metas" é de longo prazo e usa primeiro o que a pessoa comentou no último mês. O que fazer no próximo treino fica em lista separada.
- **Black Bull:** academia sugerida na lista do treino. Não apareceu nos comentários antigos, então não há treino antigo preenchido.
- **Academias:** com 3 treinos ou mais em pelo menos 2 academias nos últimos 120 dias, o coach compara o rendimento e sugere a melhor quando o treino não foi forte.
- **Semana e mês:** `contexto()` em coach.js soma as séries por grupo. Se algo caiu, confere se o exercício ou o grupo já foi feito na semana (veredito "ok" ou "faltou").
- **Falar com o professor:** botão no parecer quando há queda, dor ou sequência difícil, com o WhatsApp da linha do professor na aba Alunos. Aparece só no link do aluno.
- **Memória:** aba **Memória do Coach** em cada planilha (uma linha por treino: título, parecer, recado e resumo acumulado). A IA lê o último resumo antes de escrever.
- **Regras do texto:** tom profissional e motivador, sem perguntas. O programa central recusa texto com número que não esteja nos fatos.
- **Sequência difícil:** 8 ou mais treinos difíceis nos últimos 10 (ânimo baixo ou volume 15% abaixo da média) geram um pedido respeitoso para renovar a motivação.
- **Evolução:** comentário curto em cada caixa, por regras, sem gastar o limite da IA.
- **Permissão:** a IA usa `script.external_request`, já autorizada. Se uma permissão nova surgir, a sequência segura é: `clasp push`, o professor autoriza pelo menu, e só então `clasp deploy`.

## Link de teste para outro personal (desde 02/11/2026)
- **O que é:** `docs/teste.html`: o app de verdade, com 20 alunos fictícios criados no próprio aparelho (`docs/js/demo-worker.js`). O programa central roda no celular (`docs/js/demo-motor.js`, cópia do Code.gs). Não há acesso a planilhas nem a alunos reais. As alterações ficam só naquele aparelho.
- **Arquivos gerados:** `teste.html` e `demo-motor.js` são refeitos por `tools/versao.mjs` a cada versão, então acompanham o app.
- **Controle:** aba **Links de teste** do Painel. O endereço é `https://cleytonarthur-debug.github.io/diario-de-treino/teste.html#c=CÓDIGO`. O primeiro aparelho que abre fica sendo o único (coluna Aparelho). Para liberar outro aparelho, apague essa célula. Para cortar, escreva "não" em Ativo ou mude a Validade. Para criar outro link, acrescente uma linha com um código novo, sem símbolos.
- **IA:** real, pela ação `demoIa`, conferindo código e aparelho. Limite: 40 usos por link por dia, sem custo.
- **Limite da trava:** impede o uso em outro aparelho, mas não impede foto da tela. Quem abrir o link primeiro fica com ele.

## Novidades da versão 2.20 (02/11/2026)
- **Botão ✓:** com a série preenchida, confirma e não apaga. Tocar de novo só desfaz a confirmação.
- **Meta do coach na série:** só metas que sobem carga ou repetições (`metasTipo` = "sobe") aparecem na última série, em verde e com o peso preenchido. Cumpriu, fica dourada. Ao gravar, a série leva a marca `[Meta coach: ...]` nas Observações. `estadoMeta` (coach.js) refaz o caminho pelo histórico: bateu, firma por 3 treinos seguidos (se falhar, recomeça), consolida. No 4º treino é o padrão, sem meta nova; a próxima vem depois dele.
- **Evolução:** aluno vê setas e nível (`evoSetasHtml`). Professor troca entre setas e gráfico na chavinha (guardada no aparelho, `dt2-evo-modo`). Pontos: 10 por treino, 15 por recorde; cada 100 pontos, um nível.
- **Avaliação física:** rosca e barras logo abaixo dos números (`graficosAval`). Objetivo de peso (`estimarPeso`), guardado na coluna "Peso desejado" da aba Alunos. Regra: ao perder peso, ganho de massa magra de 18% da perda, até 3 kg, com piso de gordura de 10% (homem) e 18% (mulher). Ao ganhar peso, 60% vira massa magra. É estimativa de regra simples, não veio de estudo específico.
- **Financeiro (só professor):** abas **Financeiro** e **Pagamentos** do Painel. Liga e desliga no menu do Painel (propriedade `FINANCEIRO`). O app só registra: não recebe dinheiro. Chave Pix na propriedade `PIX_CHAVE`.
- **Aviso de vencimento:** só no app, por decisão do Cleyton em 02/11/2026: quem vence em até 7 dias ou está atrasado aparece pelo nome na tela inicial do professor (`finAvisos`). Não há e-mail nem notificação com o app fechado. O gatilho diário ligado no teste se apaga sozinho na primeira vez que rodar (`avisarVencimentos`). O dono já autorizou as permissões `script.send_mail`, `script.scriptapp` e `userinfo.email` que estão no manifesto.
- **Métodos prontos:** em Montar treinos. Bi-set pelo coach (`metMontar`, escolhe só da biblioteca) ou pela regra do app, se a IA falhar. Sequência por objetivo (`SEQUENCIAS`). O método fica escrito em Reps meta ("10 bi-set com X", "10 drop set"). Só vale ao tocar em Salvar treinos.
- **Conversa com o Coach Auxiliar:** em Montar treinos e em Métodos. A regra entra na aba **Meu jeito de trabalhar** só ao tocar em Guardar. `jeitoTexto_` é somado às instruções do relatório, da decisão, da conversa sobre o aluno e do bi-set.

## Coach lê os comentários (versão 2.21, 04/11/2026)
- **Leitura:** `comentariosDe` (coach.js) liga cada comentário ao exercício. O do fim do treino vale para o exercício que ele citar. Todos aparecem em "O que você comentou" e vão primeiro nos fatos da IA.
- **Metas pelo comentário:** carga que não existe ("não tem 22", `faltasDe`) sai da meta e não é mais firmada. O que pesou não sobe (`RX_PESADO`). O que ficou leve pode subir (`RX_LEVE`). Pedido de revisão (`RX_PEDIDO`) repete o que fez e aparece em "Pedidos para o professor rever". Com cansaço ou sono no dia, o app não pede repetição a mais.
- **Parte do corpo:** `parteCabe` só deixa a dor virar meta no treino que usa aquela parte. Ombro não entra em treino de perna.
- **IA:** seção "LEIA OS COMENTÁRIOS PRIMEIRO" em `IA_SISTEMA`. As regras do app definem as metas, e a IA explica. Os parecer já gravados na Memória do Coach não mudam sozinhos.

## Nível do aluno e começo dos treinos (versão 2.22, 04/11/2026)
- **Contato do celular:** botão abaixo do nome no cadastro do aluno. Usa a lista de contatos do navegador (`navigator.contacts`), que só existe no Chrome do Android. Nos outros aparelhos o botão não aparece e o número é digitado.
- **Nível:** coluna "Nível" da aba Alunos, só para o professor. Ao salvar a avaliação física, o app pergunta o nível e dá um palpite pelos treinos do último ano (`sugestaoNivel`: menos de 30 Iniciante, menos de 120 Intermediário, senão Avançado). É regra simples nossa, e quem decide é o professor.
- **Começar os treinos (Montar treinos):** treinos prontos do nível, copiar de outro aluno (`modelosDe`, sem as cargas) e "O coach monta os blocos" (`metTreinos`). A IA só usa exercícios da lista enviada, segue o "Meu jeito de trabalhar" e as restrições do aluno, e o programa recusa nome fora da lista. Nada vale antes de Salvar treinos.
- **Sem plano só para avançado:** `planos.json` tem Iniciante, Intermediário e Todos. O avançado usa os intermediários como base ou o coach.

## Relatório, metas com pergunta e incluir exercício (versão 2.23, 05/11/2026)
- **Incluir no meio:** botão "+ Incluir exercício aqui" entre os cartões do treino (`insHtml`, `addExercise(campo,pos)`) e botão "+" em cada linha de Montar treinos. Não aparece entre o "a" e o "b" de um par de método.
- **Último histórico:** ao incluir, o treino traz as séries e os pesos da última vez e mostra "Última vez em dd/mm" (`ultimaVez`). Em Montar treinos, um exercício novo já vem com séries, repetições e peso da última vez dele.
- **Metas com pergunta:** cada meta traz uma pergunta (`metasLongo`, `metasQ`). A resposta vai para a aba **Respostas às metas** da planilha do aluno (`metaResponder`), e a IA avalia pelo objetivo e pelo jeito do professor. Sem IA, a resposta fica guardada. O professor lê e não responde no lugar do aluno.
- **Relação com o treino:** `nexo` compara o desvio de volume nos treinos com e sem cada relato (sono, fraqueza, cansaço, alimentação, academia, e os positivos), nos últimos 90 dias. Regra nossa: menos de 2 treinos é "pouca base", diferença de 5 pontos ou mais é "pesou" ou "ajudou". É sinal, não prova.
- **Relatório do aluno:** no Perfil, só para o professor (`Coach.relatorio`): últimas 4 semanas contra as 4 anteriores, recordes, metas batidas, relatos, dores, pedidos e respostas. "Pedir parecer" usa a IA (`alunoParecer`) e grava na aba **Relatório do aluno**.

## Academia diferente, mês em andamento e tela do coach (versão 2.24, 05/11/2026)
- **Academia ou máquina diferente:** `acadDif` marca o treino fora da academia habitual dos últimos 120 dias, sem outro treino igual feito lá, ou com comentário como "outra academia" e "máquinas diferentes". `RX_MAQ` vale para um exercício só ("máquina diferente"). Nesses casos não há queda, nem cobrança, nem meta firmada perdida. O coach diz que os pesos mudaram e que confirma no próximo treino.
- **Mês em andamento:** compara com os mesmos dias do mês anterior. Até o dia 6, não comenta frequência nem queda de volume. A Avaliação do Coach abre em "Últimas 4 semanas".
- **Tela:** dois blocos, "Último treino" e "Parecer geral até aqui", com botão para pular. As metas com pergunta ficam no parecer geral.

## Fase 1: durante o treino (versão 2.25, 07/11/2026)
- **Check automático:** preencher as repetições marca o ✓ e liga o descanso, que aparece na própria série (`marcarDescanso`, `timHtml`). Tocar no ✓ de uma série preenchida só desfaz a confirmação.
- **Comparação:** o aluno só vê "🔥 X a mais que da última vez" quando superou. Igual ou abaixo, vê uma frase de `INCENTIVO`. O professor (`S.role==="prof"`) continua vendo superou, igual e abaixo.
- **Exercício concluído:** borda dourada e palmas (`exOk`, `exercicioPronto`). A cada 2 exercícios concluídos, "Bebeu água?" (`aguaHtml`). Vai para a 1ª linha como [Água: bebeu X de Y].
- **Pausa longa:** com 8 min ou mais sem registrar série, pergunta o motivo (`checarPausa`). Vai como [Pausa: máquina ocupada 9 min]. "Máquina ocupada" conta como tema de academia, não como queda.
- **IA lendo:** `iaLendo()` aparece onde a IA responde: parecer do treino, metas, relatório, conversas e montagem de blocos.
- **Histórico:** `Coach.base` ignora "cl", "cada lado" e "ambas" no fim do nome. "Primeira vez nesta academia" só aparece se a pessoa já registra academias, nunca treinou nesta e já fez o exercício.

## Fase 2: imagens, Evolução, desafios, boas-vindas, fotos e conversas (versão 2.26, 07/11/2026)
- **Imagens dos exercícios:** `docs/metodos/imagens.json` liga nomes em português (expressões) a 96 exercícios do free-exercise-db (domínio público), com 2 fotos cada, servidas pelo jsDelivr. Gerado por um script (lista de regras). Sem par: bicicleta no solo, perdigueiro, polichinelo e aquecimentos. Toque na foto abre maior, alternando as posições.
- **Parecer geral na Evolução:** saiu da Avaliação do Coach. Em cima da Evolução, nos dois modos: período e grupo muscular, "Pedir parecer deste período" (`evoParecer`: aluno motivador, coach analítico com ajustes), guardado na aba **Pareceres da evolução** e reaproveitado. O professor tem a conversa com o coach ali (`auxChat` com os fatos do período).
- **Previsão:** `Coach.projecao`, regressão da força estimada nas 12 semanas dos 3 exercícios mais feitos, com teto de +20%. **Caminho certo:** `Coach.caminhoCerto` a cada 4 semanas, só com dados que mostram isso. Só aparece com o app aberto.
- **Desafios da semana:** `Coach.desafios` por regras: frequência (média das 4 semanas) e mais 2 que mudam por semana (meta do coach, ânimo, comentário, água, recorde).
- **Boas-vindas:** uma vez por aparelho e pessoa, para o aluno, com o slogan.
- **Fotos da avaliação:** botões Frente, Lado e Costas na Avaliação física (só professor). A foto é reduzida a 1280 px e vai para "Diário de Treino — Fotos das avaliações/nome do aluno" no Drive do professor (`fotoSalvar`, `fotosListar`). Na versão de teste não salva.
- **Conversas salvas:** conversas com o Coach Auxiliar e da Evolução vão para a aba **Conversas com o coach** da planilha do aluno. As de "Meu jeito de trabalhar" vão para essa aba no Painel.

## Proteções
- Se a gravação falhar sem resposta clara, o app não reenvia. Ele relê a planilha e confere antes. O servidor também ignora o mesmo envio repetido (6 horas).
- Se o professor abrir no próprio celular o link de um aluno, o app pergunta antes de trocar de conta.

## Histórico
- 16/10: v1 com APK.
- 18/10: aba Modelos.
- 18/10: v2 com app instalável, multi-aluno, avaliação física e painéis.
- 18/10: v2.1 com cadastro feito pelo aluno, aviso ao professor e montagem de treinos no app.

## Privacidade e Termos (18/10/2026)
- Páginas `docs/privacidade.html` e `docs/termos.html` (estilo em `docs/css/legal.css`), com link discreto no fim da aba **Perfil** e incluídas no cache do service worker.
- **Controlador (LGPD):** Cleyton Arthur Santana Neres, cleytonarthur@gmail.com. Os dados de saúde estão declarados. Pedido de exclusão respondido em até 15 dias.
- **Se o app mudar o que guarda** (novo campo, novo serviço externo), atualize as duas páginas e a data no topo.

## Pendências
- Recomendado: no cadastro do aluno, uma caixa "Li e aceito a Política de Privacidade" para registrar o consentimento dos dados de saúde (LGPD art. 11).
- Uma planilha vazia "Treino — Cleyton Arthur Santana Neres" sobrou na pasta Alunos (pode apagar).

## Futuro (ver memória "ideias-futuras-diario")
Play Store, cobrança de quem não for autorizado (acesso master), divulgação, colegas educadores físicos, LGPD.

## Máquina, salto de carga e nomes padronizados (08/11/2026, v2.27.0)
- Histórico ganhou as colunas **Máquina** e **Salto de carga**. A carga, a "última vez", os recordes e as metas só comparam na mesma máquina.
- `docs/js/nomes.js` padroniza os nomes e separa a marca. Vtom, VTOX e Vox são a mesma marca (VTOX), a pedido do Cleyton.
- O professor aplica em **Perfil → Nomes dos exercícios** (ação `padronizarNomes`): troca no Histórico, Modelos, Exercícios e Catálogo. O lado D/E continua no fim do nome.
- Respostas às metas ganhou **Próxima pergunta**: a IA avalia e faz outra pergunta usando os comentários dos treinos. Sem IA, `proximaPergunta_` usa uma pergunta pronta.

## Fotos com troca suave (08/11/2026, v2.29.0)
- Os desenhos da v2.28.0 foram rejeitados pelo Cleyton ("incômodos de assistir") e retirados; estão no histórico do git (commit 83ff367).
- Voltaram as fotos do free-exercise-db. A troca entre as duas posições agora é um esmaecimento de 3,6 s (só CSS, sem peso a mais). O banco tem só duas fotos por exercício, então não há movimento real entre elas.
- Modelos por sexo: não feito. O banco quase só tem homens; mulheres só em exercícios fora da lista (119, 460, 461, 525, 805 na ordem do `exercises.json`). O app já tem `S.aluno.sexo`.

## Teste de fotos femininas no Colab (08/11/2026)
- `tools/colab/fotos-femininas.ipynb` troca o homem por uma mulher nas fotos do banco, usando a máquina grátis do Google Colab e a IA `ovedrive/qwen-image-edit-4bit` (Apache 2.0, uso comercial). A versão 2511 compacta é não comercial: não usar.
- Salva em `diario-fotos-femininas` no Drive, com `registro.txt`, e continua de onde parou. Ainda não testado numa máquina Colab; nada entrou no app.
- Decisão do Cleyton (08/11/2026): manter as fotos de homens para todos. Não há fonte grátis viável de modelos femininas; o arquivo do Colab foi retirado (está no histórico do git).

## Fotos femininas nos exercícios de pernas (08/11/2026, v2.30.0)
- O Cleyton mudou a decisão anterior: alunas veem a mulher nos exercícios de pernas e glúteos que deu para criar. Os demais continuam com a foto de homem.
- São 10 exercícios, 20 fotos (cerca de 1,3 MB) em `docs/fotos-femininas/`: agachamento, extensora, leg press, mesa flexora, cadeira flexora, stiff, elevação pélvica, afundo com halteres, abdutora e adutora. Criadas por IA no Runway a partir das fotos do free-exercise-db.
- A lista fica em `imagens.json`, chave `femininas`. `Metodos.imagem(nome, sexo)` usa a foto feminina quando o sexo começa com "F". Para somar um exercício: colocar `0.jpg` e `1.jpg` na pasta e incluir o nome em inglês na lista.
- Restam 3 créditos do Runway, que não renovam no plano grátis.

## Meu plano para o aluno (08/11/2026, v2.31.0)
- O aluno vê o próprio plano: botão **Meu plano** na tela inicial (plano, valor, vencimento, forma de pagamento e situação), a chave Pix e botões que abrem o WhatsApp do professor com a mensagem pronta: **Renovar meu plano** e **upgrade** para os planos mais longos. O app não cobra nem muda o plano sozinho: o professor combina o valor e registra no Financeiro.
- O programa central entrega ao aluno só a linha dele (`planoDoAluno_`, campo `plano` em `inicio`). A lista, os valores dos outros e os pagamentos continuam só do professor (`finLer` segue recusado ao aluno, testado).
- Sem a nova versão do programa central no ar, o botão não aparece (o site sozinho não mostra nada). Publicado no ar em 08/11/2026, com o sim direto do Cleyton: `clasp push -f` e `clasp deploy` na implantação numerada (versão 28 do script). Não mexe em permissões.
- Sem WhatsApp do professor cadastrado, a tela mostra os dados e pede para falar com ele.

## Meus métodos: o professor cria o próprio método (08/11/2026, v2.32.0)
- **Onde:** Perfil → **Meus métodos**, e na página do aluno (Montar treinos → Método de treino) o botão **Criar ou editar meus métodos**. Lista os métodos do app (Método Par: ver e copiar para editar) e os do professor (criado por você ou rascunho).
- **Cadastro em 5 passos:** nome e público; dias da semana (cada dia liga a uma letra de treino, A a F); treinos e exercícios (da biblioteca ou digitados, com séries, repetições, descanso e opção em segundos); fases (semanas, séries e repetições opcionais, repetições sobrando, cardio); aquecimento e progressão. Salva pronto ou como rascunho.
- **Ligar no aluno:** passo 1 **Ver como a aluna vai ver** (tela de conferência com semana, treino, fase, exercícios e progressão; não salva nada) e passo 2 **Ligar método**. A conferência também tem o botão Ligar.
- **Onde fica guardado:** aba **Meus métodos** do Painel (uma linha por método, definição em JSON). O programa central limpa e limita o que recebe (`limparMetodo_`). Apagar recusa método ligado em aluno. O aluno recebe só a definição do método dele (`metodoDef` em `inicio`); o professor recebe todos (`metodosProf`). Ações: `mpSalvar`, `mpApagar` (só professor).
- **Como o app usa:** método do professor tem `livre: true`: lista simples de exercícios (sem pares a/b), descanso por exercício (cronômetro usa o descanso do exercício), cabeçalho "Grupo · descanso N s". Série e repetições valem da fase; se a fase deixa vazio, valem as do exercício (`Metodos.efetiva`). O Método Par não mudou (testado).
- Ids dos métodos do professor começam com `m-`. A aba é criada na primeira leitura.

## Unilateral nos métodos do professor (08/11/2026, v2.33.0)
- No cadastro do método, cada exercício tem a caixa **Unilateral: faz a esquerda e logo depois a direita**. Ela marca sozinha quando o nome tem a palavra "unilateral" e o professor pode mudar. Vale também para métodos já salvos sem a caixa (`Metodos.ehUnilateral`: sem marcação, vale o nome).
- Para o aluno vira **um cartão só**, com as séries em sequência: Série 1 esquerdo, Série 1 direito, Série 2 esquerdo… (mesmo cartão do treino normal, `juntarUnilaterais`). Blocos de método do professor agora têm `par: 0` para poderem juntar; o cartão unido guarda descanso, grupo e tipo.
- **Descanso:** depois da série da esquerda segue direto para a direita; o descanso do exercício vem depois da direita.
- **Conferência:** mostra "por lado" e "esquerda e depois direita". Método Par não mudou (testado).

## Pirâmide, técnica e bi-set nos métodos do professor (08/11/2026, v2.34.0)
- No cadastro de cada exercício (passo 3): **Pirâmide** (as repetições de cada série, ex.: 15, 12, 10, 8; vale no lugar de séries e repetições e cada série mostra a sua meta), **Técnica** (texto livre: Rest-Pause, pico de 2 s…) e **Bi-set** (alterna com o próximo exercício).
- Para o aluno: bi-set mostra "Bi-set N · A + B · descanso", sem descanso entre os dois e com o descanso depois do par (o do primeiro exercício); a técnica e a pirâmide aparecem sob o cabeçalho do exercício. Exercício com pirâmide não mostra o aviso de subir carga por faixa de repetições. Repetições iguais mostram "10" em vez de "10-10".
- Backend: `limparMetodo_` aceita `pir` (2 a 10 números), `tec` (até 120 caracteres) e `bi` (forma par com o seguinte). O editor carrega e salva sem perder nada (testado).
- Os métodos de cada professor ficam na aba **Meus métodos** do Painel dele, não no código. Métodos pessoais não entram no repositório.

## Correção: Montar treinos preso em "Lendo a planilha do aluno…" (09/11/2026, v2.35.0)
- **Causa:** `fetchDados` reaproveitava a leitura em andamento mesmo quando era de outra pessoa (por exemplo, a do próprio professor, ainda lenta). A planilha do aluno novo nunca era pedida e a tela de Montar treinos esperava 30 s e ficava parada sem aviso. Reproduzido no simulador com leitura lenta.
- **Correção:** a leitura só é reaproveitada se for do mesmo aluno (`inflightId`). Montar treinos pede a leitura ao abrir; se ela falhar ou passar de 30 s, mostra "Não consegui ler a planilha deste aluno agora" com o botão **Tentar de novo**.

## Recado do professor e boas-vindas (09/11/2026, v2.36.0)
- **Recado:** na página de cada aluno, cartão "Recado para ..." (até 300 letras), "Último recado" com a data e se o aluno já viu, **Avisar pelo WhatsApp** e **Apagar**. O aluno vê o recado no topo da tela inicial; toca em **Ok, vamos lá** e ele some (fica marcado como visto). Tem **Responder no WhatsApp** quando o WhatsApp do professor está cadastrado. O app não manda aviso no celular.
- **Onde fica:** aba **Recados** do Painel (Aluno ID, Data, Texto, Lido em; vale o último de cada aluno). Ações do professor: `recEnviar`, `recApagar`. Do aluno: `recLido`. O aluno recebe só o recado dele (`recado` em `inicio`); o professor lê o do aluno aberto (`recado` em `dados`).
- **Boas-vindas:** texto do professor em **Perfil → Boas-vindas dos alunos** (`{nome}` vira o nome do aluno; vazio usa o texto padrão). Guardado na propriedade `TEXTO_BV` (ação `bvSalvar`). Aparece uma vez por aparelho e aluno, antes da apresentação do coach. Com programa central antigo, mostra só a apresentação do coach.

## Perfil do professor: Nomes dos exercícios no topo (09/11/2026, v2.36.1)
- O cartão **Nomes dos exercícios** ficava no fim do Perfil, depois dos cartões novos, e sumia enquanto os dados da planilha não chegavam. Agora é o segundo cartão (depois de Meus métodos) e, sem os dados, mostra "Lendo os dados da planilha…". **Boas-vindas dos alunos** virou um cartão que abre e fecha.

## Método ligado: confirmação clara (09/11/2026, v2.36.2)
- Ao ligar um método, a mensagem diz "✓ Método ligado para NOME: método. Confirmado na planilha." (vem da resposta do programa central, não só do que o app acha). No cartão Método de treino aparece a caixa verde "✓ Método ligado para NOME" com método, início e semana. Na página do aluno há a etiqueta verde "Método: nome".
- Se a planilha tem um método ligado mas o app ainda não carregou os detalhes dele, aparece um aviso amarelo (em vez de parecer "nenhum método") e o app relê a lista sozinho uma vez.

## Cartão do aluno: "Não iniciado" (09/11/2026, v2.36.3)
- No cartão do aluno, quem ainda não registrou nenhum treino mostra **Não iniciado** (antes "Ainda sem treino", que parecia treino não montado).

## Correção: relógio de descanso parado em 0:00 (09/11/2026, v2.36.4)
- **Relato:** aluna no Método Par via "Descanso 0:00" parado. **Causa:** ao marcar uma série com o ✓ em outro cartão, o relógio do cartão anterior não era removido, ficavam dois, e o app só atualizava o primeiro da tela. **Correção:** o ✓ remove o relógio antigo e a atualização anda todos os relógios. Reproduzido e testado no simulador.

## Avaliação do Coach mais humana e baseada no relato (09/11/2026, v2.37.0)
- **Pedido:** a avaliação estava genérica. Agora vale para todos os alunos e para o professor (programa central + app, mesma IA).
- **A IA recebe os fatos de cada exercício** (`exerciciosDeHoje`: séries feitas, meta, vez anterior, relato do exercício e próximo passo) e os **relatos do dia** (`relatosDoDia`: pausa, água, ânimo, duração). O prompt (`IA_SISTEMA`) manda abrir reagindo ao que a pessoa viveu, citar 2 a 3 exercícios com números reais e terminar com o próximo passo concreto. Parecer de 70 a 120 palavras. Proibido português de Portugal e frases de efeito.
- **Comparação de volume corrigida** (`coach.js`): só conta os exercícios que existem nos dois treinos (mínimo 2 e metade do treino). Treino com exercícios muito diferentes mostra "Treino com exercícios novos" em vez de um percentual enganoso (+142%).
- Frases de regra repetidas (já feito na semana, meta batida) agora variam.
- Pareceres já gravados não mudam; os novos usam o texto novo. Programa central: implantação nova (mesma URL).

## Botão temporário: reavaliar os últimos 3 treinos (09/11/2026, v2.37.1)
- Em **Perfil → Reavaliar os últimos 3 treinos** (só professor): **Prévia** (só os treinos do professor, usa `soTeste`, não grava) e **Reavaliar todos** (toque duplo; `refazer:true`, troca o parecer salvo dos 3 últimos treinos de cada aluno ativo e do professor). Usa a IA do app (Cloudflare), sem gasto de tokens do Claude. O texto do resultado fica em `S.reavLog` porque a tela redesenha quando os dados de cada aluno chegam.
- **Temporário:** será removido na v2.37.2. Os pareceres gravados ficam na aba de memória de cada planilha e não dependem do botão.

## Botão de reavaliar removido (09/11/2026, v2.37.2)
- O botão **Reavaliar os últimos 3 treinos** foi tirado do Perfil. Os pareceres gerados continuam gravados na planilha de cada pessoa. A IA nova segue valendo (está no programa central, v2.37.0).

## IA do coach mais atenta: evolução, dias, academia (09/11/2026, v2.37.3)
- **Evolução:** por exercício a IA recebe as últimas 3 vezes (melhor série) e o recorde de sempre, e deve dizer se a pessoa está subindo, estável ou voltou atrás.
- **Dado fora do padrão:** se o número de hoje fica abaixo de metade do da última vez, sem comentário da pessoa, `numeroForaDoPadrao` vale verdadeiro, o próximo passo não repete o número e a IA pede para conferir o lançamento (caso do Supino 10 kg × 4 da Sthefany em 02/11).
- **Dia ruim / bom:** `tipoDeDia` (ruim se há sono, cansaço, pouco ânimo ou ânimo ruim; bom com ânimo bom e treino forte). Ruim: acolher, sem cobrar. Bom: aproveitar, sem inventar subida.
- **Academia:** `academiaPadrao` (a mais usada) e `academiaHoje`; comenta só quando foi em outra.
- **Frases proibidas** ("é importante", "lembre-se", "continue assim", "manter esse nível", formas de Portugal) agora são travadas no programa central (`IA_PROIBIDAS`): se a IA usar uma, ou um número que não está nos fatos, ela tenta de novo uma vez com o motivo.
- A IA também deve reagir a dúvida, pedido, dor ou reclamação escrita pela pessoa.

## Conceito da IA do coach (fixo, não perder) (09/11/2026)
Este é o jeito da Avaliação do Coach e vale para o professor e todos os alunos. Qualquer mudança em `IA_SISTEMA`, `fatosIA` (coach.js) ou `parecerIA_` (Code.gs) deve preservar isto, e só muda o tom se o professor pedir.
- **Onde roda:** programa central, Cloudflare Workers AI (grátis). Nunca gasta o Claude do professor.
- **Voz:** português do Brasil, "você", primeira pessoa do professor, direto e humano. Proibido português de Portugal e frases prontas (`IA_PROIBIDAS`: "é importante", "lembre-se", "continue assim", "manter esse nível", "a constância"…). Se usar, refaz uma vez com o motivo.
- **Provar que leu:** abre reagindo ao que a pessoa viveu e escreveu (relatos, pausa, água, dor, troca de exercício); cita 2 a 3 exercícios com números reais; termina com o próximo passo concreto (`proximoPasso`, calculado pelas regras: a IA não inventa meta). Responde a dúvida, pedido ou reclamação, ou diz que vai ao professor.
- **Evolução:** confronta com `ultimasVezes`, `vezAnterior` e `recordeAnterior`.
- **Dia ruim** (`tipoDeDia`): acolhe, não cobra, mantém ou recupera; dor = reduzir carga e avisar o professor. **Dia bom:** aproveita e celebra, sobe só onde as regras mandam.
- **Academia:** conhece a padrão (`academiaPadrao`); só comenta quando foi em outra.
- **Segurança:** só números dos fatos; número muito abaixo do histórico sem explicação (`numeroForaDoPadrao`) não vira meta e pede para conferir o lançamento; comparação de volume só entre exercícios iguais; texto recusado cai no parecer por regras.
- **Fatos enviados à IA:** `exerciciosDeHoje`, `relatosDoDia`, `tipoDeDia`, `academiaHoje`, `academiaPadrao`, comentários, metas, semana, mês, ânimo, máquinas.

## IA do coach em 3 etapas e correções do parecer de 10/11 (11/11/2026, v2.38.0)
- **Defeitos vistos no parecer de 10/11:** "mesmo com a academia sendo a mesma" (regra mal aplicada), fecho genérico colado contradizendo o texto, séries listadas sem comparar com a evolução, modelo pequeno.
- **Três etapas, modelos grátis de famílias diferentes** (programa central, `parecerIA_`): **analista** `IA_ANALISTA` (gpt-oss-120b, raciocínio) lê os fatos e decide o que importa; **redator** `IA_REDATOR` (Llama 3.3 70B) escreve com a voz do coach; **revisor** `IA_REVISOR` (gpt-oss-120b) confere uma checklist e devolve o texto corrigido se reprovar. Se um modelo falha, o seguinte assume (redator cai no Llama 4 Scout; sem analista ou revisor, segue sem eles). Tudo ainda passa por `defeito()` (cita 2 exercícios, sem frase proibida, sem número inventado, sem academia sem motivo) e uma segunda tentativa.
- **Custo:** cerca de 400 neurons por parecer (limite grátis: 10.000 por dia, zera 21h de Brasília). Se acabar, o app mostra o parecer por regras. Modelos que exigem plano pago (Kimi, GLM 5, DeepSeek V4) ficaram de fora de propósito (custo zero).
- **Academia:** só vai para a IA quando o treino foi fora da academia padrão (`academiaPadrao`, `academiaOndeTreinouHoje`).
- **Refazer sozinho:** o resumo acumulado ganha `[v3] ` (`IA_VERSAO_PARECER`). Ao abrir a Avaliação do Coach, o app pede o parecer do último treino com `seAntigo:true`; se o salvo não tem a marca, é refeito uma vez. Trava `ia-rodando` de 150 s evita gastar a IA em duplicidade.
- **App:** a chamada do parecer espera até 150 s (`Api.call` ganhou o tempo como 3º parâmetro) e a tela diz "pode levar cerca de 1 minuto".

## Frases do coach e aviso de limite do dia (11/11/2026, v2.38.1)
- **Enquanto o coach lê:** todas as telas com "lendo" trocam a linha de baixo a cada 6 s ("Enviei o seu treino para o coach…", "O coach está lendo cada série…", "Já vai ter um parecer, só um pouquinho", etc.). Vale para o professor e para os alunos.
- **Limite grátis da Cloudflare acabou** (erro com "neuron/allocation/4006"): o programa central responde `motivo:'sem_neurons'`, guarda `ia-sem-neurons` por 30 min (para de tentar) e não conta como uso do dia. O app mostra "Hoje o coach já usou todas as leituras do dia. Amanhã ele lê o seu treino…" e mantém o resumo por regras. No dia seguinte (limite zera às 21h de Brasília), ao abrir a Avaliação do Coach o parecer é gerado, porque o app pede o parecer do último treino sempre que não há um salvo.
- **Demora ou já em andamento:** aviso "O coach ainda está escrevendo" e o app confere de novo sozinho (até 4 vezes, a cada 20 s). Falha comum: "abra de novo daqui a pouco".
- Falhas não consomem o limite de 6 por dia do aluno.

## Treinar: o treino da vez vem no topo (12/11/2026, v2.38.2)
- Na tela **Treinar → Qual treino hoje?**, a sugestão ("o da rotação parado há mais tempo") agora vem sempre em primeiro lugar. Os demais seguem na ordem de antes. Só o app mudou, sem mexer no programa central.
