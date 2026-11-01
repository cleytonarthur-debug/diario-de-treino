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
- **Academias:** com 3 treinos ou mais em pelo menos 2 academias nos últimos 120 dias, o coach compara o rendimento e sugere a melhor quando o treino não foi forte.
- **Semana e mês:** `contexto()` em coach.js soma as séries por grupo. Se algo caiu, confere se o exercício ou o grupo já foi feito na semana (veredito "ok" ou "faltou").
- **Falar com o professor:** botão no parecer quando há queda, dor ou sequência difícil, com o WhatsApp da linha do professor na aba Alunos. Aparece só no link do aluno.
- **Memória:** aba **Memória do Coach** em cada planilha (uma linha por treino: título, parecer, recado e resumo acumulado). A IA lê o último resumo antes de escrever.
- **Regras do texto:** tom profissional e motivador, sem perguntas. O programa central recusa texto com número que não esteja nos fatos.
- **Sequência difícil:** 8 ou mais treinos difíceis nos últimos 10 (ânimo baixo ou volume 15% abaixo da média) geram um pedido respeitoso para renovar a motivação.
- **Evolução:** comentário curto em cada caixa, por regras, sem gastar o limite da IA.
- **Permissão:** a IA usa `script.external_request`, já autorizada. Se uma permissão nova surgir, a sequência segura é: `clasp push`, o professor autoriza pelo menu, e só então `clasp deploy`.

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
