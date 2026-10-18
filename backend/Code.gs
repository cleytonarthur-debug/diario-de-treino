/**
 * Diário de Treino — programa central ("Painel do Professor").
 *
 * Fica ligado à planilha "Diário de Treino — Painel do Professor", que tem a aba Alunos.
 * Cada aluno tem a própria planilha (Histórico, Exercícios, Modelos, Avaliações) numa
 * pasta do Drive do professor. O app (site instalável) conversa só com este programa.
 *
 * Acesso:
 *  - professor: chave guardada nas Propriedades do script (menu Diário de Treino → Meu link)
 *  - aluno: código de acesso da aba Alunos (vai no link enviado pelo WhatsApp)
 *
 * Todas as chamadas são POST com corpo JSON (texto): {action, p|t, aluno?, ...}
 */

const VERSAO = '2.0.0';
const APP_URL = 'https://cleytonarthur-debug.github.io/diario-de-treino/'; // endereço do app (site)
const API_URL_PADRAO = 'https://script.google.com/macros/s/AKfycbztFNMiyDaVQpbpO3ZJXdEmDmfXKXqQCOeY6rTGflYqE1sjyXS5W_MsZVF3o8zGMn1djQ/exec';

const ABA_ALUNOS = 'Alunos';
const HEAD_ALUNOS = ['ID', 'Nome', 'Nascimento', 'Sexo', 'Altura (cm)', 'Objetivo', 'Telefone', 'E-mail',
  'Planilha', 'Código de acesso', 'Ativo', 'Criado em', 'Observações', 'Peso (kg)', 'Dias por semana', 'Situação',
  'Método', 'Início do método'];
const A = { id: 0, nome: 1, nasc: 2, sexo: 3, altura: 4, objetivo: 5, telefone: 6, email: 7,
  planilha: 8, codigo: 9, ativo: 10, criado: 11, obs: 12, peso: 13, dias: 14, status: 15, metodo: 16, metodoInicio: 17 };
// Situação do aluno: 'aguardando cadastro' → (aluno preenche) → 'montar treino' → (professor monta) → 'ok'
const ST_CADASTRO = 'aguardando cadastro', ST_MONTAR = 'montar treino', ST_OK = 'ok';
const ABA_CATALOGO = 'Catálogo de exercícios';

const ABA_HIST = 'Histórico', ABA_EX = 'Exercícios', ABA_MOD = 'Modelos', ABA_AV = 'Avaliações';
const HEAD_HIST = ['Data', 'Dia', 'Treino', 'Horário', 'Grupo', 'Exercício', 'Série', 'Reps meta',
  'Reps feitas', 'Peso', 'Intensidade', 'Reps sobrando', 'Observações'];
const HEAD_EX = ['Exercício', 'Grupo'];
const HEAD_MOD = ['Treino', 'Exercício', 'Séries', 'Reps meta', 'Peso inicial'];
const HEAD_AV = ['Data'];
const MAX_ROWS_POR_ENVIO = 500;

