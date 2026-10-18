# Registro do projeto: Diário de Treino 2 (app instalável)

Última atualização: 18/10/2026

## O que é
O app é um **site instalável** (PWA). Ele se atualiza sozinho e funciona em Android e iPhone. Um **programa central** no Google Apps Script cuida dos dados. Cada aluno tem a própria planilha no Drive do professor.

Substitui a versão 1 (APK, pasta `diario-de-treino-app`).

## Endereços
| O quê | Onde |
|---|---|
| App | https://cleytonarthur-debug.github.io/diario-de-treino/ |
| Código (GitHub, público, sem dados) | https://github.com/cleytonarthur-debug/diario-de-treino |
| Planilha Painel do Professor (abas Alunos e Catálogo de exercícios) | https://docs.google.com/spreadsheets/d/1kSZaLnRL5UL4TQWexPt2faBxP8Ls3_8k9En3OezKT5E/edit |
| Programa central (Apps Script ligado ao Painel) | scriptId `1_EhLQqx4sZXgKoYlL3CXs76ry1mkkoBcwF_fqMfi6_k4RqSvBAz2MH4n` |
| Implantação (URL /exec, não muda) | `AKfycbztFNMiyDaVQpbpO3ZJXdEmDmfXKXqQCOeY6rTGflYqE1sjyXS5W_MsZVF3o8zGMn1djQ` |
| Planilhas dos alunos | pasta "Diário de Treino — Alunos" no Drive |
| Planilha do professor (como aluno) | "Treino evolução" `1futpdUQZ8uzgw3Y42YHhcpfOZUgFzrBLddzABwdUS8I` |

- **Link de professor:** abra o Painel e use o menu **Diário de Treino → Meu link de professor**. A chave fica nas Propriedades do script, não no código.
- **Links dos alunos:** ficam no app (Perfil do aluno) e na coluna "Código de acesso" da aba Alunos.

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

## Proteções
- Se a gravação falhar sem resposta clara, o app não reenvia. Ele relê a planilha e confere antes. O servidor também ignora o mesmo envio repetido (6 horas).
- Se o professor abrir no próprio celular o link de um aluno, o app pergunta antes de trocar de conta.

## Histórico
- 16/10: v1 com APK.
- 18/10: aba Modelos.
- 18/10: v2 com app instalável, multi-aluno, avaliação física e painéis.
- 18/10: v2.1 com cadastro feito pelo aluno, aviso ao professor e montagem de treinos no app.

## Pendências
- Data de nascimento do professor está como 26/11/1900. Falta o ano certo.
- Uma planilha vazia "Treino — Cleyton Arthur Santana Neres" sobrou na pasta Alunos (pode apagar).

## Futuro (ver memória "ideias-futuras-diario")
Play Store, cobrança de quem não for autorizado (acesso master), divulgação, colegas educadores físicos, LGPD.