/* =============== menu da planilha (só o professor vê) =============== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Diário de Treino')
    .addItem('Meu link de professor', 'mostrarLinkProfessor')
    .addItem('Definir endereço do app da Web', 'definirEnderecoApi')
    .addSeparator()
    .addItem('Trocar minha chave de professor', 'trocarChaveProfessor')
    .addToUi();
}

function ativar_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PROF_KEY')) props.setProperty('PROF_KEY', novoCodigo_(32));
  pastaAlunos_();
  abaAlunos_();
  return props;
}

function apiUrl_() {
  return PropertiesService.getScriptProperties().getProperty('API_URL') || API_URL_PADRAO;
}

function linkProfessor_() {
  const props = ativar_();
  const api = apiUrl_();
  if (!api) return null;
  return APP_URL + '#api=' + encodeURIComponent(api) + '&p=' + props.getProperty('PROF_KEY');
}

function mostrarLinkProfessor() {
  const link = linkProfessor_();
  const ui = SpreadsheetApp.getUi();
  if (!link) {
    ui.alert('Falta o endereço do app da Web. Use o menu Diário de Treino → Definir endereço do app da Web.');
    return;
  }
  const t = HtmlService.createTemplate(
    '<div style="font:14px/1.5 Arial,sans-serif">' +
    '<p>Este é o <b>seu link de professor</b>. Abra no celular para instalar o app. ' +
    '<b>Não envie para alunos</b>: com ele dá para ver e cadastrar todos.</p>' +
    '<textarea id="l" style="width:100%;height:110px;font-size:12px" readonly><?= link ?></textarea>' +
    '<p><button onclick="var l=document.getElementById(\'l\');l.select();document.execCommand(\'copy\');this.textContent=\'Copiado!\'">Copiar</button> ' +
    '<a target="_blank" href="https://wa.me/?text=<?= encodeURIComponent(link) ?>">Enviar para o meu WhatsApp</a></p></div>');
  t.link = link;
  ui.showModalDialog(t.evaluate().setWidth(520).setHeight(300), 'Diário de Treino');
}

function definirEnderecoApi() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Endereço do app da Web',
    'Cole a URL que aparece em Implantar → Gerenciar implantações (termina em /exec):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { ui.alert('Endereço inválido. Ele precisa terminar em /exec.'); return; }
  PropertiesService.getScriptProperties().setProperty('API_URL', url);
  mostrarLinkProfessor();
}

function trocarChaveProfessor() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Trocar a chave?', 'O link de professor antigo para de funcionar. Os links dos alunos continuam valendo.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('PROF_KEY', novoCodigo_(32));
  mostrarLinkProfessor();
}

/* =============== entrada da API =============== */

function doGet() {
  return json_({ ok: true, app: 'Diário de Treino', versao: VERSAO });
}

function doPost(e) {
  try {
    let b;
    try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (x) { throw appErr_('bad_request', 'Pedido inválido.'); }
    const ctx = auth_(b);
    const fn = ACOES[b.action];
    if (!fn) throw appErr_('bad_request', 'Ação desconhecida: ' + b.action);
    return json_(Object.assign({ ok: true, versao: VERSAO }, fn(ctx, b)));
  } catch (err) {
    return fail_(err);
  }
}

const ACOES = {
  inicio: function (ctx) {
    const out = { papel: ctx.papel };
    if (ctx.papel === 'prof') { out.alunos = listarAlunos_().map(alunoParaProfessor_); out.catalogo = catalogo_(); }
    else out.aluno = perfil_(ctx.aluno);
    return out;
  },
  dados: function (ctx) {
    const al = precisaAluno_(ctx);
    const ss = abrirPlanilhaAluno_(al);
    const modelos = lerAba_(ss, ABA_MOD, HEAD_MOD.length);
    if (al.status === ST_MONTAR && modelos.length) { al.status = ST_OK; escreverAluno_(al); }
    return {
      aluno: ctx.papel === 'prof' ? alunoParaProfessor_(al) : perfil_(al),
      historico: lerAba_(ss, ABA_HIST, HEAD_HIST.length),
      exercicios: lerAba_(ss, ABA_EX, HEAD_EX.length),
      modelos: modelos,
      avaliacoes: lerAvaliacoes_(ss)
    };
  },
  // O próprio aluno completa o cadastro na primeira vez que abre o app.
  meuCadastro: function (ctx, b) {
    if (ctx.papel !== 'aluno') throw appErr_('forbidden', 'Só o aluno preenche o próprio cadastro.');
    const al = ctx.aluno, d = b.dados || {};
    ['nasc', 'sexo', 'altura', 'peso', 'objetivo', 'dias', 'email', 'obs'].forEach(function (k) {
      if (d[k] !== undefined) al[k] = String(d[k]).trim().slice(0, 500);
    });
    if (!al.nasc || !al.sexo || !al.altura) throw appErr_('bad_request', 'Preencha data de nascimento, sexo e altura.');
    if (al.status !== ST_OK) {
      const temTreino = !!al.metodo || lerAba_(abrirPlanilhaAluno_(al), ABA_MOD, HEAD_MOD.length).length > 0;
      al.status = temTreino ? ST_OK : ST_MONTAR;
    }
    escreverAluno_(al);
    return { aluno: perfil_(al) };
  },
  // Professor liga (ou desliga) um método de treino no aluno, com a data de início (dd/mm/aaaa).
  aplicarMetodo: function (ctx, b) {
    precisaProf_(ctx);
    const al = precisaAluno_(ctx);
    const metodo = String(b.metodo || '').trim().slice(0, 60);
    const inicio = String(b.inicio || '').trim();
    if (metodo && !/^\d{2}\/\d{2}\/\d{4}$/.test(inicio)) throw appErr_('bad_request', 'Informe a data de início do método.');
    al.metodo = metodo; al.metodoInicio = metodo ? inicio : '';
    if (metodo) al.status = ST_OK;
    escreverAluno_(al);
    return { aluno: alunoParaProfessor_(al) };
  },
  // Professor monta os treinos pelo app: substitui o conteúdo da aba Modelos do aluno.
  salvarModelos: function (ctx, b) {
    precisaProf_(ctx);
    const al = precisaAluno_(ctx);
    const linhas = limparLinhas_(b.linhas || [], HEAD_MOD.length).map(function (r) { return r.map(String); })
      .filter(function (r) { return r[0].trim() && r[1].trim(); });
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw appErr_('busy', 'Ocupado. Tente de novo.');
    try {
      const ss = abrirPlanilhaAluno_(al);
      const sh = ss.getSheetByName(ABA_MOD);
      const last = sh.getLastRow();
      if (last > 1) sh.getRange(2, 1, last - 1, HEAD_MOD.length).setValues(
        Array.apply(null, Array(last - 1)).map(function () { return ['', '', '', '', '']; }));
      if (linhas.length) {
        if (linhas.length + 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), linhas.length + 1 - sh.getMaxRows());
        sh.getRange(2, 1, linhas.length, HEAD_MOD.length).setNumberFormat('@').setValues(linhas);
      }
      // exercícios novos entram na lista do aluno e no catálogo do professor
      const novos = limparLinhas_(b.exerciciosNovos || [], 2);
      if (novos.length) {
        const known = {};
        lerAba_(ss, ABA_EX, 2).forEach(function (r) { known[norm_(r[0])] = true; });
        const add = novos.filter(function (r) { const k = norm_(r[0]); if (!k || known[k]) return false; known[k] = true; return true; });
        if (add.length) acrescentar_(ss.getSheetByName(ABA_EX), add, 2);
        adicionarCatalogo_(novos);
      }
      if (linhas.length && al.status !== ST_OK) { al.status = ST_OK; escreverAluno_(al); }
      SpreadsheetApp.flush();
      return { linhas: linhas.length };
    } finally {
      lock.releaseLock();
    }
  },
  gravar: function (ctx, b) {
    const al = precisaAluno_(ctx);
    return gravarTreino_(al, b.rows, b.exercicios, b.saveId);
  },
  avaliacao: function (ctx, b) {
    precisaProf_(ctx);
    const al = precisaAluno_(ctx);
    return gravarAvaliacao_(abrirPlanilhaAluno_(al), b.valores || {}, b.linha);
  },
  alunos: function (ctx) {
    precisaProf_(ctx);
    return { alunos: listarAlunos_().map(alunoParaProfessor_) };
  },
  salvarAluno: function (ctx, b) {
    precisaProf_(ctx);
    return { aluno: alunoParaProfessor_(salvarAluno_(b.dados || {})) };
  },
  novoCodigo: function (ctx) {
    precisaProf_(ctx);
    const al = precisaAluno_(ctx);
    al.codigo = novoCodigo_(20);
    escreverAluno_(al);
    return { aluno: alunoParaProfessor_(al) };
  }
};

/* =============== acesso =============== */

function auth_(b) {
  const props = PropertiesService.getScriptProperties();
  const prof = props.getProperty('PROF_KEY');
  if (b.p) {
    if (!prof) throw appErr_('server_key_missing', 'O professor ainda não ativou o programa (menu Diário de Treino → Meu link de professor).');
    if (String(b.p) !== prof) { Utilities.sleep(800); throw appErr_('bad_key', 'Link de professor inválido.'); }
    const ctx = { papel: 'prof' };
    if (b.aluno) {
      ctx.aluno = listarAlunos_().filter(function (a) { return a.id === String(b.aluno); })[0];
      if (!ctx.aluno) throw appErr_('not_found', 'Aluno não encontrado.');
    }
    return ctx;
  }
  if (b.t) {
    const al = listarAlunos_().filter(function (a) { return a.codigo && a.codigo === String(b.t); })[0];
    if (!al) { Utilities.sleep(800); throw appErr_('bad_key', 'Link de acesso inválido. Peça um novo ao seu professor.'); }
    if (!al.ativo) throw appErr_('inactive', 'Seu acesso está pausado. Fale com seu professor.');
    return { papel: 'aluno', aluno: al };
  }
  Utilities.sleep(800);
  throw appErr_('bad_key', 'Acesso negado.');
}

function precisaProf_(ctx) { if (ctx.papel !== 'prof') throw appErr_('forbidden', 'Só o professor pode fazer isso.'); }
function precisaAluno_(ctx) { if (!ctx.aluno) throw appErr_('bad_request', 'Escolha um aluno.'); return ctx.aluno; }

/* =============== alunos =============== */

function abaAlunos_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_ALUNOS);
  if (!sh) {
    sh = ss.insertSheet(ABA_ALUNOS, 0);
    sh.getRange(1, 1, 1, HEAD_ALUNOS.length).setValues([HEAD_ALUNOS]).setFontWeight('bold')
      .setBackground('#0f1b2d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('A:M').setNumberFormat('@');
    sh.setColumnWidth(2, 200); sh.setColumnWidth(9, 260); sh.setColumnWidth(10, 180);
    sh.getRange('J1').setNote('Código que vai no link do aluno. Para cortar o acesso, coloque "não" na coluna Ativo.');
    const s1 = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
    if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  } else if (sh.getLastColumn() < HEAD_ALUNOS.length) {
    // versão nova com mais colunas: completa o cabeçalho
    sh.getRange(1, 1, 1, HEAD_ALUNOS.length).setValues([HEAD_ALUNOS]).setFontWeight('bold')
      .setBackground('#0f1b2d').setFontColor('#ffffff');
    sh.getRange(1, 1, sh.getMaxRows(), HEAD_ALUNOS.length).setNumberFormat('@');
  }
  return sh;
}

/* Catálogo de exercícios do professor (aba na planilha Painel). Na primeira vez é
   montado juntando a aba Exercícios de todos os alunos. */
function abaCatalogo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_CATALOGO);
  if (sh) return sh;
  sh = ss.insertSheet(ABA_CATALOGO);
  sh.getRange(1, 1, 1, 2).setValues([['Exercício', 'Grupo']]).setFontWeight('bold').setBackground('#0f1b2d').setFontColor('#ffffff');
  sh.setFrozenRows(1); sh.setColumnWidth(1, 320);
  const seen = {}, rows = [];
  listarAlunos_().forEach(function (a) {
    try {
      lerAba_(SpreadsheetApp.openById(idPlanilha_(a.planilha)), ABA_EX, 2).forEach(function (r) {
        const k = norm_(r[0]); if (k && !seen[k]) { seen[k] = true; rows.push([r[0], r[1] || '']); }
      });
    } catch (x) { /* planilha sem acesso: ignora */ }
  });
  rows.sort(function (a, b) { return a[0].localeCompare(b[0], 'pt-BR'); });
  if (rows.length) acrescentar_(sh, rows, 2);
  return sh;
}
function catalogo_() {
  abaCatalogo_();
  return lerAba_(SpreadsheetApp.getActiveSpreadsheet(), ABA_CATALOGO, 2);
}
function adicionarCatalogo_(rows) {
  const sh = abaCatalogo_();
  const known = {};
  lerAba_(SpreadsheetApp.getActiveSpreadsheet(), ABA_CATALOGO, 2).forEach(function (r) { known[norm_(r[0])] = true; });
  const add = rows.filter(function (r) { const k = norm_(r[0]); if (!k || known[k]) return false; known[k] = true; return true; });
  if (add.length) acrescentar_(sh, add, 2);
}

function listarAlunos_() {
  const sh = abaAlunos_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEAD_ALUNOS.length).getDisplayValues().map(function (r, i) {
    return {
      linha: i + 2, id: r[A.id], nome: r[A.nome], nasc: r[A.nasc], sexo: r[A.sexo], altura: r[A.altura],
      objetivo: r[A.objetivo], telefone: r[A.telefone], email: r[A.email], planilha: r[A.planilha],
      codigo: r[A.codigo], ativo: !/^(n|nao|não|false|0)$/i.test(String(r[A.ativo]).trim()), criado: r[A.criado], obs: r[A.obs],
      peso: r[A.peso] || '', dias: r[A.dias] || '', status: String(r[A.status] || '').trim() || ST_OK,
      metodo: String(r[A.metodo] || '').trim(), metodoInicio: String(r[A.metodoInicio] || '').trim()
    };
  }).filter(function (a) { return a.id && a.nome; });
}

function perfil_(a) {
  return { id: a.id, nome: a.nome, nasc: a.nasc, sexo: a.sexo, altura: a.altura, objetivo: a.objetivo,
    peso: a.peso, dias: a.dias, obs: a.obs, email: a.email, status: a.status,
    metodo: a.metodo || '', metodoInicio: a.metodoInicio || '',
    cadastroPendente: a.status === ST_CADASTRO };
}

function alunoParaProfessor_(a) {
  const p = perfil_(a);
  p.telefone = a.telefone; p.ativo = a.ativo; p.criado = a.criado;
  p.planilhaUrl = a.planilha ? 'https://docs.google.com/spreadsheets/d/' + idPlanilha_(a.planilha) + '/edit' : '';
  const api = apiUrl_();
  p.link = a.codigo && api ? APP_URL + '#api=' + encodeURIComponent(api) + '&t=' + a.codigo : '';
  return p;
}

function escreverAluno_(a) {
  const row = [];
  row[A.id] = a.id; row[A.nome] = a.nome || ''; row[A.nasc] = a.nasc || ''; row[A.sexo] = a.sexo || '';
  row[A.altura] = a.altura || ''; row[A.objetivo] = a.objetivo || ''; row[A.telefone] = a.telefone || '';
  row[A.email] = a.email || ''; row[A.planilha] = a.planilha || ''; row[A.codigo] = a.codigo || '';
  row[A.ativo] = a.ativo === false ? 'não' : 'sim'; row[A.criado] = a.criado || ''; row[A.obs] = a.obs || '';
  row[A.peso] = a.peso || ''; row[A.dias] = a.dias || ''; row[A.status] = a.status || ST_OK;
  row[A.metodo] = a.metodo || ''; row[A.metodoInicio] = a.metodoInicio || '';
  abaAlunos_().getRange(a.linha, 1, 1, HEAD_ALUNOS.length).setValues([row.map(String)]);
}

function salvarAluno_(d) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw appErr_('busy', 'Ocupado. Tente de novo.');
  try {
    const campos = ['nome', 'nasc', 'sexo', 'altura', 'objetivo', 'telefone', 'email', 'obs', 'peso', 'dias'];
    if (d.id) {
      const a = listarAlunos_().filter(function (x) { return x.id === String(d.id); })[0];
      if (!a) throw appErr_('not_found', 'Aluno não encontrado.');
      campos.forEach(function (k) { if (d[k] !== undefined) a[k] = String(d[k]).trim(); });
      if (d.ativo !== undefined) a.ativo = !!d.ativo;
      if (!a.nome) throw appErr_('bad_request', 'O nome é obrigatório.');
      escreverAluno_(a);
      return a;
    }
    const nome = String(d.nome || '').trim();
    if (!nome) throw appErr_('bad_request', 'O nome é obrigatório.');
    let planilhaId;
    if (d.planilhaExistente) {
      planilhaId = idPlanilha_(d.planilhaExistente);
      try { SpreadsheetApp.openById(planilhaId); } catch (x) { throw appErr_('not_found', 'Não consegui abrir essa planilha. Confira o link.'); }
    } else {
      planilhaId = criarPlanilhaAluno_(nome);
    }
    const sh = abaAlunos_();
    const a = { linha: sh.getLastRow() + 1, id: 'A' + Date.now().toString(36).toUpperCase(), ativo: true,
      planilha: planilhaId, codigo: novoCodigo_(20),
      criado: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy') };
    campos.forEach(function (k) { a[k] = String(d[k] || '').trim(); });
    // Importou a planilha antiga: já tem treinos. Senão o aluno completa o cadastro pelo app.
    a.status = d.planilhaExistente ? ST_OK : (a.nasc && a.sexo && a.altura ? ST_MONTAR : ST_CADASTRO);
    escreverAluno_(a);
    return a;
  } finally {
    lock.releaseLock();
  }
}

function pastaAlunos_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PASTA_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (x) { /* recria */ } }
  const f = DriveApp.createFolder('Diário de Treino — Alunos');
  props.setProperty('PASTA_ID', f.getId());
  return f;
}

function criarPlanilhaAluno_(nome) {
  const ss = SpreadsheetApp.create('Treino — ' + nome);
  ss.setSpreadsheetLocale('pt_BR');
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');
  DriveApp.getFileById(ss.getId()).moveTo(pastaAlunos_());
  ss.getSheets()[0].setName(ABA_HIST);
  garantirAbas_(ss);
  return ss.getId();
}

function idPlanilha_(s) {
  const m = String(s || '').match(/\/d\/([\w-]{20,})/);
  return m ? m[1] : String(s || '').trim();
}

function abrirPlanilhaAluno_(a) {
  let ss;
  try { ss = SpreadsheetApp.openById(idPlanilha_(a.planilha)); }
  catch (x) { throw appErr_('sheet_missing', 'A planilha deste aluno não foi encontrada (pode ter sido apagada).'); }
  garantirAbas_(ss);
  return ss;
}

// Cria as abas que faltarem. Na planilha antiga do professor, cria Modelos já preenchida.
function garantirAbas_(ss) {
  const cab = function (sh, head) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#0f1b2d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  };
  let h = ss.getSheetByName(ABA_HIST);
  if (!h) h = ss.insertSheet(ABA_HIST);
  if (h.getLastRow() === 0) {
    cab(h, HEAD_HIST);
    h.getRange('A2:A').setNumberFormat('dd/MM/yyyy');
    h.getRange('D2:D').setNumberFormat('HH:mm');
    h.setColumnWidth(6, 260); h.setColumnWidth(13, 260);
  }
  if (!ss.getSheetByName(ABA_EX)) { const s = ss.insertSheet(ABA_EX); cab(s, HEAD_EX); s.setColumnWidth(1, 260); }
  if (!ss.getSheetByName(ABA_MOD)) {
    const s = ss.insertSheet(ABA_MOD);
    const linhas = h.getLastRow() > 1 ? montarModelos_(lerAba_(ss, ABA_HIST, HEAD_HIST.length)) : [];
    s.getRange(1, 1, Math.max(50, linhas.length + 20), HEAD_MOD.length).setNumberFormat('@');
    cab(s, HEAD_MOD);
    if (linhas.length) s.getRange(2, 1, linhas.length, HEAD_MOD.length).setValues(linhas);
    s.setColumnWidth(1, 180); s.setColumnWidth(2, 300); s.setColumnWidth(4, 160); s.setColumnWidth(5, 120);
    s.getRange('A1').setNote('Nome do treino. Linhas com o mesmo nome formam um treino, na ordem em que estão.');
    s.getRange('D1').setNote('Meta de repetições. Uma só (12) vale para todas as séries. Uma por série: 15; 12; 10; 8');
    s.getRange('E1').setNote('Usado só quando o exercício nunca foi feito. Depois o app sugere o último peso usado.');
  }
  if (!ss.getSheetByName(ABA_AV)) { const s = ss.insertSheet(ABA_AV); cab(s, HEAD_AV); s.setFrozenColumns(1); }
}

/* =============== leitura =============== */

function lerAba_(ss, name, cols) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols).getDisplayValues()
    .filter(function (r) { return r.some(function (c) { return c !== ''; }); })
    .map(aparar_);
}

function lerAvaliacoes_(ss) {
  const sh = ss.getSheetByName(ABA_AV);
  if (!sh || sh.getLastRow() < 1) return { cabecalho: HEAD_AV, linhas: [] };
  const cols = Math.max(1, sh.getLastColumn());
  const vals = sh.getRange(1, 1, sh.getLastRow(), cols).getDisplayValues();
  return {
    cabecalho: vals[0],
    linhas: vals.slice(1).map(function (r, i) { return { linha: i + 2, valores: r }; })
      .filter(function (x) { return x.valores.some(function (c) { return c !== ''; }); })
  };
}

function aparar_(r) { let n = r.length; while (n > 0 && r[n - 1] === '') n--; return r.slice(0, n); }

/* =============== gravação =============== */

function gravarTreino_(al, rowsIn, exIn, saveId) {
  const rows = limparLinhas_(rowsIn, HEAD_HIST.length);
  const exs = limparLinhas_(exIn || [], HEAD_EX.length);
  if (!rows.length && !exs.length) throw appErr_('bad_request', 'Nenhuma linha para gravar');
  if (rows.length > MAX_ROWS_POR_ENVIO) throw appErr_('bad_request', 'Linhas demais num envio só');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw appErr_('busy', 'A planilha está ocupada com outra gravação. Tente de novo em instantes.');
  try {
    const cache = CacheService.getScriptCache();
    const ck = saveId ? 'save:' + al.id + ':' + String(saveId).slice(0, 150) : null;
    if (ck) { const prev = cache.get(ck); if (prev) return Object.assign(JSON.parse(prev), { duplicate: true }); }
    const ss = abrirPlanilhaAluno_(al);
    let firstRow = null;
    if (rows.length) firstRow = acrescentar_(ss.getSheetByName(ABA_HIST), rows, HEAD_HIST.length);
    let exAdded = 0;
    if (exs.length) {
      const known = {};
      lerAba_(ss, ABA_EX, 2).forEach(function (r) { known[norm_(r[0])] = true; });
      const novos = exs.filter(function (r) { const k = norm_(r[0]); if (!k || known[k]) return false; known[k] = true; return true; });
      if (novos.length) { acrescentar_(ss.getSheetByName(ABA_EX), novos, HEAD_EX.length); exAdded = novos.length; }
    }
    SpreadsheetApp.flush();
    const res = { written: rows.length, firstRow: firstRow, exercicios: exAdded };
    if (ck) cache.put(ck, JSON.stringify(res), 21600);
    return res;
  } finally {
    lock.releaseLock();
  }
}

// valores: {"Peso (kg)": 80.5, "Cintura (cm)": 84, ...}. Cria colunas que faltarem.
// linha: se vier, substitui aquela linha (editar avaliação); senão acrescenta no fim.
function gravarAvaliacao_(ss, valores, linha) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw appErr_('busy', 'Ocupado. Tente de novo.');
  try {
    const sh = ss.getSheetByName(ABA_AV);
    const head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0].filter(String);
    Object.keys(valores).forEach(function (k) {
      k = String(k).trim();
      if (k && head.indexOf(k) < 0) head.push(k);
    });
    if (head.indexOf('Data') < 0) head.unshift('Data');
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#0f1b2d').setFontColor('#ffffff');
    const row = head.map(function (k) {
      let v = valores[k];
      if (v === undefined || v === null) return '';
      if (typeof v === 'number') return v;
      v = String(v);
      return /^=/.test(v) ? "'" + v : v;
    });
    const n = Number(linha);
    const alvo = n >= 2 && n <= sh.getLastRow() ? n : sh.getLastRow() + 1;
    if (alvo > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), alvo - sh.getMaxRows());
    sh.getRange(alvo, 1, 1, head.length).setValues([row]);
    SpreadsheetApp.flush();
    return { linha: alvo };
  } finally {
    lock.releaseLock();
  }
}

function acrescentar_(sh, rows, cols) {
  const start = sh.getLastRow() + 1;
  const need = start + rows.length - 1 - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
  sh.getRange(start, 1, rows.length, cols).setValues(rows);
  return start;
}

function limparLinhas_(rows, cols) {
  if (!Array.isArray(rows)) throw appErr_('bad_request', 'Formato de linhas inválido');
  return rows.map(function (r) {
    if (!Array.isArray(r)) throw appErr_('bad_request', 'Formato de linhas inválido');
    const out = [];
    for (let i = 0; i < cols; i++) {
      let v = r[i];
      if (v === null || v === undefined) v = '';
      if (typeof v === 'boolean') v = v ? 'sim' : 'não';
      if (typeof v !== 'number') v = String(v);
      if (typeof v === 'string' && /^=/.test(v)) v = "'" + v;
      out.push(v);
    }
    return out;
  });
}

/* =============== modelos iniciais a partir do histórico =============== */

function montarModelos_(historico) {
  const sess = {}, datas = {};
  historico.forEach(function (r) {
    const t = String(r[2] || '').trim();
    const m = String(r[0] || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!t || !m) return;
    sess[t] = r[0] + '|' + t;
    datas[t] = new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  });
  const nomes = Object.keys(sess);
  if (!nomes.length) return [];
  const maisRecente = Math.max.apply(null, nomes.map(function (t) { return datas[t]; }));
  let ativos = nomes.filter(function (t) { return maisRecente - datas[t] <= 120 * 864e5; });
  if (!ativos.length) ativos = nomes;
  ativos.sort(function (a, b) { return datas[b] - datas[a]; });
  const out = [];
  ativos.forEach(function (t) {
    const ordem = [], porEx = {};
    historico.forEach(function (r) {
      if (r[0] + '|' + String(r[2] || '').trim() !== sess[t]) return;
      const ex = String(r[5] || '').trim();
      if (!ex) return;
      if (!porEx[ex]) { porEx[ex] = []; ordem.push(ex); }
      porEx[ex].push(r);
    });
    ordem.forEach(function (ex) {
      const rs = porEx[ex];
      const metas = rs.map(function (r) { return String(r[7] || '').trim(); });
      const iguais = metas.every(function (x) { return x === metas[0]; });
      out.push([t, ex, String(rs.length), iguais ? metas[0] : metas.join('; '), String(rs[0][9] || '').trim()]);
    });
  });
  return out;
}

/* =============== utilitários =============== */

function novoCodigo_(n) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random());
  let s = '';
  for (let i = 0; i < n; i++) s += abc[(bytes[i % bytes.length] + 256 + i * 7 + Math.floor(Math.random() * 256)) % abc.length];
  return s;
}

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function appErr_(code, message) { const e = new Error(message); e.appCode = code; return e; }

function fail_(err) {
  if (!err.appCode) console.error(err && err.stack || err);
  return json_({ ok: false, error: err.appCode || 'server_error', message: String(err.message || err) });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
