(function(){
"use strict";
const GROUPS=[
  {k:"Inferiores",v:"--g-inf"},{k:"Costas",v:"--g-cos"},{k:"Peito",v:"--g-pei"},{k:"Braços",v:"--g-bra"},{k:"Ombros",v:"--g-omb"}];
const GROUP_VAR={Inferiores:"--g-inf",Costas:"--g-cos",Peito:"--g-pei","Braços":"--g-bra",Ombros:"--g-omb","Abdômen":"--g-abd"};
const DIAS=["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];

const $=s=>document.querySelector(s);
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const fmtDate=d=>pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear();
const fmtShort=d=>pad(d.getDate())+"/"+pad(d.getMonth()+1);
const hhmm=d=>pad(d.getHours())+":"+pad(d.getMinutes());
const nf1=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1});
const nf0=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
const nf2=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const strip=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const {load,put}=Api.store;
function store(k,v){if(v===undefined)return load(k);put(k,v);return v}

/* ---------- leitura dos dados da planilha ---------- */
function parseDate(s){const m=String(s||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?new Date(+m[3],+m[2]-1,+m[1]):null}
function parsePeso(s){
  s=String(s||"").toLowerCase().replace(/,/g,".");
  if(!s.trim())return null;
  const cl=/\bcl\b|cada lado/.test(s);
  const parts=s.split(">").map(p=>{const m=p.match(/(\d+(?:\.\d+)?)/);return m?parseFloat(m[1])*(cl?2:1):null});
  if(parts[0]==null)return null;
  return parts;
}
function parseReps(feitas,meta){
  let s=String(feitas==null?"":feitas).toLowerCase().trim();
  if(!s)return null;
  if(/^ok\b/.test(s)||s==="feito"){s=String(meta||"").toLowerCase();if(/completar\s*(\d+)/.test(s)){return [parseInt(s.match(/completar\s*(\d+)/)[1])]}}
  if(/min|seg|round|nao fiz|não fiz/.test(s))return null;
  const parts=s.split("+").map(p=>{const m=p.match(/\d+/);return m?parseInt(m[0]):null}).filter(x=>x!=null&&x<200);
  return parts.length?parts:null;
}
function setVolume(reps,peso){
  if(!reps||!peso)return 0;
  if(reps.length>1&&peso.length>1){let v=0;reps.forEach((r,i)=>{const p=peso[Math.min(i,peso.length-1)];if(p!=null)v+=r*p});return v}
  return reps.reduce((a,b)=>a+b,0)*peso[0];
}
function e1rm(reps,peso){if(!reps||!peso||!peso[0])return 0;const r=reps[0];if(!r||r>20)return 0;return peso[0]*(1+r/30)}
function exKey(name){return strip(name).replace(/\b(d|e|direit[oa]|esquerd[oa]|doreita|lado d|lado e|cl|ambas?)\s*$/,"").replace(/\s+/g," ").trim()}
// A ordem importa: nomes de músculo explícitos (bíceps, tríceps) vêm antes de palavras de aparelho (cross, polia).
const RX=[["Abdômen",/abs|abdom|prancha/],["Braços",/rosca|triceps|biceps|barra w|scott|martelo|frances|antebraco/],
  ["Ombros",/elevacao lateral|elevacao frontal|desenvolvimento|face ?pull|posterior de ombro|voador reverso|ombro/],
  ["Peito",/supino|voador peito|peito|cross|crucifixo|peck|fly|mergulho|paralela/],["Costas",/pulley|puxada|remada|pull ?down|barra fixa|serrote|costas|lombar/],
  ["Inferiores",/extensora|flexora|leg|agach|hack|stiff|panturrilha|pantu|[cs]imeri[ao][nm] 45|vto[mn] 45|adutor|abdutor|glute|afundo|bulgaro|cadeira|mesa|perna|terra|pelvica/]];
function guessGroup(name){const bg=window.Metodos&&Metodos.bibGrupo(name);if(bg)return bg;const k=strip(name);for(const [g,rx] of RX)if(rx.test(k))return g;return "Sem grupo"}
// Grupo muscular escolhido pelo usuário (o palpite do app pode errar).
const GRUPOS_TODOS=["Inferiores","Costas","Peito","Braços","Ombros","Abdômen","Cardio","Sem grupo"];
function grupoSelect(g,attrs){
  const opts=GRUPOS_TODOS.includes(g)?GRUPOS_TODOS:[g].concat(GRUPOS_TODOS);
  return '<select class="gsel" '+attrs+' aria-label="Grupo muscular" title="Toque para corrigir o grupo muscular">'+opts.map(x=>'<option'+(x===g?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select>';
}

/* ---------- estado ---------- */
const S={role:null,alunos:[],alunoId:null,aluno:null,rows:[],memoria:new Map(),iaTentou:new Set(),exMap:new Map(),models:new Map(),avals:[],
  loaded:false,loadedAt:null,error:null,view:"inicio",fim:false,period:12,groups:new Set(GROUPS.map(g=>g.k)),
  draft:null,confirm:false,saving:false,pending:null,checking:false,picker:false,
  forcaEx:null,medida:null,avSel:null,avEdit:null,avPt:null,alunoForm:null,shareFor:null,busca:""};
const keyA=()=>S.alunoId||"eu";
const DRAFT_KEY=()=>"dt2-rascunho-"+keyA();
const PENDING_KEY=()=>"dt2-pendente-"+keyA();

function ingest(values){
  const out=[];
  (values||[]).forEach((r,i)=>{
    const d=parseDate(r[0]);if(!d)return;
    const hor=String(r[3]||"");const skipped=/n[aã]o fiz/i.test(hor);
    const reps=skipped?null:parseReps(r[8],r[7]);const peso=parsePeso(r[9]);
    out.push({i,date:d,dateS:r[0],dia:r[1]||"",treino:String(r[2]||"").trim(),hora:hor,grupo:S.exMap.get(strip(r[5]))||r[4]||guessGroup(r[5]),ex:String(r[5]||"").trim(),
      serie:r[6]||"",meta:r[7]||"",feitas:r[8]||"",peso:r[9]||"",int:r[10]||"",rir:r[11]==null?"":String(r[11]),obs:r[12]||"",academia:String(r[13]||"").trim(),maq:String(r[14]||"").trim(),salto:String(r[15]||"").trim(),
      reps,pesoN:peso,vol:setVolume(reps,peso),e1:e1rm(reps,peso),done:!!reps});
  });
  S.rows=out;
}
function sessions(){
  const m=new Map();
  S.rows.forEach(r=>{const k=r.dateS+"|"+r.treino;if(!m.has(k))m.set(k,{key:k,date:r.date,dateS:r.dateS,treino:r.treino,rows:[]});m.get(k).rows.push(r)});
  return [...m.values()].sort((a,b)=>a.date-b.date||a.rows[0].i-b.rows[0].i);
}
const splitList=s=>String(s==null?"":s).split(";").map(x=>x.trim());
function ingestModels(values){
  const m=new Map();
  (values||[]).forEach(r=>{
    const t=String(r[0]||"").trim(),ex=String(r[1]||"").trim();if(!t||!ex)return;
    const n=Math.max(1,Math.min(20,parseInt(r[2],10)||3));
    if(!m.has(t))m.set(t,[]);
    m.get(t).push({ex,series:n,metas:splitList(r[3]),pesos:splitList(r[4])});
  });
  S.models=m;
}
function ingestAvals(av){
  const head=(av&&av.cabecalho)||[];
  S.avals=((av&&av.linhas)||[]).map(x=>{
    const v={};head.forEach((h,i)=>{if(h)v[h]=x.valores[i]==null?"":String(x.valores[i])});
    return {linha:x.linha,dataS:v["Data"]||"",date:parseDate(v["Data"]),v};
  }).filter(a=>a.date).sort((a,b)=>a.date-b.date||a.linha-b.linha);
}
function ingestAll(d){
  // a aba Exercícios vem primeiro: o grupo dela (que o usuário pode corrigir) vale também para treinos antigos
  S.exMap=new Map();(d.exercicios||[]).forEach(r=>{if(r[0]&&r[1])S.exMap.set(strip(r[0]),r[1])});
  S.exList=(d.exercicios||[]).map(r=>String(r[0]||"").trim()).filter(Boolean);
  ingest(d.historico);
  ingestModels(d.modelos);Coach.setModelos(S.models);
  ingestAvals(d.avaliacoes);
  if(d.professor!==undefined)S.profWhats=d.professor||"";
  S.metasResp=d.metasResp||[];S.evoPar=d.evoPar||[];
  S.memoria=new Map((d.memoria||[]).map(r=>[r[0]+"|"+r[1],{titulo:r[2]||"",parecer:r[3]||"",recado:r[4]||""}]));
  if(d.aluno)S.aluno=d.aluno;
}

/* ---------- conexão ---------- */
function setSync(kind,text){$("#sync").innerHTML='<span class="dot '+kind+'"></span><span>'+esc(text)+'</span>';$("#sync").title=text;const s=$("#saudacao .sa-sync");if(s)s.textContent=text}
function banner(html,bad){$("#banner").innerHTML=html?'<div class="banner'+(bad?" bad":"")+'">'+html+'</div>':""}
function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,3800)}
function errText(e){
  const c=e&&e.code;
  switch(c){
    case "offline":return "Sem internet. Você pode continuar lançando: o rascunho fica guardado neste celular. Para gravar na planilha, espere a conexão voltar.";
    case "not_configured":return "Este aparelho ainda não tem acesso. Abra o link que o professor enviou.";
    case "bad_key":return e.message||"Link de acesso inválido. Peça um novo ao seu professor.";
    case "inactive":return e.message||"Seu acesso está pausado. Fale com seu professor.";
    case "server_key_missing":return e.message||"O programa central ainda não foi ativado pelo professor.";
    case "bad_deploy":return "O programa central não respondeu como esperado. Avise o professor.";
    case "sheet_missing":case "not_found":case "forbidden":return e.message||"Não encontrado.";
    case "busy":return "A planilha estava ocupada com outra gravação. Nada foi gravado; tente de novo.";
    case "timeout":return "A planilha demorou demais para responder. A internet pode estar fraca.";
    case "network":return "Não consegui falar com a planilha (falha de rede). Confira a internet.";
    case "bad_response":return "A planilha respondeu de um jeito inesperado ("+(e.message||"sem detalhe")+").";
    default:return e&&e.message?e.message:"Não consegui falar com a planilha ("+(c||"erro")+"). Tente de novo.";
  }
}
// Chamada no contexto do aluno escolhido (o professor manda o id do aluno).
function callA(action,body){return Api.call(action,Object.assign(S.role==="prof"?{aluno:S.alunoId}:{},body||{}))}

async function refreshInicio(){
  try{
    const d=await Api.call("inicio");
    Api.cacheSet("inicio",d);applyInicio(d,true);
  }catch(e){
    if(["bad_key","inactive","server_key_missing"].includes(e.code)){banner("<p>"+esc(errText(e))+"</p>",true);setSync("err","Sem acesso")}
    else if(e.code==="offline"){setSync("err","Sem internet");netBanner()}
    else{setSync("err","Sem conexão");banner("<p>"+esc(errText(e))+"</p>",true)}
    render();
  }
}
function applyInicio(d,fresh){
  if(S.role==="prof"){
    S.alunos=d.alunos||[];
    const sel=masterId()||store("dt2-aluno-sel");
    if(!S.alunoId&&sel&&S.alunos.some(a=>a.id===sel))selectAluno(sel,true);
    else if(S.alunoId){const a=S.alunos.find(x=>x.id===S.alunoId);if(a)S.aluno=Object.assign({},S.aluno,a)}
    if(d.catalogo)S.catalogo=d.catalogo;
    if(fresh){profNotice();carregarPainel()}
  }else if(d.aluno){
    const first=!S.alunoId;S.aluno=d.aluno;S.alunoId=d.aluno.id;
    if(first){S.draft=store(DRAFT_KEY());S.pending=store(PENDING_KEY());loadDados()}
    if(d.professor!==undefined)S.profWhats=d.professor||"";
    if(fresh&&!d.aluno.aceite)showAceite();
    else if(d.aluno.aceite&&d.aluno.cadastroPendente)showCadastro();
  }
  updateWho();
  if(fresh&&!S.alunoId)setSync("ok","Conectado");
  render();
}
function selectAluno(id,quiet){
  if(S.alunoId===id&&S.loaded){if(!quiet)setView("inicio");return}
  S.alunoId=id;store("dt2-aluno-sel",id);
  S.aluno=S.alunos.find(a=>a.id===id)||null;
  S.rows=[];S.metasResp=[];S.evoPar=[];S.evoChat=null;S.fotosAv={};S.relParecer=null;S.memoria=new Map();S.loaded=false;S.avals=[];S.models=new Map();S.exMap=new Map();S.error=null;
  S.draft=store(DRAFT_KEY());S.pending=store(PENDING_KEY());S.confirm=false;S.fim=false;S.picker=false;S.avSel=null;S.avEdit=null;S.forcaEx=null;S.medida=null;S.modEdit=null;
  updateWho();
  loadDados();
  if(!quiet)setView("inicio");
}
function loadDados(){
  const c=Api.cacheGet("dados-"+keyA());
  if(c){ingestAll(c);S.loaded=true;S.loadedAt=new Date(c.storedAt);setSync("ok","Dados de "+(fmtDate(S.loadedAt)!==fmtDate(new Date())?fmtShort(S.loadedAt)+" ":"")+hhmm(S.loadedAt));render()}
  else{setSync("busy","Lendo a planilha…");render()}
  return fetchDados();
}
let inflight=null;
function fetchDados(){
  if(!S.alunoId)return Promise.resolve(false);
  if(inflight)return inflight;
  const id=S.alunoId;
  if(!S.loaded)setSync("busy","Lendo a planilha…");
  inflight=callA("dados").then(d=>{
    if(S.alunoId!==id)return false;
    Api.cacheSet("dados-"+id,d);ingestAll(d);
    S.loaded=true;S.error=null;S.loadedAt=new Date();
    setSync("ok","Planilha lida às "+hhmm(S.loadedAt));
    if(!navigator.onLine)netBanner();else if(!S.pending)banner("");
    updateWho();render();
    if(S.pending&&!S.checking)verifyPending(true);
    return true;
  }).catch(e=>{
    if(S.alunoId!==id)return false;
    S.error=e;
    setSync("err",e.code==="offline"?"Sem internet":S.loaded?"Dados de "+(S.loadedAt?hhmm(S.loadedAt):"antes"):"Sem dados");
    banner("<p>"+esc(errText(e))+(S.loaded&&e.code!=="offline"?" Os dados mostrados são da última leitura.":"")+"</p>",!S.loaded);
    render();return false;
  }).finally(()=>{inflight=null});
  return inflight;
}
function netBanner(){banner("<p>"+esc(errText({code:"offline"}))+"</p>")}
window.addEventListener("offline",()=>{setSync("err","Sem internet");netBanner();updateBar()});
window.addEventListener("online",()=>{banner("");updateBar();if(S.alunoId)fetchDados();else if(Api.config())refreshInicio()});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&S.alunoId&&navigator.onLine&&(!S.loadedAt||Date.now()-S.loadedAt>60000))fetchDados();
});

function idade(a){const n=Body.idadeEm(a&&a.nasc);return isFinite(n)?n:null}
function updateWho(){renderTopo()}

/* ========== TREINAR ========== */
function templates(){
  const ss=sessions();const by=new Map();
  ss.forEach(s=>{if(!s.treino)return;const prev=by.get(s.treino);by.set(s.treino,{last:s,count:(prev?prev.count:0)+1})});
  const hist=[...by.entries()].map(([name,o])=>({name,last:o.last,count:o.count})).sort((a,b)=>b.last.date-a.last.date);
  const byKey=new Map(hist.map(t=>[strip(t.name),t]));
  // Método de treino ligado ao aluno: os treinos do método vêm primeiro.
  const mt=metodoAluno();const list=[];
  if(mt)Object.entries(mt.m.treinos).forEach(([k,t])=>{const h=byKey.get(strip(t.nome));
    list.push({name:mt.m.nome+" – Treino "+k,metodo:{m:mt.m,k,F:mt.F},histName:t.nome,last:h?h.last:null,count:h?h.count:0})});
  if(!S.models.size&&!list.length)return hist;
  [...S.models.entries()].forEach(([name,items])=>{const h=byKey.get(strip(name));list.push({name,model:items,last:h?h.last:null,count:h?h.count:0})});
  const used=new Set(list.map(t=>strip(t.histName||t.name)));
  hist.forEach(t=>{if(!used.has(strip(t.name)))list.push(Object.assign({other:true},t))});
  return list;
}
function metodoAluno(){
  const a=S.aluno;if(!a||!a.metodo||!window.Metodos)return null;
  const m=Metodos.get(a.metodo);if(!m)return null;
  const F=Metodos.fase(m,a.metodoInicio,new Date());if(!F)return null;
  return {m,F};
}
function suggestion(list){
  const mt=metodoAluno();
  if(mt&&!mt.F.antes){const k=Metodos.treinoDoDia(mt.m,new Date());if(k)return mt.m.nome+" – Treino "+k}
  list=list.filter(t=>t.last&&!t.other&&!t.metodo);
  const now=Date.now();const recent=list.filter(t=>now-t.last.date<21*864e5);
  if(!recent.length)return list.length?list[0].name:null;
  return recent.slice().sort((a,b)=>a.last.date-b.last.date)[0].name;
}
function lastFor(exName){
  const k=exKey(exName);
  for(let i=S.rows.length-1;i>=0;i--){const r=S.rows[i];if(exKey(r.ex)===k&&r.done){
    const sameDay=S.rows.filter(x=>x.dateS===r.dateS&&exKey(x.ex)===k);return sameDay}}
  return null;
}
function lastExact(name){const all=lastFor(name)||[];const ex=all.filter(r=>strip(r.ex)===strip(name));return ex.length?ex:all}
const pickN=(arr,i)=>arr.length?(arr[Math.min(i,arr.length-1)]||""):"";
const newId=()=>Math.random().toString(36).slice(2);
function planosHtml(){
  const ps=window.Metodos?Metodos.planos():[];if(!ps.length)return "";
  return '<details class="others"><summary>Treinos prontos ('+ps.length+' planos gerais)</summary>'+ps.map(p=>'<div class="par-h">'+esc(p.nome)+'</div><p class="muted small" style="margin:0 0 6px">'+esc([p.nivel,p.dias,p.local].join(" · "))+'. '+esc(p.descricao)+'</p><div class="pick">'+
    p.treinos.map((t,i)=>'<button data-t="" data-plano="'+esc(p.id)+'" data-pi="'+i+'"><b>'+esc(t.nome)+'</b><span class="muted small">'+t.exercicios.length+' exercícios: '+esc(t.exercicios.slice(0,3).map(x=>x[0]).join(", "))+'…</span></button>').join("")+'</div>').join("")+'</details>';
}
function faseTexto(F){
  if(!F)return "";if(F.antes)return "começa em "+F.diasPara+(F.diasPara===1?" dia":" dias");
  const f=F.fase;return "Semana "+F.semanaCiclo+" de "+F.total+" · "+f.nome+(F.ciclo>1?" · ciclo "+F.ciclo:"");
}
function cardMetodo(t,sug,today){
  const {m,k,F}=t.metodo;const f=F.antes?m.fases[0]:F.fase;
  const pares=m.treinos[k].pares;
  const grs=[...new Set(pares.flatMap(p=>[p.a,p.b]).map(x=>(m.musculos[(m.exercicios[x]||{}).musculo]||{}).grupo))].filter(g=>GROUP_VAR[g]);
  const days=t.last?Math.round((today-t.last.date)/864e5):0;
  return '<button data-t="'+esc(t.name)+'" class="'+(sug?"sug":"")+'">'+(sug?'<span class="tag">Treino de hoje no '+esc(m.nome)+'</span>':"")+
    '<b>'+esc(t.name)+'</b><span class="muted small">'+esc(faseTexto(F))+' · '+pares.length+' pares · '+f.series+' séries de '+(f.reps||[]).join("–")+'</span>'+
    (t.last?'<span class="muted small">Último: '+fmtShort(t.last.date)+' ('+(days===0?"hoje":days===1?"ontem":days+" dias")+')</span>':"")+
    '<span class="tag">'+grs.map(g=>'<i style="background:var('+GROUP_VAR[g]+')"></i>'+esc(g)).join(" ")+'</span></button>';
}
function metodoAviso(today){
  const mt=metodoAluno();if(!mt)return "";
  if(mt.F.antes)return '<div class="notice"><p>O <b>'+esc(mt.m.nome)+'</b> começa em '+esc(S.aluno.metodoInicio)+'.</p></div>';
  if(Metodos.treinoDoDia(mt.m,today))return "";
  return '<div class="notice"><p><b>'+esc(mt.m.diaLivre||"Dia livre.")+'</b> '+esc(mt.m.diasTexto||"")+'</p></div>';
}
function buildMetodoDraft(t){
  const {m,k}=t.metodo;const F=Metodos.fase(m,S.aluno.metodoInicio,new Date());
  const f=F&&!F.antes?F.fase:m.fases[0];
  const blocks=[];
  m.treinos[k].pares.forEach((p,pi)=>["a","b"].forEach(l=>{
    const ex=Metodos.exercicio(m,p[l]);if(!ex)return;
    const prev=lastExact(ex.nome);
    const b={id:newId(),name:ex.nome,grupo:(m.musculos[ex.musculo]||{}).grupo||guessGroup(ex.nome),sets:[],obs:"",
      par:pi+1,lado:l,exKey:p[l],musculo:ex.musculo,tipo:ex.tipo,unidade:ex.unidade||""};
    const n=Metodos.seriesDoPar(f,pi+1);
    for(let i=0;i<n;i++){
      const s=makeSet(i+1,prev[i]||null);s.meta=Metodos.meta(f,ex);s.rirMeta=f.rir.join("–");
      if(!s.peso&&prev.length)s.peso=String(prev[prev.length-1].peso||"").trim();
      b.sets.push(s);
    }
    blocks.push(b);
  }));
  const card=Metodos.cardio(m,f,new Date());
  if(card){const s=makeSet(1,null);s.meta=card;blocks.push({id:newId(),name:/interval/i.test(card)?"Cardio intervalado":"Cardio zona 2",grupo:"Cardio",cardio:true,sets:[s],obs:""})}
  return {date:fmtDate(new Date()),treino:m.treinos[k].nome,blocks,started:Date.now(),inicio:hhmm(new Date()),lastTick:null,obs:"",
    metodo:{id:m.id,k,semana:F&&!F.antes?F.semanaCiclo:1,total:F&&F.total||m.cicloSemanas,fase:f.nome,rir:f.rir}};
}
function buildDraft(treino){
  const t=templates().find(x=>x.name===treino);
  if(t&&t.metodo)return buildMetodoDraft(t);
  const blocks=[];
  if(t&&t.model){
    t.model.forEach(it=>{
      const prev=lastExact(it.ex);
      const grupo=S.exMap.get(strip(it.ex))||(prev[0]&&prev[0].grupo)||guessGroup(it.ex);
      const b={id:newId(),name:it.ex,grupo,sets:[],obs:""};
      for(let i=0;i<it.series;i++){
        const s=makeSet(i+1,prev[i]||null);
        const meta=pickN(it.metas,i);if(meta)s.meta=meta;
        if(!s.peso)s.peso=pickN(it.pesos,i)||(prev.length?String(prev[prev.length-1].peso||"").trim():"");
        b.sets.push(s);
      }
      blocks.push(b);
    });
  }else if(t){
    let cur=null;
    t.last.rows.forEach(r=>{
      cur=blocks.find(x=>x.name===r.ex);
      if(!cur){cur={id:newId(),name:r.ex,grupo:r.grupo,sets:[],obs:""};blocks.push(cur)}
      cur.sets.push(makeSet(cur.sets.length+1,r));
    });
  }
  return {date:fmtDate(new Date()),treino,blocks,started:Date.now(),inicio:hhmm(new Date()),lastTick:null,obs:""};
}
function makeSet(n,r){
  return {n,meta:r?String(r.meta||""):"",last:r?{feitas:String(r.feitas||""),peso:String(r.peso||""),reps:r.reps,pesoN:r.pesoN,vol:r.vol,skipped:!r.done}:null,
    reps:"",peso:r?String(r.peso||"").trim():"",rir:"",obs:"",note:false,time:null,skip:false};
}
function saveDraft(){store(DRAFT_KEY(),S.draft)}
/* ---- Unilaterais: "... E" e "... D" viram um cartão só, com as séries intercaladas.
   Na planilha cada série continua gravada com o nome do lado. ---- */
const LADO_RX=/\s+(?:lado\s+)?(e|d|esquerd[oa]|direit[oa]|doreita)\s*$/i;
function ladoDe(name){const n=String(name||"").trim();const m=n.match(LADO_RX);return m?{base:n.replace(LADO_RX,"").trim(),lado:/^e/i.test(m[1])?"E":"D"}:null}
function juntarUnilaterais(blocks){
  const livre=b=>!b.uni&&!b.par&&!b.cardio;const usados=new Set();const out=[];
  blocks.forEach((b,i)=>{
    if(usados.has(i))return;
    const L=livre(b)?ladoDe(b.name):null;
    const j=L?blocks.findIndex((x,k)=>{if(k===i||usados.has(k)||!livre(x))return false;const o=ladoDe(x.name);return o&&o.lado!==L.lado&&strip(o.base)===strip(L.base)}):-1;
    if(j<0){out.push(b);return}
    usados.add(i);usados.add(j);
    const E=L.lado==="E"?b:blocks[j],D=L.lado==="E"?blocks[j]:b;
    const n=Math.max(E.sets.length,D.sets.length);const sets=[];
    const lado=(B,outro,letra,k)=>{const s=B.sets[k]||Object.assign(makeSet(k+1,null),{meta:(outro.sets[k]||{}).meta||"",peso:(outro.sets[k]||{}).peso||""});s.n=k+1;s.lado=letra;s.exNome=B.name;return s};
    for(let k=0;k<n;k++){sets.push(lado(E,D,"E",k));sets.push(lado(D,E,"D",k))}
    out.push({id:newId(),name:L.base,grupo:E.grupo,uni:true,sets,obs:[E.obs,D.obs].filter(Boolean).join(" · ")});
  });
  return out;
}
/* ---- Academia: peso e "última vez" vêm da academia escolhida, quando já treinou nela. ---- */
const ACADEMIAS_CONHECIDAS=["REX FIT CT","Smartfit Batel","Black Bull"];
function nomesAcademias(){const v=new Map();S.rows.forEach(r=>{if(r.academia)v.set(strip(r.academia),r.academia)});const lista=[...v.values()].reverse();ACADEMIAS_CONHECIDAS.forEach(n=>{if(!v.has(strip(n)))lista.push(n)});return lista}
function ultimaAcademia(){const g=store("dt2-academia-"+keyA());if(g)return g;for(let i=S.rows.length-1;i>=0;i--)if(S.rows[i].academia)return S.rows[i].academia;return ""}
function ultimaNaAcademia(nome,gym){
  const k=strip(nome),g=strip(gym);
  for(let i=S.rows.length-1;i>=0;i--){const r=S.rows[i];
    if(strip(r.ex)===k&&strip(r.academia)===g&&r.done){let rs=S.rows.filter(x=>x.dateS===r.dateS&&strip(x.ex)===k);
      const u=rs.map(x=>String(x.serie).trim()).lastIndexOf("1");if(u>0)rs=rs.slice(u);return rs}}
  return [];
}
function aplicarAcademia(d){
  if(!d||!d.academia)return;
  // Só fala em academia nova se a pessoa já registra academias e nunca treinou nesta.
  const g=strip(d.academia),registra=S.rows.some(r=>r.academia),conhece=S.rows.some(r=>strip(r.academia)===g);
  d.blocks.forEach(b=>{
    if(b.cardio)return;b.novaAcad=registra&&!conhece&&!!lastFor(b.name);
    b.sets.forEach((s,si)=>{
      const rs=ultimaNaAcademia(s.exNome||b.name,d.academia);if(!rs.length)return;
      b.novaAcad=false;
      const r=rs[s.lado?s.n-1:si]||rs[rs.length-1];
      s.last={feitas:String(r.feitas||""),peso:String(r.peso||""),reps:r.reps,pesoN:r.pesoN,vol:r.vol,skipped:!r.done};
      if(!String(s.reps).trim())s.peso=String(r.peso||"").trim()||s.peso;
    });
  });
}
/* A meta que sobe a carga vai para a última série do exercício, já com o peso preenchido. */
// Meta com carga que a máquina não tem (57 kg numa de 5 em 5): vai para o próximo degrau real.
function ajustarMetaAoSalto(b){
  const m=b.metaC,sl=parseFloat(fmtSalto(b.salto).replace(",","."));if(!m||m.peso==null||!(sl>0))return;
  const q=m.peso/sl;if(Math.abs(q-Math.round(q))<1e-6)return;
  const novo=Math.round(Math.ceil(q)*sl*100)/100,fator=novo/m.peso,txt=v=>String(v).replace(".",",");
  m.texto=String(m.texto).replace(new RegExp(txt(m.peso).replace(".","\\.")+"\\s*kg","i"),txt(novo)+" kg");
  if(m.pesoT!=null)m.pesoT=m.pesoT*fator;m.peso=novo;
}
function aplicarMetaCoach(d){
  if(!d||!d.treino)return;
  d.blocks.forEach(b=>{
    b.sets.forEach(s=>{s.metaC=false});
    b.metaC=b.cardio?null:Coach.metaDaSerie(S.rows,d.treino,b.name);
    if(!b.metaC||!b.sets.length)return;
    ajustarMetaAoSalto(b);
    [...new Set(b.sets.map(s=>s.lado||""))].forEach(l=>{
      const s=b.sets.filter(x=>(x.lado||"")===l).pop();s.metaC=true;
      if(b.metaC.peso!=null&&!String(s.reps).trim())s.peso=String(b.metaC.peso).replace(".",",")+"kg"+(/cada lado/i.test(b.metaC.texto)?" cl":"");
    });
  });
}
/* ---- Máquina: cada marca pesa diferente. A carga e a "última vez" só comparam na mesma máquina. ---- */
const SALTOS=["1","2","2,5","5","10"];
const fmtSalto=v=>String(v==null?"":v).replace(".",",").trim();
function nomesMaquinas(){const v=new Map();S.rows.forEach(r=>{if(r.maq)v.set(strip(r.maq),r.maq)});return [...v.values()].reverse()}
function rowsDoEx(b){const k=exKey(b.name);return S.rows.filter(r=>r.done&&exKey(r.ex)===k)}
function saltoSalvo(b,maq){const rs=rowsDoEx(b).filter(r=>r.salto&&strip(r.maq)===strip(maq));return rs.length?fmtSalto(rs[rs.length-1].salto):""}
function ultimaNaMaquina(b,maq){const rs=rowsDoEx(b);for(let i=rs.length-1;i>=0;i--)if(strip(rs[i].maq)===strip(maq)){const d=rs[i].dateS;return rs.filter(x=>x.dateS===d&&strip(x.maq)===strip(maq))}return []}
function aplicarMaquina(d){
  d.blocks.forEach(b=>{if(b.cardio)return;
    if(b.maq===undefined){const rs=rowsDoEx(b).slice().reverse(),g=strip(d.academia);const r=rs.find(x=>x.maq&&(!g||strip(x.academia)===g))||rs.find(x=>x.maq);b.maq=r?r.maq:"";b.salto=b.maq?saltoSalvo(b,b.maq):""}
    maquinaNasSeries(b)});
}
function maquinaNasSeries(b){
  b.novaMaq=false;b.maqAntes="";b.sets.forEach(s=>{if(s.last)delete s.last.outraMaq});if(!b.maq)return;
  const com=rowsDoEx(b).filter(r=>r.maq),mesma=ultimaNaMaquina(b,b.maq);
  if(!mesma.length){if(com.length){b.novaMaq=true;b.maqAntes=com[com.length-1].maq;b.sets.forEach(s=>{if(s.last)s.last.outraMaq=b.maqAntes})}return}
  b.sets.forEach((s,si)=>{const nome=s.exNome||b.name;let l=mesma.filter(r=>strip(r.ex)===strip(nome));if(!l.length)l=mesma;
    const r=l[s.lado?s.n-1:si]||l[l.length-1];if(!r)return;
    s.last={feitas:String(r.feitas||""),peso:String(r.peso||""),reps:r.reps,pesoN:r.pesoN,vol:r.vol,skipped:!r.done};
    if(!String(s.reps).trim())s.peso=String(r.peso||"").trim()||s.peso});
}
// Peso livre não tem marca de máquina: o campo só aparece se a pessoa já tiver anotado uma.
const ehLivre=n=>{const t=strip(n);return /halter|barra|prancha|no banco|mergulho|serrote|^stiff$/.test(t)&&!/pulley|polia|maquina|smith|cross/.test(t)};
function maqHtml(b){
  if(!b.maq&&!b.maqEdit&&ehLivre(b.name))return "";
  if(b.maqEdit)return '<div class="maq-ed"><input data-f="maq" list="maq-list" value="'+esc(b.maq||"")+'" placeholder="Marca da máquina (ex.: Cimerian)" aria-label="Marca da máquina" autocomplete="off"><datalist id="maq-list">'+nomesMaquinas().map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>'+
    '<label class="small">sobe de <select data-f="salto" aria-label="De quantos em quantos kg a máquina sobe"><option value="">?</option>'+SALTOS.map(v=>'<option'+(fmtSalto(b.salto)===v?" selected":"")+'>'+v+'</option>').join("")+'</select> kg</label><button class="btn small" data-act="maq-ok">OK</button></div>';
  return '<button class="maq-l" data-act="maq">'+(b.maq?'Máquina: <b>'+esc(b.maq)+'</b>'+(b.salto?' · sobe de '+esc(fmtSalto(b.salto))+' em '+esc(fmtSalto(b.salto))+' kg':' · de quanto sobe?'):'Qual máquina? Toque para anotar a marca')+' <span aria-hidden="true">✎</span></button>'+
    (b.novaMaq?'<div class="alerts"><span class="small muted">Primeira vez na '+esc(b.maq)+'. Cada marca pesa diferente: a carga da '+esc(b.maqAntes)+' é só uma referência, e hoje vira a referência desta máquina.</span></div>':"");
}
function prepararDraft(d){d.blocks=juntarUnilaterais(d.blocks);d.academia=d.academia||ultimaAcademia();aplicarAcademia(d);aplicarMaquina(d);aplicarMetaCoach(d);return d}
/* Treino de um plano pronto (metodos/planos.json). Não muda os treinos padrão do aluno. */
function buildPlanoDraft(planoId,idx){
  const p=Metodos.planos().find(x=>x.id===planoId);const t=p.treinos[idx];
  const blocks=t.exercicios.map(([nome,n,reps])=>{
    const prev=lastExact(nome);const b={id:newId(),name:nome,grupo:S.exMap.get(strip(nome))||guessGroup(nome),sets:[],obs:""};
    for(let i=0;i<n;i++){const s=makeSet(i+1,prev[i]||null);s.meta=String(reps);if(!s.peso&&prev.length)s.peso=String(prev[prev.length-1].peso||"").trim();b.sets.push(s)}
    return b;
  });
  return {date:fmtDate(new Date()),treino:t.nome,blocks,started:Date.now(),inicio:hhmm(new Date()),lastTick:null,obs:""};
}
function minutosTreino(d){
  const m=String(d&&d.inicio||"").match(/^(\d{1,2}):(\d{2})$/);const dia=parseDate(d&&d.date);let ini=d&&d.started;
  if(m&&dia){const t=new Date(dia.getFullYear(),dia.getMonth(),dia.getDate(),+m[1],+m[2]).getTime();if(t<=Date.now())ini=t}
  return Math.max(0,Math.floor((Date.now()-ini)/60000));
}
const fmtMin=m=>m<60?m+" min":Math.floor(m/60)+"h"+pad(m%60);
const setDone=s=>!!String(s.reps).trim()||s.skip;
function doneSets(){if(!S.draft)return 0;let n=0;S.draft.blocks.forEach(b=>b.sets.forEach(s=>{if(String(s.reps).trim())n++}));return n}
function savableSets(){if(!S.draft)return 0;let n=0;S.draft.blocks.forEach(b=>b.sets.forEach(s=>{if(setDone(s))n++}));return n}

const balao=html=>html?'<div class="balao"><span class="balao-av">'+Icone("speakerphone",23)+'</span><div class="balao-tx"><b>Recado do coach</b><br>'+html+'</div></div>':"";
function recadoDoDraft(d){
  const k=S.rows.length+"|"+S.memoria.size+"|"+d.treino;
  if(!S.recadoMemo||S.recadoMemo.k!==k)S.recadoMemo={k,r:Coach.recado(S.rows,d.treino,S.memoria)};
  return S.recadoMemo.r;
}
const chipsAnimo=(id,val)=>'<div class="animo" id="'+id+'">'+[["bom","😀"],["ok","😐"],["ruim","😞"]].map(([k,e])=>'<button class="an'+(val===k?" on":"")+'" data-an="'+k+'" aria-label="Ânimo '+k+'" aria-pressed="'+(val===k)+'">'+e+'</button>').join("")+'</div>';
function ligarAnimo(id,campo,aviso){
  document.querySelectorAll("#"+id+" [data-an]").forEach(x=>x.onclick=()=>{
    S.draft[campo]=S.draft[campo]===x.dataset.an?"":x.dataset.an;saveDraft();
    document.querySelectorAll("#"+id+" [data-an]").forEach(y=>{const on=y.dataset.an===S.draft[campo];y.classList.toggle("on",on);y.setAttribute("aria-pressed",on)});
    aviso();
  });
}
function renderFim(el){
  const d=S.draft;const ini=d.animoIni||d.animo||"";
  let vol=0;d.blocks.forEach(b=>b.sets.forEach(s=>{if(!s.skip&&String(s.reps).trim())vol+=setVolume(parseReps(s.reps,s.meta),parsePeso(s.peso))||0}));
  el.innerHTML='<div class="card" style="margin-bottom:10px"><h3>Como você está saindo?</h3>'+chipsAnimo("animo-fim",d.animoFim)+'<p class="animo-msg" id="fim-msg" hidden></p></div>'+
    '<div class="card" style="margin-bottom:10px"><h3>Quer comentar algo?</h3><div class="treino-obs" style="margin:8px 0 0"><textarea id="treino-obs" placeholder="Como foi, se precisou parar, dor, cansaço…" aria-label="Comentário do treino">'+esc(d.obs||"")+'</textarea></div></div>'+
    '<div class="card" style="margin-bottom:10px"><div class="gr3">'+
      '<div class="kpi"><span class="l">Tempo</span><span class="v">'+esc(fmtMin(minutosTreino(d)))+'</span></div>'+
      '<div class="kpi"><span class="l">Séries</span><span class="v">'+doneSets()+'</span></div>'+
      '<div class="kpi"><span class="l">Volume</span><span class="v">'+nf1.format(vol/1000)+'<small>t</small></span></div></div></div>'+
    '<div class="fim-btns"><button class="btn primary" id="fim-save">Concluir treino</button><button class="btn" id="fim-voltar">Voltar ao treino</button></div>';
  const msg=()=>{const m=$("#fim-msg");const t=Coach.saida(ini,S.draft.animoFim);m.textContent=t;m.hidden=!t};msg();
  ligarAnimo("animo-fim","animoFim",msg);
  const ob=$("#treino-obs");ob.addEventListener("input",()=>{S.draft.obs=ob.value;saveDraft()});
  $("#fim-save").onclick=save;
  $("#fim-voltar").onclick=voltar;
  updateBar();
}
function needAluno(el){
  if(S.alunoId)return false;
  el.innerHTML='<div class="empty">'+(S.role==="prof"?'Escolha um aluno em <b>Alunos</b>, na tela inicial.':'Carregando seus dados…')+'</div>';
  return true;
}
function renderLancar(){
  const el=$("#lancar");
  if(needAluno(el)){$("#savebar").hidden=true;return}
  if(S.role==="prof"&&S.modEdit){$("#savebar").hidden=true;return renderModelEditor(el)}
  if(S.draft&&S.draft.date!==fmtDate(new Date())&&savableSets()===0){S.draft=null;saveDraft()}
  if(!S.draft||S.picker){
    $("#savebar").hidden=true;
    if(!S.loaded){el.innerHTML='<div class="empty">'+(S.error?"Sem dados da planilha ainda. Veja o aviso acima.":"Lendo os treinos na planilha…")+'</div>';return}
    const list=templates();const sug=suggestion(list);const today=new Date();
    const card=t=>{
      if(t.metodo)return cardMetodo(t,t.name===sug,today);
      const days=t.last?Math.floor((today-t.last.date)/864e5):0;
      const grs=(t.model?[...new Set(t.model.map(it=>S.exMap.get(strip(it.ex))||guessGroup(it.ex)))]:[...new Set(t.last.rows.map(r=>r.grupo))]).filter(g=>GROUP_VAR[g]);
      const nSeries=t.model?t.model.reduce((a,it)=>a+it.series,0):t.last.rows.length;
      const info=t.last?'Último: '+fmtShort(t.last.date)+' ('+(days===0?"hoje":days===1?"ontem":days+" dias")+') · '+nSeries+(nSeries===1?' série':' séries')
        :'Novo, ainda não feito · '+t.model.length+(t.model.length===1?' exercício · ':' exercícios · ')+nSeries+' séries';
      return '<button data-t="'+esc(t.name)+'" class="'+(t.name===sug?"sug":"")+'">'+
        (t.name===sug?'<span class="tag">Sugestão: o da rotação parado há mais tempo</span>':"")+
        '<b>'+esc(t.name)+'</b><span class="muted small">'+info+'</span>'+
        '<span class="tag">'+grs.map(g=>'<i style="background:var('+GROUP_VAR[g]+')"></i>'+esc(g)).join(" ")+'</span></button>';
    };
    const main=list.filter(t=>!t.other),others=list.filter(t=>t.other);
    const prof=S.role==="prof";
    const vazio=!main.length&&!others.length;
    el.innerHTML=balao(Coach.recadoPicker(S.rows,sug))+'<div class="session-head"><div><h2>Qual treino hoje?</h2><div class="muted small">'+DIAS[today.getDay()]+", "+fmtDate(today)+' · '+
      (S.models.size?'o app mostra o que foi feito da última vez':'o app copia o último treino igual para só preencher')+'</div></div>'+
      (prof?'<button class="btn" id="b-montar-t">✎ Montar treinos</button>':"")+'</div>'+
      metodoAviso(today)+
      (vazio?'<div class="notice"><p>'+(prof?'Este aluno ainda não tem treinos. Toque em <b>Montar treinos</b> para criar.':'Seu professor está montando o seu treino. Assim que ficar pronto, ele aparece aqui. Enquanto isso, você pode usar o <b>Treino livre</b>.')+'</p></div>':"")+
      '<div class="pick">'+(S.draft?'<button data-cont="1" class="cont"><span class="tag">Em andamento, ainda não salvo</span><b>Continuar: '+esc(S.draft.treino)+'</b><span class="muted small">'+doneSets()+' séries feitas hoje</span></button>':"")+
      main.map(card).join("")+'<button data-t=""><b>Treino livre</b><span class="muted small">Começar em branco e adicionar exercícios</span></button></div>'+
      (others.length?'<details class="others"><summary>Outros treinos do histórico ('+others.length+') · estes copiam o último dia</summary><div class="pick">'+others.map(card).join("")+'</div></details>':"")+planosHtml();
    const bm=$("#b-montar-t");if(bm)bm.onclick=()=>openModelEditor(null);
    el.querySelectorAll(".pick button").forEach(b=>b.onclick=()=>{
      if(b.dataset.cont){S.picker=false;render();window.scrollTo({top:0});return}
      const name=b.dataset.t;
      if(S.draft&&savableSets()>0&&!b.dataset.armed){
        b.dataset.armed="1";const w=document.createElement("span");w.className="badge down";w.textContent="Toque de novo para trocar: "+savableSets()+" séries não salvas serão perdidas";b.prepend(w);return;
      }
      S.draft=prepararDraft(b.dataset.plano?buildPlanoDraft(b.dataset.plano,+b.dataset.pi):name?buildDraft(name):{date:fmtDate(new Date()),treino:"Treino livre",blocks:[],started:Date.now(),inicio:hhmm(new Date()),lastTick:null,obs:""});
      S.picker=false;S.confirm=false;saveDraft();render();window.scrollTo({top:0});
    });
    return;
  }
  const d=S.draft;
  if(S.fim){$("#savebar").hidden=true;renderFim(el);return}
  $("#savebar").hidden=false;
  const rec=recadoDoDraft(d);
  const seen=new Set();const exNames=S.rows.map(r=>r.ex).concat(S.exList||[],window.Metodos?Metodos.bibNomes():[]).filter(n=>{const k=strip(n);if(!k||seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  el.innerHTML=balao(rec.html)+
    '<div class="card chegada"><h3>Como você está chegando?</h3>'+chipsAnimo("animo-ini",d.animoIni||d.animo)+'<p class="animo-msg" id="ini-msg" hidden></p>'+
    '<label class="fld2 chegada-acad">Academia<input id="academia" list="acad-list" value="'+esc(d.academia||"")+'" placeholder="Nome e bairro, se tiver mais de uma" autocomplete="off"></label><datalist id="acad-list">'+nomesAcademias().map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist></div>'+
    '<div class="session-head"><div class="meta"><span>'+esc(d.date)+'</span><label class="inicio">Início <input type="time" id="inicio" value="'+esc(d.inicio||hhmm(new Date(d.started)))+'" aria-label="Horário de início do treino"></label><span id="clock"></span></div>'+
    '<div class="row-btns"><button class="btn ghost" id="b-trocar">Trocar treino</button><button class="btn ghost" id="b-stop" title="Marca as séries que faltam como não feitas">Parei aqui</button><button class="btn ghost" id="b-discard">Descartar</button></div></div>'+
    (d.metodo?metodoTopo(d):"")+
    (d.blocks.length?"":'<div class="empty">Nenhum exercício ainda. Adicione abaixo.</div>')+
    (d.blocks.length?insHtml(0):"")+(()=>{const ultOk=d.blocks.map(exOk).lastIndexOf(true);return d.blocks.map((b,bi)=>parHeader(d,b)+exCard(b,bi)+(bi===ultOk?aguaHtml():"")+(bi<d.blocks.length-1&&b.lado!=="a"?insHtml(bi+1):"")).join("")})()+
    '<div class="add-ex"><input id="new-ex" list="ex-list" placeholder="Adicionar exercício (busque pelo nome)" aria-label="Nome do exercício"><button class="btn" id="b-add">Adicionar</button></div>'+
    '<datalist id="ex-list">'+exNames.map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>';
  bindLancar();ligarAgua();ligarFotos();
  updateBar();
}
/* ---- Método: topo do treino, cabeçalho de cada par, avisos de progressão ---- */
// Incluir um exercício entre os outros, na posição escolhida.
function insHtml(i){
  if(S.insAt!==i)return '<button class="ins-ex" data-ins="'+i+'">+ Incluir exercício aqui</button>';
  return '<div class="add-ex ins-box"><input id="ins-ex" list="ex-list" placeholder="Qual exercício?" aria-label="Exercício a incluir"><button class="btn" id="ins-ok">Incluir</button><button class="btn ghost" id="ins-no">Cancelar</button></div>';
}
function metodoDoDraft(d){return d&&d.metodo&&window.Metodos?Metodos.get(d.metodo.id):null}
function metodoTopo(d){
  const m=metodoDoDraft(d);if(!m)return "";
  const z=Metodos.zona2(m,idade(S.aluno));
  return '<div class="card mtopo"><div class="card-h"><h2>'+esc(m.nome)+'</h2><p>Semana '+d.metodo.semana+' de '+d.metodo.total+' · '+esc(d.metodo.fase)+' · deixe '+esc((d.metodo.rir||[]).join("–"))+' reps sobrando</p></div>'+
    '<p class="small"><b>Aquecimento:</b> '+(m.aquecimento||[]).map(esc).join(" + ")+'.</p>'+
    '<p class="small"><b>Como fazer:</b> série do <b>a</b> → descanso '+m.descanso.entreAeB.join("–")+' s → série do <b>b</b> → descanso '+m.descanso.entrePares.join("–")+' s. Repita até fechar as séries do par e só então vá ao próximo.</p>'+
    (z?'<p class="small"><b>Zona 2:</b> '+z.lo+'–'+z.hi+' bpm (FC máx. ≈ '+z.max+'). '+esc(z.descricao||"")+'</p>':"")+'</div>';
}
function parHeader(d,b){
  if(b.cardio)return '<div class="par-h">Cardio no fim</div>';
  if(!d.metodo||b.lado!=="a")return "";
  const m=metodoDoDraft(d);const nb=d.blocks.find(x=>x.par===b.par&&x.lado==="b");
  const nome=k=>m&&m.musculos[k]?m.musculos[k].nome:k;
  return '<div class="par-h">Par '+b.par+' · '+esc(nome(b.musculo))+(nb?' ↔ '+esc(nome(nb.musculo)):"")+'</div>';
}
function avisosProgresso(d,b){
  if(!d.metodo||b.cardio)return "";
  const m=metodoDoDraft(d);if(!m)return "";
  const f=(Metodos.fase(m,S.aluno&&S.aluno.metodoInicio,new Date())||{}).fase||m.fases[0];
  const ex={unidade:b.unidade};const out=[];
  // progressão dupla: topo da faixa em todas as séries da última vez, com as reps sobrando da fase
  let prev=lastExact(b.name);
  const ult=prev.map(r=>String(r.serie).trim()).lastIndexOf("1");if(ult>0)prev=prev.slice(ult); // só a última sessão do dia
  prev=prev.filter(r=>!/n[aã]o fiz/i.test(r.feitas));
  const top=Metodos.topo(f,ex);
  if(prev.length&&prev.every(r=>r.reps&&r.reps[0]>=top&&r.rir!==""&&+r.rir>=f.rir[0]))
    out.push('<span class="badge up">⬆ '+esc(m.progressao.avisoSubir)+': '+esc(Metodos.incremento(m,b.tipo))+' e volte para '+(b.unidade==="s"?f.tempo[0]+" s":f.reps[0]+" reps")+'</span>');
  // estagnação: 2 semanas sem melhorar a melhor série
  const k=exKey(b.name);const byDay=new Map();
  S.rows.forEach(r=>{if(exKey(r.ex)!==k||!r.reps)return;const sc=r.e1||r.reps.reduce((a,c)=>a+c,0);const o=byDay.get(r.dateS);if(!o||sc>o.sc)byDay.set(r.dateS,{d:r.date,sc})});
  const ses=[...byDay.values()].sort((a,c)=>a.d-c.d);const lim=Date.now()-(m.progressao.estagnacaoSemanas||2)*7*864e5;
  const rec=ses.filter(x=>+x.d>=lim),old=ses.filter(x=>+x.d<lim);
  if(rec.length>=2&&old.length&&Math.max(...rec.map(x=>x.sc))<=old[old.length-1].sc)
    out.push('<span class="badge down">'+esc(m.progressao.avisoEstagnacao)+'</span>');
  return out.length?'<div class="alerts">'+out.join("")+'</div>':"";
}
function cardioCard(b,bi){
  const s=b.sets[0];const done=!!String(s.reps).trim();const z=window.Metodos&&S.draft&&S.draft.metodo?Metodos.zona2(metodoDoDraft(S.draft),idade(S.aluno)):null;
  return '<div class="ex" data-b="'+bi+'"><div class="ex-h"><span class="stripe" style="background:var(--g-abd)"></span><h3>'+esc(b.name)+'</h3><button class="x" data-act="rm-ex" aria-label="Remover cardio">×</button></div>'+
    '<div class="set'+(done?" done":"")+'" data-s="0"><div class="set-info"><b>'+esc(s.meta)+'</b>'+(z?'<span>zona 2: '+z.lo+'–'+z.hi+' bpm</span>':"")+'</div>'+
    '<div class="note-row"><input class="obs" data-f="obs" value="'+esc(s.obs)+'" placeholder="Como foi? (tempo feito, FC média, aparelho)" aria-label="Observação do cardio">'+
    '<button class="chk'+(done?" on":"")+'" data-act="check" aria-label="Marcar cardio como feito">✓</button></div></div>'+
    '<div class="ex-f"><button class="btn ghost" data-act="add-set" hidden></button></div></div>';
}
function metaCoach(b){if(b.metaC)return "";const t=S.draft&&(recadoDoDraft(S.draft).metas||{})[Coach.base(b.name)];return t?'<div class="meta-coach">Meta do coach: '+esc(t)+'</div>':""}
function exCard(b,bi){
  if(b.cardio)return cardioCard(b,bi);
  const gv=GROUP_VAR[b.grupo]||"--g-abd";
  const im=window.Metodos&&Metodos.imagem(b.name);
  return '<div class="ex'+(exOk(b)?" ex-ok":"")+'" data-b="'+bi+'"><div class="ex-h"><span class="stripe" style="background:var('+gv+')"></span>'+(im?'<button class="ex-foto" data-foto="'+bi+'" aria-label="Ver a execução de '+esc(b.name)+'"><img src="'+esc(im.fotos[0])+'" alt="" loading="lazy">'+(im.fotos[1]?'<img src="'+esc(im.fotos[1])+'" alt="" loading="lazy" class="f2">':"")+'</button>':"")+'<h3>'+(b.par?'<span class="parlbl">'+b.par+b.lado+'</span> ':"")+esc(b.name)+
    (b.orig?'<br><span class="swapped">no lugar de: '+esc(b.orig)+'</span>':"")+'</h3>'+grupoSelect(b.grupo,'data-act="grupo"')+
    '<button class="sw" data-act="swap" aria-label="Trocar exercício (máquina ocupada ou sem equipamento)" title="Trocar exercício">⇄</button>'+
    '<button class="x" data-act="rm-ex" aria-label="Remover exercício">×</button></div>'+
    '<div class="ex-okmsg"><span>🏆 Exercício concluído</span><span class="palma" aria-hidden="true">👏</span></div>'+
    (b.swapping?'<div class="swap"><input data-f="swapto" list="ex-list" placeholder="Trocar por qual exercício?" aria-label="Novo exercício"><button class="btn small" data-act="swap-ok">Trocar</button><button class="btn ghost small" data-act="swap-cancel">Cancelar</button></div>'+swapSugestoes(b):"")+
    maqHtml(b)+(b.ultTxt?'<div class="ult-vez small muted">'+esc(b.ultTxt)+'</div>':"")+avisosProgresso(S.draft,b)+metaCoach(b)+
    (b.novaAcad?'<div class="alerts"><span class="small muted">Primeira vez nesta academia: o peso é só uma referência.</span></div>':"")+
    b.sets.map((s,si)=>setRow(s,bi,si)).join("")+
    '<div class="ex-f"><button class="btn" data-act="add-set">+ Série</button>'+(b.sets.length?'<button class="btn ghost" data-act="rm-set">− Última série</button>':"")+
    '<button class="btn ghost" data-act="ex-note">'+(b.obs?"✎ Obs.":"✎ Obs. do exercício")+'</button></div>'+
    (b.noteOpen||b.obs?'<div class="ex-obs"><input class="obs" data-f="exobs" value="'+esc(b.obs||"")+'" placeholder="Observação do exercício (ex.: máquina diferente, ajuste de banco)" aria-label="Observação do exercício"></div>':"")+
    '</div>';
}
// Trocas sugeridas pelo método: mesmo músculo, para manter o par.
function swapSugestoes(b){
  const m=metodoDoDraft(S.draft);
  if(!m||!b.exKey){
    const ops=(window.Metodos?Metodos.bibDoGrupo(b.grupo):[]).filter(n=>strip(n)!==strip(b.name)).slice(0,8);
    return '<div class="swap-sug"><span class="small muted">Sem esse aparelho? Toque numa opção ou escreva qualquer exercício acima.</span>'+ops.map(n=>'<button class="chip" data-bib="'+esc(n)+'">'+esc(n)+'</button>').join("")+'</div>';
  }
  const alts=Metodos.alternativas(m,b.origKey||b.exKey).filter(x=>x.key!==b.exKey);
  if(b.origKey&&b.origKey!==b.exKey)alts.unshift({key:b.origKey,ex:m.exercicios[b.origKey]});
  return alts.length?'<div class="swap-sug"><span class="small muted">Mesmo músculo ('+esc((m.musculos[b.musculo]||{}).nome||"")+'):</span>'+alts.map(x=>'<button class="chip" data-alt="'+esc(x.key)+'">'+esc(x.ex.nome)+'</button>').join("")+'</div>':"";
}
function lastText(s){
  if(!s.last)return '<span>primeira vez</span>';
  if(s.last.skipped)return '<span>última: não feita</span>';
  return '<span>última'+(s.last.outraMaq?' (na '+esc(s.last.outraMaq)+')':"")+' <b>'+esc(s.last.feitas||"–")+'</b> × '+esc(s.last.peso||"–")+'</span>';
}
// O aluno só vê a comparação quando superou a última vez. Igual ou abaixo, vê uma frase de incentivo.
const INCENTIVO=["💪 Série feita. Constância é o que leva longe.","💪 Mais uma na conta. Segue firme.","💪 Feito. Cada série soma.","💪 Boa. Mantém a técnica e segue.","💪 Série no bolso. Respira e vai para a próxima."];
const veTudo=()=>S.role==="prof";
function cmpBadge(s){
  if(!String(s.reps).trim())return "";
  const reps=parseReps(s.reps,s.meta),peso=parsePeso(s.peso);const v=setVolume(reps,peso);
  if(s.last&&s.last.outraMaq)return veTudo()?'<span class="badge">outra máquina</span>':'<span class="badge mot">'+INCENTIVO[(s.n||1)%INCENTIVO.length]+'</span>';
  if(!veTudo()){
    if(s.last&&s.last.vol&&v&&v-s.last.vol>=0.5){
      const dr=reps&&s.last.reps?reps[0]-s.last.reps[0]:0,pn=Array.isArray(peso)?Math.max(...peso):peso,pa=Array.isArray(s.last.pesoN)?Math.max(...s.last.pesoN):s.last.pesoN,dp=pn&&pa?Math.round((pn-pa)*10)/10:0;
      const partes=[dr>0?dr+(dr===1?" repetição":" repetições"):"",dp>0?nf1.format(dp)+" kg":""].filter(Boolean);
      return '<span class="badge up">🔥 '+(partes.length?partes.join(" e ")+" a mais que da última vez":"Superou a última vez")+'</span>';
    }
    return '<span class="badge mot">'+INCENTIVO[(s.n||1)%INCENTIVO.length]+'</span>';
  }
  if(!s.last||!s.last.vol||!v)return "";
  const diff=v-s.last.vol;if(Math.abs(diff)<0.5)return '<span class="badge">igual</span>';
  return diff>0?'<span class="badge up">▲ superou</span>':'<span class="badge down">▼ abaixo</span>';
}
function metaBatida(s,m){const r=parseReps(s.reps,s.meta);return !s.skip&&!!r&&Coach.bateuAlvo(m,r[0],parsePeso(s.peso),s.meta)}
function metaRotulo(m,bateu){return bateu?"★ Meta cumprida":m.modo==="firmar"?"Firmar meta · treino "+(m.n+1)+" de "+Coach.FIRMAR:"Meta do coach"}
function pintarMeta(row,s,m){
  const ok=metaBatida(s,m);row.classList.toggle("meta-o",ok);row.classList.toggle("meta-v",!ok);
  const e=row.querySelector(".meta-s b");if(e)e.textContent=metaRotulo(m,ok);
}
/* Descanso na própria série: aparece na última série preenchida e o relógio conta sozinho. */
function marcarDescanso(bi,si){
  const d=S.draft;d.ultSerie=bi+"_"+si;
  document.querySelectorAll("#lancar .tim").forEach(x=>x.remove());
  const row=$('.ex[data-b="'+bi+'"] .set[data-s="'+si+'"]');if(row)row.insertAdjacentHTML("beforeend",timHtml());
}
function timHtml(){const R=S.draft&&S.draft.rest;return '<div class="tim">Descanso <span class="tim-live">0:00</span>'+(R?'<small> · ideal '+R.min+'–'+R.max+' s</small>':"")+'</div>'}
/* Foto do exercício: toque abre maior, alternando as duas posições. */
function ligarFotos(){
  document.querySelectorAll("#lancar [data-foto]").forEach(b=>b.onclick=()=>{
    const bl=S.draft.blocks[+b.dataset.foto];const im=bl&&Metodos.imagem(bl.name);if(!im)return;
    const ov=document.createElement("div");ov.className="foto-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-label","Execução de "+bl.name);
    ov.innerHTML='<div class="foto-box"><b>'+esc(bl.name)+'</b><div class="foto-anim">'+im.fotos.map((f,i)=>'<img src="'+esc(f)+'" alt="'+(i?"Posição final":"Posição inicial")+'"'+(i?' class="f2"':"")+'>').join("")+'</div><p class="muted small">Imagens de referência do banco livre free-exercise-db. O aparelho da sua academia pode ser diferente.</p><button class="btn primary">Fechar</button></div>';
    ov.onclick=e=>{if(e.target===ov||e.target.tagName==="BUTTON")ov.remove()};document.body.appendChild(ov);
  });
}
/* Exercício concluído: borda dourada e palmas. A cada 2 exercícios, a pergunta da água. */
const exOk=b=>!b.cardio&&b.sets.length>0&&b.sets.every(setDone)&&b.sets.some(s=>String(s.reps).trim());
function exercicioPronto(card,b){
  const ok=exOk(b);if(card.classList.contains("ex-ok")===ok)return;
  card.classList.toggle("ex-ok",ok);
  if(ok){const box=aguaHtml();if(box&&!$("#lancar .agua-box")){card.insertAdjacentHTML("afterend",box);ligarAgua()}}
}
function aguaPendente(){
  const d=S.draft;if(!d)return 0;const n=d.blocks.filter(exOk).length,m=Math.floor(n/2)*2;
  return m>=2&&!(d.agua||{})[m]?m:0;
}
function aguaHtml(){
  const m=aguaPendente();if(!m)return "";
  return '<div class="box-tr agua-box" data-m="'+m+'"><p>💧 Bebeu água?</p><div class="row-btns"><button class="btn primary small" data-agua="bebi">Bebi</button><button class="btn ghost small" data-agua="depois">Vou beber agora</button></div></div>';
}
function ligarAgua(){
  document.querySelectorAll("#lancar [data-agua]").forEach(b=>b.onclick=()=>{
    const box=b.closest(".agua-box");const d=S.draft;d.agua=d.agua||{};d.agua[box.dataset.m]=b.dataset.agua;saveDraft();
    box.innerHTML='<p>'+(b.dataset.agua==="bebi"?"Boa! Hidratado rende mais. 💧":"Combinado. Um gole antes da próxima série.")+'</p>';setTimeout(()=>box.remove(),2500)});
}
/* Mais de 8 minutos sem registrar: pergunta o motivo, que vai para o comentário do treino. */
const PAUSA_MIN=8;
function checarPausa(){
  const d=S.draft;if(!d||!d.lastTick||S.view!=="lancar"||S.fim||$("#pausa-box"))return;
  const min=Math.floor((Date.now()-d.lastTick)/60000);if(min<PAUSA_MIN||d.pausaVista===d.lastTick)return;
  const box=document.createElement("div");box.id="pausa-box";box.className="box-tr pausa-box";box.setAttribute("role","dialog");box.setAttribute("aria-label","Pausa longa");
  box.innerHTML='<p>⏱ Faz '+min+' min desde a última série. Tudo certo?</p><div class="row-btns">'+[["maquina","Máquina ocupada"],["conversa","Conversando"],["descanso","Descansando mais"],["voltei","Voltei"]].map(([k,t])=>'<button class="btn small'+(k==="voltei"?" primary":" ghost")+'" data-pausa="'+k+'">'+t+'</button>').join("")+'</div>';
  document.body.appendChild(box);
  box.querySelectorAll("[data-pausa]").forEach(b=>b.onclick=()=>{
    const mm=Math.floor((Date.now()-d.lastTick)/60000);d.pausaVista=d.lastTick;
    const motivo={maquina:"máquina ocupada",conversa:"conversando",descanso:"descanso maior"}[b.dataset.pausa];
    if(motivo){d.pausas=(d.pausas||[]).concat([motivo+" "+mm+" min"])}
    saveDraft();box.remove();if(motivo)toast("Anotei. O coach não conta isso como queda.");
  });
}
function setRow(s,bi,si){
  const done=!!String(s.reps).trim();
  const mc=s.metaC?S.draft.blocks[bi].metaC:null,mcOk=mc&&metaBatida(s,mc);
  return '<div class="set'+(done?" done":"")+(s.skip?" skip":"")+(mc?(mcOk?" meta-o":" meta-v"):"")+'" data-s="'+si+'">'+(mc?'<div class="meta-s"><b>'+metaRotulo(mc,mcOk)+'</b><span>'+esc(mc.texto)+'</span></div>':"")+'<div class="set-info"><b>Série '+s.n+'</b>'+(s.lado?'<span class="lado">'+(s.lado==="E"?"Esquerdo":"Direito")+'</span>':"")+(s.meta?'<span>meta <b>'+esc(s.meta)+'</b></span>':"")+(s.rirMeta?'<span>sobrar <b>'+esc(s.rirMeta)+'</b></span>':"")+lastText(s)+'<span class="cmp">'+cmpBadge(s)+'</span>'+(s.skip?'<span class="badge down">não feita</span>':"")+'<label class="tm-lbl">horário <input type="time" class="tm" data-f="time" value="'+esc(s.time||"")+'" aria-label="Horário da série '+s.n+'"></label></div>'+
    '<div class="set-in">'+
      '<div class="fld"><label for="r'+bi+'_'+si+'">Reps</label><input id="r'+bi+'_'+si+'" data-f="reps" inputmode="numeric" autocomplete="off" value="'+esc(s.reps)+'" placeholder="'+esc(String(s.meta).replace(/\s*(bi-set|drop set|rest pause).*$/i,"").replace(/[^\d+\-–]/g,"")||"–")+'"></div>'+
      '<div class="fld"><label for="p'+bi+'_'+si+'">Peso</label><input id="p'+bi+'_'+si+'" data-f="peso" autocomplete="off" value="'+esc(s.peso)+'" placeholder="kg"></div>'+
      '<div class="fld"><label for="i'+bi+'_'+si+'">Sobrou</label><select id="i'+bi+'_'+si+'" data-f="rir"><option value="">–</option>'+[0,1,2,3,4,5].map(v=>'<option'+(String(s.rir)===String(v)?" selected":"")+'>'+v+'</option>').join("")+'</select></div>'+
      '<button class="chk'+(s.ok?" on":"")+'" data-act="check" aria-pressed="'+(s.ok?"true":"false")+'" aria-label="Confirmar série '+s.n+'">✓</button>'+
      '<button class="note-btn'+(s.obs||s.skip?" on":"")+'" data-act="note" aria-label="Observação ou não fiz">✎</button>'+
    '</div>'+(S.draft&&S.draft.ultSerie===bi+"_"+si&&done?timHtml():"")+(s.note||s.obs||s.skip?'<div class="note-row"><input class="obs" data-f="obs" value="'+esc(s.obs)+'" placeholder="Observação (como foi a série)" aria-label="Observação da série '+s.n+'"><button class="skipbtn" data-act="skip">'+(s.skip?"✓ Não fiz":"Não fiz")+'</button></div>':"")+'</div>';
}
function bindLancar(){
  const el=$("#lancar");
  el.querySelectorAll(".ex").forEach(card=>{
    const bi=+card.dataset.b;const b=S.draft.blocks[bi];
    if(b.cardio){
      const s=b.sets[0];const row=card.querySelector(".set");
      row.querySelector('[data-f="obs"]').addEventListener("input",e=>{s.obs=e.target.value;saveDraft()});
      row.querySelector('[data-act="check"]').onclick=()=>{s.reps=String(s.reps).trim()?"":"feito";s.time=s.reps?hhmm(new Date()):null;S.draft.rest=null;saveDraft();rerenderCard(bi);updateBar()};
      card.querySelector('[data-act="rm-ex"]').onclick=()=>{S.draft.blocks.splice(bi,1);saveDraft();renderLancar()};
      return;
    }
    card.querySelectorAll("[data-bib]").forEach(c=>c.onclick=()=>{swapExercise(b,c.dataset.bib);b.swapping=false;saveDraft();rerenderCard(bi)});
    card.querySelectorAll("[data-alt]").forEach(c=>c.onclick=()=>{swapToKey(b,c.dataset.alt);b.swapping=false;saveDraft();rerenderCard(bi)});
    const mq=card.querySelector('[data-act="maq"]');if(mq)mq.onclick=()=>{b.maqEdit=true;rerenderCard(bi);const i=$('.ex[data-b="'+bi+'"] [data-f="maq"]');if(i)i.focus()};
    const mo=card.querySelector('[data-act="maq-ok"]');
    if(mo){const inp=card.querySelector('[data-f="maq"]'),sel=card.querySelector('[data-f="salto"]');
      inp.addEventListener("change",()=>{const sv=saltoSalvo(b,inp.value.trim());if(sv&&SALTOS.includes(sv))sel.value=sv});
      const ok=()=>{const nm=inp.value.trim();b.maq=nm?(nomesMaquinas().find(x=>strip(x)===strip(nm))||nm.charAt(0).toUpperCase()+nm.slice(1)):"";b.salto=b.maq?sel.value:"";b.maqEdit=false;
        maquinaNasSeries(b);aplicarMetaCoach(S.draft);saveDraft();rerenderCard(bi);if(b.maq)toast("Máquina anotada: "+b.maq+(b.salto?", sobe de "+b.salto+" kg":"")+". O coach compara a carga só nela.")};
      mo.onclick=ok;inp.addEventListener("keydown",e=>{if(e.key==="Enter")ok()})}
    const gs=card.querySelector('[data-act="grupo"]');
    if(gs)gs.onchange=()=>{b.grupo=gs.value;b.grupoManual=true;saveDraft();rerenderCard(bi);toast("Grupo de "+b.name+": "+b.grupo+". Fica salvo ao gravar o treino.")};
    card.querySelectorAll(".set").forEach(row=>{
      const si=+row.dataset.s;const s=b.sets[si];
      row.querySelectorAll("[data-f]").forEach(inp=>{
        const ev=inp.tagName==="SELECT"?"change":"input";
        inp.addEventListener(ev,()=>{
          const f=inp.dataset.f;s[f]=inp.value;
          if(f==="reps"){
            if(inp.value.trim()&&!s.time){s.time=hhmm(new Date());S.draft.lastTick=Date.now();startRest(bi,si);const t=row.querySelector('[data-f="time"]');if(t)t.value=s.time}
            if(inp.value.trim()&&s.skip){s.skip=false;row.classList.remove("skip")}
            row.classList.toggle("done",!!inp.value.trim());
            s.okAuto=false;s.ok=!!inp.value.trim();
            const c=row.querySelector('[data-act="check"]');c.classList.toggle("on",s.ok);c.setAttribute("aria-pressed",String(s.ok));
            if(s.ok)marcarDescanso(bi,si);
            exercicioPronto(card,b);
          }
          if(f==="time")s.time=inp.value||null;
          if(f==="reps"||f==="peso"){row.querySelector(".cmp").innerHTML=cmpBadge(s);if(s.metaC&&b.metaC)pintarMeta(row,s,b.metaC)}
          saveDraft();updateBar();
        });
      });
      row.querySelector('[data-act="check"]').onclick=()=>{
        // Com a série preenchida, o ✓ confirma e não apaga. Tocar de novo só desfaz a confirmação.
        if(s.ok){s.ok=false;if(s.okAuto){s.reps="";s.time=null}s.okAuto=false}
        else{
          if(!String(s.reps).trim()){
            const m=String(s.meta).match(/\d+/);s.reps=s.metaC&&b.metaC&&b.metaC.reps?String(b.metaC.reps):m?m[0]:(s.last&&s.last.feitas&&/^\d+$/.test(s.last.feitas)?s.last.feitas:"");
            if(!s.reps){row.querySelector('[data-f="reps"]').focus();return}
            s.okAuto=true;
          }
          s.ok=true;s.skip=false;
          if(!s.time){s.time=hhmm(new Date());S.draft.lastTick=Date.now();startRest(bi,si)}
          S.draft.ultSerie=bi+"_"+si;
        }
        saveDraft();rerenderCard(bi);updateBar();const nc=$('.ex[data-b="'+bi+'"]');if(nc)exercicioPronto(nc,b);
      };
      row.querySelector('[data-act="note"]').onclick=()=>{s.note=!s.note;saveDraft();rerenderCard(bi);const o=$('.ex[data-b="'+bi+'"] .set[data-s="'+si+'"] .obs');if(o)o.focus()};
      const sk=row.querySelector('[data-act="skip"]');
      if(sk)sk.onclick=()=>{s.skip=!s.skip;if(s.skip){s.reps="";s.ok=false;s.okAuto=false;s.time=s.time||hhmm(new Date())}s.note=true;saveDraft();rerenderCard(bi);updateBar();
        const o=$('.ex[data-b="'+bi+'"] .set[data-s="'+si+'"] .obs');if(o&&s.skip&&!s.obs){o.placeholder="Por que não fez? (ex.: máquina ocupada, dor)";o.focus()}};
    });
    const exo=card.querySelector('[data-f="exobs"]');if(exo)exo.addEventListener("input",()=>{b.obs=exo.value;saveDraft()});
    card.querySelector('[data-act="ex-note"]').onclick=()=>{b.noteOpen=!b.noteOpen;saveDraft();rerenderCard(bi);const o=$('.ex[data-b="'+bi+'"] [data-f="exobs"]');if(o)o.focus()};
    card.querySelector('[data-act="swap"]').onclick=()=>{b.swapping=!b.swapping;rerenderCard(bi);const i=$('.ex[data-b="'+bi+'"] [data-f="swapto"]');if(i)i.focus()};
    const so=card.querySelector('[data-act="swap-ok"]');
    if(so){
      const inp=card.querySelector('[data-f="swapto"]');
      const go=()=>{const bruto=inp.value.trim();if(!bruto)return;const PN=window.Nomes?Nomes.padronizar(bruto):{maquina:""};const name=PN.maquina?PN.nome:bruto;
        const g=guessGroup(name);if(b.musculo&&g!=="Sem grupo"&&g!==b.grupo)toast("Atenção: o par pede "+b.grupo+". Prefira um exercício do mesmo músculo.");
        swapExercise(b,name);b.swapping=false;b.maq=PN.maquina||undefined;b.salto=PN.maquina?saltoSalvo(b,PN.maquina):"";aplicarMaquina({blocks:[b],academia:S.draft.academia});saveDraft();rerenderCard(bi)};
      so.onclick=go;inp.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
      card.querySelector('[data-act="swap-cancel"]').onclick=()=>{b.swapping=false;rerenderCard(bi)};
    }
    card.querySelector('[data-act="rm-ex"]').onclick=()=>{S.draft.blocks.splice(bi,1);saveDraft();renderLancar()};
    card.querySelector('[data-act="add-set"]').onclick=()=>{
      if(b.uni){const n=Math.floor(b.sets.length/2)+1;[b.sets[b.sets.length-2],b.sets[b.sets.length-1]].forEach(p=>{const ns=makeSet(n,null);ns.lado=p.lado;ns.exNome=p.exNome;ns.meta=p.meta;ns.peso=p.peso;b.sets.push(ns)});saveDraft();rerenderCard(bi);return}
      const prev=b.sets[b.sets.length-1];const ns=makeSet(b.sets.length+1,null);if(prev){ns.meta=prev.meta;ns.peso=prev.peso}b.sets.push(ns);saveDraft();rerenderCard(bi)};
    const rm=card.querySelector('[data-act="rm-set"]');if(rm)rm.onclick=()=>{b.sets.pop();if(b.uni)b.sets.pop();saveDraft();rerenderCard(bi);updateBar()};
  });
  const ini=$("#inicio");if(ini)ini.addEventListener("input",()=>{S.draft.inicio=ini.value;saveDraft()});
  const ac=$("#academia");if(ac)ac.addEventListener("change",()=>{S.draft.academia=Coach.nomeAcademia(ac.value);ac.value=S.draft.academia;store("dt2-academia-"+keyA(),S.draft.academia||null);aplicarAcademia(S.draft);aplicarMaquina(S.draft);aplicarMetaCoach(S.draft);saveDraft();renderLancar()});
  if(S.draft.animo&&!S.draft.animoIni){S.draft.animoIni=S.draft.animo;S.draft.animo="";saveDraft()}
  const iniMsg=()=>{const m=$("#ini-msg");const t=Coach.chegada(S.rows,S.draft.animoIni);m.textContent=t;m.hidden=!t};iniMsg();
  ligarAnimo("animo-ini","animoIni",iniMsg);
  $("#b-trocar").onclick=()=>{S.picker=true;render();window.scrollTo({top:0})};
  $("#b-add").onclick=()=>addExercise();
  $("#new-ex").addEventListener("keydown",e=>{if(e.key==="Enter")addExercise()});
  el.querySelectorAll("[data-ins]").forEach(x=>x.onclick=()=>{S.insAt=+x.dataset.ins;renderLancar();const i=$("#ins-ex");if(i)i.focus()});
  const ii=$("#ins-ex");if(ii){const ok=()=>addExercise(ii,S.insAt);$("#ins-ok").onclick=ok;ii.addEventListener("keydown",e=>{if(e.key==="Enter")ok()});$("#ins-no").onclick=()=>{S.insAt=null;renderLancar()}}
  $("#b-discard").onclick=()=>armed($("#b-discard"),"Toque de novo para descartar","Descartar",()=>{S.draft=null;saveDraft();S.confirm=false;S.fim=false;render()});
  $("#b-stop").onclick=()=>armed($("#b-stop"),"Toque de novo: marcar o que falta como não feito","Parei aqui",()=>{
    let n=0;S.draft.blocks.forEach(b=>b.sets.forEach(s=>{if(!String(s.reps).trim()&&!s.skip){s.skip=true;n++}}));
    saveDraft();renderLancar();toast(n?n+" séries marcadas como não feitas. Toque em Concluir treino para comentar o motivo e salvar.":"Nada a marcar.");
    const t=$("#treino-obs");if(t){t.focus();t.scrollIntoView({block:"center"})}
  });
}
function armed(b,armText,txt,fn){
  if(b.dataset.armed){fn();return}
  b.dataset.armed="1";b.textContent=armText;b.classList.remove("ghost");
  setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent=txt;b.classList.add("ghost")}},4000);
}
function swapExercise(b,name){
  b.metaC=null;b.sets.forEach(s=>{s.metaC=false});
  if(b.uni){
    const L=ladoDe(name);const nome=L?L.base:name;b.orig=b.orig||b.name;b.name=nome;b.grupo=S.exMap.get(strip(nome))||guessGroup(nome);
    b.sets.forEach(s=>{s.exNome=nome+" "+s.lado;const p=lastExact(s.exNome),r=p[s.n-1]||null;
      s.last=r?{feitas:String(r.feitas||""),peso:String(r.peso||""),reps:r.reps,pesoN:r.pesoN,vol:r.vol,skipped:!r.done}:null;
      if(!String(s.reps).trim())s.peso=r?String(r.peso||"").trim():""});
    if(strip(b.orig)===strip(b.name))delete b.orig;return;
  }
  const prev=lastExact(name);
  b.orig=b.orig||b.name;
  b.name=prev[0]?prev[0].ex:name;
  b.grupo=S.exMap.get(strip(b.name))||(prev[0]&&prev[0].grupo)||guessGroup(b.name);
  b.sets.forEach((s,i)=>{
    const r=prev[i]||null;
    s.last=r?{feitas:String(r.feitas||""),peso:String(r.peso||""),reps:r.reps,pesoN:r.pesoN,vol:r.vol,skipped:!r.done}:null;
    if(!String(s.reps).trim())s.peso=r?String(r.peso||"").trim():(prev.length?String(prev[prev.length-1].peso||"").trim():"");
  });
  if(strip(b.orig)===strip(b.name))delete b.orig;
}
/* Cronômetro de descanso do método: depois do (a) 45–60 s, depois do (b) 60–90 s. */
function startRest(bi,si){
  const d=S.draft;const m=metodoDoDraft(d);const b=d.blocks[bi];
  if(!m||!b.par){d.rest=null;return}
  const pend=x=>x?x.sets.findIndex(s=>!setDone(s)):-1;
  const blk=(par,l)=>d.blocks.find(x=>x.par===par&&x.lado===l);
  let alvo,prox=null;
  if(b.lado==="a"){alvo=m.descanso.entreAeB;const nb=blk(b.par,"b");if(nb&&pend(nb)>=0)prox=nb;}
  else{alvo=m.descanso.entrePares;const na=blk(b.par,"a");prox=na&&pend(na)>=0?na:d.blocks.find(x=>x.par>b.par&&!x.cardio&&pend(x)>=0)||d.blocks.find(x=>x.cardio&&pend(x)>=0)||null;}
  if(b.lado==="a"&&!prox){alvo=m.descanso.entrePares;prox=d.blocks.find(x=>x.par>b.par&&pend(x)>=0)||null}
  d.rest={min:alvo[0],max:alvo[1],at:Date.now(),buzz:0,
    prox:prox?(prox.cardio?prox.name:(prox.par+prox.lado+" "+prox.name+" · série "+(pend(prox)+1))):"fim do treino"};
}
function swapToKey(b,key){
  const m=metodoDoDraft(S.draft);const ex=Metodos.exercicio(m,key);if(!ex)return;
  b.origKey=b.origKey||b.exKey;b.exKey=key;b.tipo=ex.tipo;b.unidade=ex.unidade||"";
  swapExercise(b,ex.nome);
  const f=(Metodos.fase(m,S.aluno&&S.aluno.metodoInicio,new Date())||{}).fase||m.fases[0];
  b.sets.forEach(s=>{if(!String(s.reps).trim())s.meta=Metodos.meta(f,ex)});
  if(b.origKey===b.exKey)delete b.origKey;
}
function rerenderCard(bi){const old=$('.ex[data-b="'+bi+'"]');if(!old)return;const t=document.createElement("div");t.innerHTML=exCard(S.draft.blocks[bi],bi);old.replaceWith(t.firstChild);bindLancar()}
// Resumo da última vez que a pessoa fez o exercício.
function ultimaVez(name){
  const rs=lastExact(name).filter(r=>r.done);if(!rs.length)return null;
  const metas=rs.map(r=>String(r.meta||"").trim());const u=rs[0];
  return {series:rs.length,metas:metas.every(m=>m===metas[0])?metas[0]:metas.join("; "),peso:String(rs[rs.length-1].peso||"").trim(),
    txt:"Última vez em "+String(u.dateS).slice(0,5)+": "+rs.length+(rs.length===1?" série":" séries")+", "+[String(u.peso||"").trim(),u.reps?u.reps[0]+" repetições":""].filter(Boolean).join(" × ")+"."};
}
function addExercise(campo,pos){
  const inp=campo||$("#new-ex");const bruto=inp.value.trim();if(!bruto)return;
  const PN=window.Nomes?Nomes.padronizar(bruto):{maquina:""};const name=PN.maquina?PN.nome:bruto;
  const prev=lastFor(name);
  const grupo=S.exMap.get(strip(name))||(prev&&prev[0]&&prev[0].grupo)||guessGroup(name);
  const novos=[];
  if(prev&&prev.length){prev.forEach(r=>{let x=novos.find(y=>y.name===r.ex);if(!x){x={id:newId(),name:r.ex,grupo,sets:[],obs:""};novos.push(x)}x.sets.push(makeSet(x.sets.length+1,r))})}
  else{const x={id:newId(),name,grupo,sets:[],obs:""};for(let i=0;i<3;i++)x.sets.push(makeSet(i+1,null));novos.push(x)}
  const juntos=juntarUnilaterais(novos);const u=ultimaVez(novos[0].name);
  juntos.forEach(x=>{x.ultTxt=u?u.txt:"Primeira vez neste exercício: sem histórico.";if(PN.maquina){x.maq=PN.maquina;x.salto=saltoSalvo(x,PN.maquina)}});
  const onde=pos==null?S.draft.blocks.length:pos;S.draft.blocks.splice(onde,0,...juntos);S.insAt=null;
  aplicarAcademia(S.draft);aplicarMaquina(S.draft);aplicarMetaCoach(S.draft);saveDraft();renderLancar();
  const card=$('.ex[data-b="'+onde+'"]');if(card)card.scrollIntoView({block:"center"});
}
function updateBar(){
  const n=savableSets(),feitas=doneSets();
  $("#sb-count").textContent=feitas+(feitas===1?" série feita":" séries feitas")+(n>feitas?" · "+(n-feitas)+" não feita"+(n-feitas>1?"s":""):"");
  const save=$("#sb-save"),cancel=$("#sb-cancel");
  const off=!navigator.onLine;
  const fs=$("#fim-save");if(fs){fs.disabled=S.saving||off||n===0;fs.textContent=S.saving?"Salvando…":off?"Sem internet":"Concluir treino"}
  if(S.pending){
    save.disabled=S.checking||off;cancel.hidden=true;
    save.textContent=S.checking?"Conferindo a planilha…":off?"Sem internet":"Conferir a planilha";
    return;
  }
  save.disabled=n===0||S.saving||off||!S.alunoId;
  if(S.saving){save.textContent="Salvando…"}
  else if(off){save.textContent="Sem internet";cancel.hidden=true}
  else{save.textContent="Concluir treino";cancel.hidden=true}
}
setInterval(()=>{
  if(!S.draft||S.view!=="lancar")return;
  const mins=minutosTreino(S.draft);const st=$("#sb-time");if(st)st.textContent="⏱ "+fmtMin(mins)+" de treino";
  const c=$("#clock");if(c)c.textContent="treino há "+fmtMin(mins);
  const tl=$("#lancar .tim-live");if(tl&&S.draft.lastTick){const q=Math.floor((Date.now()-((S.draft.rest&&S.draft.rest.at)||S.draft.lastTick))/1000);tl.textContent=Math.floor(q/60)+":"+pad(q%60)}
  checarPausa();
  const r=$("#sb-rest");if(!r)return;
  const R=S.draft.rest;
  if(R){
    const s=Math.floor((Date.now()-R.at)/1000);
    const fase=s<R.min?"":s<=R.max?" ✓ pode ir":" ✓ já pode ir";
    r.innerHTML='<b class="'+(s>=R.min?"rest-ok":"")+'">descanso '+Math.floor(s/60)+":"+pad(s%60)+'</b> · ideal '+R.min+"–"+R.max+" s"+fase+'<br>depois: '+esc(R.prox);
    // vibra ao chegar no mínimo e no máximo do descanso
    if(s>=R.min&&R.buzz<1){R.buzz=1;try{navigator.vibrate&&navigator.vibrate(250)}catch(e){}}
    if(s>=R.max&&R.buzz<2){R.buzz=2;try{navigator.vibrate&&navigator.vibrate([200,120,200])}catch(e){}}
  }else if(S.draft.lastTick){const s=Math.floor((Date.now()-S.draft.lastTick)/1000);r.textContent="descanso "+Math.floor(s/60)+":"+pad(s%60)}
  else r.textContent="preencha as repetições ao terminar cada série";
},1000);

/* Fogos simples ao concluir o treino. Quem pediu menos movimento no celular não vê a animação. */
function fogos(){
  try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return}catch(e){}
  const cv=document.createElement("canvas");cv.className="fogos";cv.setAttribute("aria-hidden","true");document.body.appendChild(cv);
  const W=cv.width=innerWidth,H=cv.height=innerHeight;const c=cv.getContext("2d");
  const fem=document.documentElement.getAttribute("data-genero")==="f";
  const cores=(fem?["#ff8fbe","#e8488f","#ffd6e7"]:["#7db4ff","#2f74e8","#d4e8ff"]).concat(["#ffd34d","#ffffff"]);
  const ps=[];
  const estoura=()=>{const x=W*(.15+Math.random()*.7),y=H*(.12+Math.random()*.4);const cor=cores[Math.floor(Math.random()*cores.length)];
    for(let i=0;i<46;i++){const a=Math.random()*6.283,v=1.5+Math.random()*4.5;ps.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,v:1,cor,r:1.5+Math.random()*2})}};
  estoura();[260,520,820,1150].forEach(t=>setTimeout(estoura,t));setTimeout(()=>cv.remove(),3500);
  const ini=performance.now();
  (function quadro(t){
    c.clearRect(0,0,W,H);
    ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.06;p.vx*=.985;p.v-=.014;if(p.v>0){c.globalAlpha=p.v;c.fillStyle=p.cor;c.beginPath();c.arc(p.x,p.y,p.r,0,6.283);c.fill()}});
    if(t-ini<2800)requestAnimationFrame(quadro);else cv.remove();
  })(ini);
}
function intensityFromRir(rir){if(rir==="")return "";const n=+rir;return n<=0?"Máxima":n===1?"Muito alta":n===2?"Alta":n===3?"Moderada":"Leve"}
function textCell(v){v=String(v==null?"":v).trim();if(!v)return "";if(/^\d+$/.test(v))return Number(v);return "'"+v}

/* Gravação sem duplicar (igual à versão anterior): resultado incerto → não reenvia; confere antes. */
function rowKey(date,treino,ex,serie,feitas){return [date,strip(treino),strip(ex),String(serie).trim(),strip(String(feitas).replace(/^'/,""))].join("|")}
const sentKey=r=>rowKey(r[0],r[2],r[5],r[6],r[8]);
function baseCounts(sent){
  const want=new Set(sent.map(sentKey));const c={};
  S.rows.forEach(r=>{const k=rowKey(r.dateS,r.treino,r.ex,r.serie,r.feitas);if(want.has(k))c[k]=(c[k]||0)+1});
  return c;
}
function countSaved(sent,base){
  const now=baseCounts(sent);const need={};
  sent.forEach(r=>{const k=sentKey(r);need[k]=(need[k]||0)+1});
  let n=0;Object.keys(need).forEach(k=>{n+=Math.min(need[k],Math.max(0,(now[k]||0)-((base||{})[k]||0)))});
  return n;
}
function hashRows(o){const s=JSON.stringify(o);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function setPending(p){S.pending=p;store(PENDING_KEY(),p)}
async function verifyPending(auto){
  if(!S.pending||S.checking)return;
  S.checking=true;updateBar();setSync("busy","Conferindo a planilha…");
  const ok=await fetchDados();
  S.checking=false;
  if(!ok){updateBar();if(!auto)banner("<p>Não consegui reler a planilha para conferir a última gravação. Nada foi reenviado e o rascunho continua guardado. Tente conferir de novo com internet.</p>",true);return}
  const p=S.pending;if(!p)return;const total=p.rows.length;const n=countSaved(p.rows,p.base);
  setPending(null);
  if(n===total){
    if(S.draft&&S.draft.saveId===p.saveId){S.draft=null;saveDraft()}
    S.confirm=false;banner("");toast("Conferido: "+(total===1?"a série já estava":"as "+total+" séries já estavam")+" na planilha");render();
  }else if(n===0){
    banner("<p>Conferi a planilha: a última gravação <b>não entrou</b>. O rascunho está intacto; pode salvar de novo.</p>");updateBar();
  }else{
    banner("<p>Conferi a planilha: só "+n+" de "+total+" séries entraram. Confira a aba Histórico antes de salvar de novo, para não duplicar.</p>",true);updateBar();
  }
}
async function save(){
  if(S.pending){verifyPending(false);return}
  if(!navigator.onLine){netBanner();updateBar();return}
  const d=S.draft;const day=parseDate(d.date);const dia=DIAS[day.getDay()];
  const rows=[];const newEx=[];const grupos=[];
  let firstOfTreino=true;
  d.blocks.forEach(b=>{
    let firstOfEx=true;
    b.sets.forEach(s=>{
      if(!setDone(s))return;
      const nomeEx=s.exNome||b.name;
      let grupo=b.grupo;const known=S.exMap.get(strip(nomeEx));
      if(b.grupoManual){if(known&&known!==grupo&&!grupos.some(x=>strip(x[0])===strip(nomeEx)))grupos.push([nomeEx,grupo])}
      else if(known)grupo=known;
      if(!known&&!newEx.some(x=>strip(x[0])===strip(nomeEx)))newEx.push([nomeEx,grupo]);
      const tagM=firstOfTreino&&d.metodo?"["+((metodoDoDraft(d)||{}).nome||"Método")+" · semana "+d.metodo.semana+" · "+d.metodo.fase+"]":"";
      const iniA=d.animoIni||d.animo;
      const tagA=firstOfTreino?[iniA?"[Ânimo início: "+iniA+"]":"",d.animoFim?"[Ânimo fim: "+d.animoFim+"]":""].filter(Boolean).join(" · "):"";
      const tagD=firstOfTreino?["[Duração: "+minutosTreino(d)+" min]",(d.pausas||[]).length?"[Pausa: "+d.pausas.join("; ")+"]":"",Object.values(d.agua||{}).length?"[Água: bebeu "+Object.values(d.agua).filter(x=>x==="bebi").length+" de "+Object.values(d.agua).length+"]":""].filter(Boolean).join(" · "):"";
      const tagC=s.metaC&&b.metaC&&b.metaC.modo==="meta"?"[Meta coach: "+b.metaC.texto+"]":"";
      const obs=[tagM,tagA,tagD,tagC,s.obs,firstOfEx&&b.orig?"No lugar de: "+b.orig:"",firstOfEx&&b.obs?"[Exercício] "+b.obs:"",firstOfTreino&&d.obs?"[Treino] "+d.obs:""].map(x=>String(x||"").trim()).filter(Boolean).join(" · ");
      firstOfEx=false;firstOfTreino=false;
      rows.push([d.date,dia,d.treino,s.time||d.inicio||"",grupo,nomeEx,s.n,textCell(s.meta),s.skip?"'não fiz":textCell(s.reps),textCell(s.peso),s.skip?"":intensityFromRir(s.rir),s.skip||s.rir===""?"":Number(s.rir),textCell(obs),d.academia||"",b.maq||"",b.maq&&b.salto?String(b.salto):""]);
    });
  });
  if(!rows.length)return;
  const saveId=hashRows([d.started,rows,newEx]);d.saveId=saveId;saveDraft();
  const base=baseCounts(rows);
  S.saving=true;updateBar();setSync("busy","Gravando na planilha…");
  try{
    const res=await callA("gravar",{rows,exercicios:newEx,saveId,grupos});
    newEx.concat(grupos).forEach(x=>S.exMap.set(strip(x[0]),x[1]));
    S.draft=null;saveDraft();S.confirm=false;S.saving=false;S.fim=false;
    const w=(res&&res.written)||rows.length;
    toast(res&&res.duplicate?"Essas séries já estavam salvas na planilha":"Treino salvo: "+w+(w===1?" série":" séries")+" na planilha");
    fogos();S.painelAt=0;
    banner("");S.coachSel=d.date+"|"+d.treino;S.coachEsperando=true;setView("coach");window.scrollTo({top:0});
    fetchDados().finally(()=>{S.coachEsperando=false;if(S.view==="coach")renderCoach();pedirParecerIA(S.coachSel)});
  }catch(e){
    S.saving=false;S.confirm=false;S.fim=false;render();
    if(e&&e.sent){
      setPending({saveId,rows,base,at:Date.now()});
      setSync("err","Gravação não confirmada");
      banner("<p>"+esc(errText(e))+" <b>A gravação pode ter entrado ou não.</b> O app não vai reenviar sozinho: toque em <b>Conferir a planilha</b> para reler e ver se as séries já estão lá. O rascunho continua guardado.</p>",true);
    }else{
      setSync("err","Nada foi gravado");
      banner("<p>"+esc(errText(e))+" Nada foi gravado; o rascunho continua guardado.</p>",true);
    }
    updateBar();
  }
}
$("#sb-save").onclick=()=>{
  if(S.pending){verifyPending(false);return}
  if(!navigator.onLine){netBanner();updateBar();return}
  S.fim=true;render();window.scrollTo({top:0});
};
$("#sb-cancel").onclick=()=>{S.confirm=false;updateBar()};

/* ========== EVOLUÇÃO ========== */
const charts={};
function weekStart(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return x}
function inPeriod(){
  if(!S.rows.length)return {cur:[],prev:[],weeks:[]};
  const lastDate=new Date(Math.max(...S.rows.map(r=>+r.date)));
  const end=weekStart(lastDate);end.setDate(end.getDate()+7);
  const first=weekStart(new Date(Math.min(...S.rows.map(r=>+r.date))));
  let start=first;
  if(S.period>0){start=new Date(end);start.setDate(start.getDate()-7*S.period);if(start<first)start=first}
  const span=end-start;const pstart=new Date(+start-span);
  const weeks=[];for(let w=new Date(start);w<end;w.setDate(w.getDate()+7))weeks.push(new Date(w));
  const ok=r=>r.done&&S.groups.has(r.grupo);
  return {cur:S.rows.filter(r=>r.date>=start&&r.date<end&&ok(r)),prev:S.rows.filter(r=>r.date>=pstart&&r.date<start&&ok(r)),weeks,start,end};
}
function deltaHtml(a,b){
  if(!b){return '<span class="delta flat">sem período anterior</span>'}
  const p=(a-b)/b*100;const cls=Math.abs(p)<2?"flat":p>0?"up":"down";
  return '<span class="delta '+cls+'">'+(p>0?"▲ ":p<0?"▼ ":"")+nf0.format(Math.abs(p))+'% vs período anterior</span>';
}
function chartEmpty(id,msg){
  const cv=$("#"+id);const box=cv.parentElement;let ov=box.querySelector(".empty-chart");
  if(charts[id]){charts[id].destroy();delete charts[id]}
  if(msg){cv.hidden=true;if(!ov){ov=document.createElement("div");ov.className="empty-chart";box.appendChild(ov)}ov.textContent=msg;ov.hidden=false;return true}
  cv.hidden=false;if(ov)ov.hidden=true;return false;
}
function tipBase(){return {backgroundColor:css("--ink"),titleColor:css("--bg"),bodyColor:css("--bg"),padding:10,boxPadding:4,usePointStyle:true}}
function lineChart(id,labels,datasets,unit,opts){
  if(chartEmpty(id,null))return;
  const ink3=css("--ink-3"),line=css("--line"),surf=css("--surface");
  charts[id]=new Chart($("#"+id),{type:"line",data:{labels,datasets:datasets.map(ds=>Object.assign({borderWidth:2,tension:.25,pointRadius:3,pointHoverRadius:6,pointBackgroundColor:ds.borderColor,pointBorderColor:surf,spanGaps:true},ds))},
    options:{maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},
      plugins:{legend:{display:false},tooltip:Object.assign(tipBase(),{callbacks:{label:c=>" "+c.dataset.label+": "+nf1.format(c.parsed.y)+" "+unit}})},
      scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:6,color:ink3}},
        y:Object.assign({grid:{color:line},border:{display:false},ticks:{color:ink3,callback:v=>nf1.format(v)+" "+unit}},opts&&opts.y||{})}}});
}
function renderForca(){
  const sel=$("#f-ex");
  const by=new Map();S.rows.forEach(r=>{if(!r.e1)return;const k=exKey(r.ex);if(!by.has(k))by.set(k,{name:r.ex,n:0,ses:new Map()});const o=by.get(k);o.name=r.ex;o.n++;
    const b=o.ses.get(r.dateS);if(!b||r.e1>b.e1)o.ses.set(r.dateS,r)});
  const list=[...by.entries()].filter(([,o])=>o.ses.size>=2).sort((a,b)=>b[1].n-a[1].n);
  if(!list.length){sel.innerHTML="";sel.hidden=true;chartEmpty("ch-forca","Faça o mesmo exercício em pelo menos 2 treinos para ver a curva de força.");return}
  sel.hidden=false;
  if(!S.forcaEx||!by.has(S.forcaEx)||by.get(S.forcaEx).ses.size<2)S.forcaEx=list[0][0];
  sel.innerHTML=list.map(([k,o])=>'<option value="'+esc(k)+'"'+(k===S.forcaEx?" selected":"")+'>'+esc(o.name)+' ('+o.ses.size+' treinos)</option>').join("");
  sel.onchange=()=>{S.forcaEx=sel.value;renderForca()};
  const pts=[...by.get(S.forcaEx).ses.values()].sort((a,b)=>a.date-b.date);
  const gv=GROUP_VAR[pts[pts.length-1].grupo]||"--g-inf";
  lineChart("ch-forca",pts.map(r=>fmtShort(r.date)),[{label:"1RM estimado",data:pts.map(r=>+r.e1.toFixed(1)),borderColor:css(gv),backgroundColor:css(gv)}],"kg");
}
function avalSeries(){
  return S.avals.map(a=>{const c=Body.calc(a.v,S.aluno||{},a.date);const g=k=>{const n=Body.num(a.v[k]);return isFinite(n)?n:(isFinite(c[k])?c[k]:null)};
    return {a,peso:g("Peso (kg)"),magra:g("Massa magra (kg)"),gorda:g("Massa gorda (kg)"),gord:g("% Gordura")}});
}
function renderCorpo(){
  const ser=avalSeries();const lg=$("#lg-corpo");
  if(!ser.length){chartEmpty("ch-corpo","Ainda não há avaliações físicas. Elas aparecem aqui depois da primeira avaliação.");lg.innerHTML="";}
  else{
    const ds=[{label:"Peso",data:ser.map(x=>x.peso),borderColor:css("--g-cos"),backgroundColor:css("--g-cos")},
      {label:"Massa magra",data:ser.map(x=>x.magra),borderColor:css("--g-pei"),backgroundColor:css("--g-pei")},
      {label:"Massa gorda",data:ser.map(x=>x.gorda),borderColor:css("--g-bra"),backgroundColor:css("--g-bra")}].filter(d=>d.data.some(v=>v!=null));
    if(!ds.length)chartEmpty("ch-corpo","As avaliações ainda não têm peso.");
    else{lineChart("ch-corpo",ser.map(x=>fmtShort(x.a.date)+"/"+String(x.a.date.getFullYear()).slice(2)),ds,"kg",{y:{beginAtZero:false}});
      lg.innerHTML=ds.map(d=>'<span><i style="background:'+d.borderColor+'"></i>'+esc(d.label)+'</span>').join("")+
        (ser.some(x=>x.gord!=null)?'<span>% gordura atual: <b>'+nf1.format(ser.filter(x=>x.gord!=null).slice(-1)[0].gord)+'%</b></span>':"")}
  }
  const sel=$("#f-medida");
  const meds=Body.PER.map(f=>f.k).filter(k=>S.avals.some(a=>isFinite(Body.num(a.v[k]))));
  if(!meds.length){sel.hidden=true;chartEmpty("ch-medida","Sem medidas de perímetro ainda.");return}
  sel.hidden=false;if(!S.medida||!meds.includes(S.medida))S.medida=meds.includes("Braço contraído D (cm)")?"Braço contraído D (cm)":meds[0];
  sel.innerHTML=meds.map(k=>'<option'+(k===S.medida?" selected":"")+'>'+esc(k)+'</option>').join("");
  sel.onchange=()=>{S.medida=sel.value;renderCorpo()};
  const pts=S.avals.filter(a=>isFinite(Body.num(a.v[S.medida])));
  lineChart("ch-medida",pts.map(a=>fmtShort(a.date)+"/"+String(a.date.getFullYear()).slice(2)),[{label:S.medida.replace(/ \(cm\)$/,""),data:pts.map(a=>Body.num(a.v[S.medida])),borderColor:css("--g-inf"),backgroundColor:css("--g-inf")}],"cm",{y:{beginAtZero:false}});
}
function renderEvo(){
  renderCoach();
  const modoEvo=evoModo();
  $("#evo-topo").innerHTML=chaveEvo();$("#evo-graf").hidden=modoEvo==="setas";$("#evo-setas").hidden=modoEvo!=="setas";
  ligarChaveEvo($("#evo-topo"),renderEvo);
  if(modoEvo==="setas"){$("#evo-setas").innerHTML=evoSetasHtml();return}
  $("#f-period").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.p===S.period)));
  $("#f-groups").innerHTML=GROUPS.map(g=>'<button class="chip" data-g="'+esc(g.k)+'" aria-pressed="'+S.groups.has(g.k)+'"><i style="background:var('+g.v+')"></i>'+esc(g.k)+'</button>').join("");
  $("#f-groups").querySelectorAll(".chip").forEach(c=>c.onclick=()=>{const g=c.dataset.g;if(S.groups.has(g)){if(S.groups.size>1)S.groups.delete(g)}else S.groups.add(g);renderEvo()});
  if(!S.alunoId||!S.loaded){
    $("#kpis").innerHTML='<div class="empty" style="grid-column:1/-1">'+(!S.alunoId&&S.role==="prof"?"Escolha um aluno em Alunos, na tela inicial.":S.error?"Sem dados da planilha. Veja o aviso acima.":"Lendo a planilha…")+'</div>';
    ["groups","prs","last"].forEach(id=>$("#"+id).innerHTML="");return;
  }
  if(!window.Chart){$("#kpis").innerHTML='<div class="empty" style="grid-column:1/-1">Não consegui carregar os gráficos. Feche e abra o app.</div>';return}
  Chart.defaults.font.family="Barlow, system-ui, sans-serif";Chart.defaults.color=css("--ink-3");
  renderForca();renderCorpo();
  const P=inPeriod();
  const sessCount=rows=>new Set(rows.map(r=>r.dateS+"|"+r.treino)).size;
  const vol=rows=>rows.reduce((a,r)=>a+r.vol,0)/1000;
  const nW=Math.max(1,P.weeks.length);
  const k=[
    {l:"Treinos",v:nf0.format(sessCount(P.cur)),d:deltaHtml(sessCount(P.cur),sessCount(P.prev))},
    {l:"Séries feitas",v:nf0.format(P.cur.length),d:deltaHtml(P.cur.length,P.prev.length)},
    {l:"Volume total",v:nf1.format(vol(P.cur))+"<small>t</small>",d:deltaHtml(vol(P.cur),vol(P.prev))},
    {l:"Treinos por semana",v:nf1.format(sessCount(P.cur)/nW),d:'<span class="delta flat">'+nW+' semanas no período</span>'}];
  $("#kpis").innerHTML=k.map(x=>'<div class="kpi"><span class="l">'+x.l+'</span><span class="v">'+x.v+'</span>'+x.d+'</div>').join("");
  const active=GROUPS.filter(g=>S.groups.has(g.k));
  const labels=P.weeks.map(w=>fmtShort(w));
  const wIdx=d=>{const ws=+weekStart(d);return P.weeks.findIndex(w=>+w===ws)};
  const volBy={},setBy={};
  active.forEach(g=>{volBy[g.k]=P.weeks.map(()=>0);setBy[g.k]=P.weeks.map(()=>0)});
  P.cur.forEach(r=>{const i=wIdx(r.date);if(i<0||!volBy[r.grupo])return;volBy[r.grupo][i]+=r.vol/1000;setBy[r.grupo][i]+=1});
  drawCharts(labels,active,volBy,setBy);
  $("#groups").innerHTML=active.map(g=>{
    const cur=P.cur.filter(r=>r.grupo===g.k),prev=P.prev.filter(r=>r.grupo===g.k);
    const byEx=new Map();cur.forEach(r=>{const kk=exKey(r.ex);if(!byEx.has(kk))byEx.set(kk,[]);byEx.get(kk).push(r)});
    let top=null;byEx.forEach((rs,kk)=>{if(!top||rs.length>top.rs.length)top={kk,rs}});
    let topTxt="sem séries no período";
    if(top){const best=top.rs.reduce((a,r)=>r.e1>a.e1?r:a,top.rs[0]);topTxt='Mais feito: <b>'+esc(top.rs[top.rs.length-1].ex)+'</b>'+(best.e1?' · melhor '+esc(best.reps.join("+"))+' × '+esc(best.peso):"")}
    return '<div class="gcard" style="--gc:var('+g.v+')"><h3>'+esc(g.k)+'</h3><div class="big">'+nf1.format(vol(cur))+' <span class="small muted">t</span></div>'+deltaHtml(vol(cur),vol(prev))+
      '<div class="muted small">'+cur.length+' séries · '+sessCount(cur)+' treinos</div><canvas data-spark="'+esc(g.k)+'" height="46" aria-label="Tendência de volume de '+esc(g.k)+'"></canvas><div class="ex-best">'+topTxt+'</div></div>';
  }).join("");
  document.querySelectorAll("canvas[data-spark]").forEach(cv=>spark(cv,volBy[cv.dataset.spark]||[],css(GROUP_VAR[cv.dataset.spark])));
  const ex=new Map();
  P.cur.forEach(r=>{if(!r.e1)return;const kk=exKey(r.ex);if(!ex.has(kk))ex.set(kk,{name:r.ex,grupo:r.grupo,best:r,first:r,last:r,sessions:new Set()});const o=ex.get(kk);o.name=r.ex;o.sessions.add(r.dateS);if(r.e1>o.best.e1)o.best=r;if(r.date<o.first.date)o.first=r;
    if(r.date>o.last.date||(+r.date===+o.last.date&&r.e1>o.last.e1))o.last=r});
  const firstBest=new Map();P.cur.forEach(r=>{if(!r.e1)return;const kk=exKey(r.ex);const o=ex.get(kk);if(+r.date===+o.first.date){const fb=firstBest.get(kk);if(!fb||r.e1>fb.e1)firstBest.set(kk,r)}});
  const lastBest=new Map();P.cur.forEach(r=>{if(!r.e1)return;const kk=exKey(r.ex);const o=ex.get(kk);if(r.dateS===o.last.dateS){const lb=lastBest.get(kk);if(!lb||r.e1>lb.e1)lastBest.set(kk,r)}});
  const order=GROUPS.map(g=>g.k);
  const list=[...ex.entries()].filter(([,o])=>o.sessions.size>=2).sort((a,b)=>order.indexOf(a[1].grupo)-order.indexOf(b[1].grupo)||b[1].best.e1-a[1].best.e1).slice(0,40);
  $("#prs").innerHTML='<thead><tr><th>Exercício</th><th>Grupo</th><th class="n">1RM est.</th><th>Melhor série</th><th>Data</th><th class="n">Evolução</th></tr></thead><tbody>'+
    (list.length?list.map(([kk,o])=>{const fb=firstBest.get(kk),lb=lastBest.get(kk);const ch=fb&&lb&&fb.e1?(lb.e1-fb.e1)/fb.e1*100:0;const cls=Math.abs(ch)<2?"flat":ch>0?"up":"down";
      return '<tr><td>'+esc(o.name)+'</td><td><span class="tag"><i style="background:var('+(GROUP_VAR[o.grupo]||"--g-abd")+')"></i>'+esc(o.grupo)+'</span></td><td class="n">'+nf0.format(o.best.e1)+' kg</td><td>'+esc(o.best.reps.join("+"))+' × '+esc(o.best.peso)+'</td><td>'+fmtShort(o.best.date)+'</td><td class="n"><span class="delta '+cls+'">'+(ch>0?"▲ ":ch<0?"▼ ":"")+nf0.format(Math.abs(ch))+'%</span></td></tr>'}).join("")
      :'<tr><td colspan="6" class="muted">Sem exercícios repetidos no período.</td></tr>')+'</tbody>';
  try{comentariosEvo(P,active,volBy,setBy,list,firstBest,lastBest)}catch(e){console.error(e)}
  const ss=sessions().filter(s=>s.rows.some(r=>r.done)).slice(-8).reverse();
  $("#last").innerHTML='<thead><tr><th>Data</th><th>Treino</th><th>Grupos</th><th class="n">Séries</th><th class="n">Volume</th><th>Início</th></tr></thead><tbody>'+
    ss.map(s=>{const dn=s.rows.filter(r=>r.done);const grs=[...new Set(dn.map(r=>r.grupo))].filter(g=>GROUP_VAR[g]);const first=s.rows.find(r=>/^\d{1,2}:\d{2}/.test(r.hora));
      return '<tr><td>'+fmtShort(s.date)+' <span class="muted small">'+esc((s.rows[0].dia||"").slice(0,3))+'</span></td><td>'+esc(s.treino)+'</td><td>'+grs.map(g=>'<span class="tag"><i style="background:var('+GROUP_VAR[g]+')"></i>'+esc(g)+'</span>').join(" ")+'</td><td class="n">'+dn.length+'</td><td class="n">'+nf1.format(dn.reduce((a,r)=>a+r.vol,0)/1000)+' t</td><td>'+(first?esc(first.hora):"–")+'</td></tr>'}).join("")+'</tbody>';
}
/* Comentário curto do coach em cada caixa da Evolução. Fica visível mesmo com a caixa fechada. */
function comentarEvo(titulo,texto){
  const c=[...document.querySelectorAll("#v-evo .card")].find(x=>tituloCard(x)===titulo);if(!c)return;
  let d=c.querySelector(":scope>.ev-cm");
  if(!texto){if(d)d.remove();return}
  if(!d){d=document.createElement("div");d.className="ev-cm";c.appendChild(d)}
  d.innerHTML=Icone("speakerphone",15)+'<span>'+esc(texto)+'</span>';
}
function comentariosEvo(P,active,volBy,setBy,list,firstBest,lastBest){
  const sess=rs=>new Set(rs.map(r=>r.dateS+"|"+r.treino)).size;const vol=rs=>rs.reduce((a,r)=>a+r.vol,0)/1000;
  const nW=Math.max(1,P.weeks.length);const porSem=sess(P.cur)/nW,ant=P.prev.length?sess(P.prev)/nW:null;
  comentarEvo("Resumo do período",!P.cur.length?"Sem treinos neste período. Cada novo treino volta a contar a sua evolução.":
    nf1.format(porSem)+" treinos por semana"+(ant!=null&&porSem>ant?", mais que no período anterior. Continue assim.":porSem>=3?". Ótima frequência.":". Mantenha essa regularidade."));
  const avanc=list.map(([kk,o])=>{const f=firstBest.get(kk),l=lastBest.get(kk);return {n:o.name,p:f&&l&&f.e1?(l.e1-f.e1)/f.e1*100:0}}).sort((a,b)=>b.p-a.p)[0];
  comentarEvo("Evolução de força",avanc&&avanc.p>=1?"Maior avanço no período: "+avanc.n+", +"+nf0.format(avanc.p)+"%. É isso que eu quero ver.":"Força estável no período.");
  const av=S.avals||[];const ult=av[av.length-1],pen=av[av.length-2];
  const val=(a,k)=>{if(!a)return NaN;const n=Body.num(a.v[k]);if(isFinite(n))return n;const c=Body.calc(a.v,S.aluno||{},a.date);return isFinite(c[k])?c[k]:NaN};
  const dif=k=>val(ult,k)-val(pen,k);
  const pd=dif("Peso (kg)"),md=dif("Massa magra (kg)");
  comentarEvo("Peso e composição",!av.length?"A primeira avaliação física abre este acompanhamento.":!pen?"Primeira referência registrada. A próxima avaliação mostrará a sua evolução.":
    !isFinite(pd)?"Mantenha as avaliações em dia para acompanhar a sua composição.":
    (Math.abs(pd)<.05?"Peso estável":"Peso "+(pd>0?"subiu ":"caiu ")+nf1.format(Math.abs(pd))+" kg")+(isFinite(md)&&Math.abs(md)>=.05?", massa magra "+(md>0?"subiu ":"caiu ")+nf1.format(Math.abs(md))+" kg.":" desde a última avaliação."));
  const cd=dif("Cintura (cm)");
  comentarEvo("Medidas",!pen?"As medidas ganham sentido a partir da segunda avaliação.":isFinite(cd)&&Math.abs(cd)>=.1?"Cintura "+(cd>0?"aumentou ":"diminuiu ")+nf1.format(Math.abs(cd))+" cm desde a última avaliação.":"Compare a mesma medida entre as avaliações para ver a sua evolução.");
  const n=P.weeks.length;const mud=active.map(g=>{const v=volBy[g.k]||[];const rec=v.slice(-2).reduce((a,b)=>a+b,0),pre=v.slice(-4,-2).reduce((a,b)=>a+b,0);return {g:g.k,p:pre?(rec-pre)/pre*100:null}}).filter(x=>x.p!=null).sort((a,b)=>a.p-b.p);
  const pior=mud[0],melhor=mud[mud.length-1];
  comentarEvo("Volume semanal por grupo",n<4||!mud.length?"Com mais semanas de treino, este gráfico mostra a sua tendência.":pior.p<=-15?pior.g+" caiu nas últimas 2 semanas. Vale dar atenção para retomar o volume.":melhor.p>=10?melhor.g+" cresceu "+nf0.format(melhor.p)+"% nas últimas 2 semanas. Bom trabalho.":"Volume estável nas últimas semanas.");
  const tot=active.map(g=>({g:g.k,n:(setBy[g.k]||[]).reduce((a,b)=>a+b,0)})).sort((a,b)=>a.n-b.n);
  comentarEvo("Séries por semana",!tot.length||!tot[tot.length-1].n?"":tot.length>1&&tot[0].n<tot[tot.length-1].n*.5?tot[0].g+" é o grupo com menos séries no período. Vale equilibrar.":"Séries bem distribuídas entre os grupos.");
  const gr=active.map(g=>{const c=vol(P.cur.filter(r=>r.grupo===g.k)),a=vol(P.prev.filter(r=>r.grupo===g.k));return {g:g.k,p:a?(c-a)/a*100:null}}).filter(x=>x.p!=null).sort((a,b)=>b.p-a.p);
  comentarEvo("Por grupo muscular",gr.length&&gr[0].p>=2?gr[0].g+" foi o grupo que mais evoluiu no período.":"Os grupos estão estáveis em relação ao período anterior.");
  const ini=P.cur.length?Math.min(...P.cur.map(r=>+r.date)):0;
  const rec=list.filter(([kk,o])=>{const a=S.rows.filter(r=>+r.date<ini&&r.e1&&exKey(r.ex)===kk).map(r=>r.e1);return a.length&&o.best.e1>Math.max(...a)});
  comentarEvo("Recordes por exercício",rec.length?rec.length+(rec.length===1?" recorde":" recordes")+" no período. Muito bom.":"Sem novos recordes no período.");
  const ses=sessions().filter(s=>s.rows.some(r=>r.done));const ul=ses[ses.length-1];
  if(ul){const hoje=new Date();const d=Math.floor((hoje-ul.date)/864e5);const sug=suggestion(templates());
    comentarEvo("Últimos treinos",(d<=0?"Você treinou hoje.":d===1?"Seu último treino foi ontem.":"Seu último treino foi há "+d+" dias.")+(sug?" Próximo: "+sug+".":""))}
}
function spark(cv,data,color){
  const dpr=window.devicePixelRatio||1;const w=cv.clientWidth||200,h=46;cv.width=w*dpr;cv.height=h*dpr;const c=cv.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);
  if(!data.length)return;const max=Math.max(...data,0.001);const step=data.length>1?(w-8)/(data.length-1):0;
  const pts=data.map((v,i)=>[4+i*step,h-6-(v/max)*(h-14)]);
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.lineTo(pts[pts.length-1][0],h-2);c.lineTo(pts[0][0],h-2);c.closePath();
  c.globalAlpha=.15;c.fillStyle=color;c.fill();c.globalAlpha=1;
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=color;c.lineWidth=2;c.lineJoin="round";c.stroke();
  const L=pts[pts.length-1];c.beginPath();c.arc(L[0],L[1],3.5,0,7);c.fillStyle=color;c.fill();c.lineWidth=2;c.strokeStyle=css("--surface");c.stroke();
}
const endLabels={id:"endLabels",afterDatasetsDraw(chart){
  if(chart.config.type!=="line")return;const {ctx,chartArea}=chart;const items=[];
  chart.data.datasets.forEach((ds,i)=>{const meta=chart.getDatasetMeta(i);if(meta.hidden)return;const p=meta.data[meta.data.length-1];if(!p)return;items.push({y:p.y,x:p.x,t:ds.label,c:ds.borderColor})});
  items.sort((a,b)=>a.y-b.y);for(let i=1;i<items.length;i++)if(items[i].y-items[i-1].y<15)items[i].y=items[i-1].y+15;
  ctx.save();ctx.font="600 12px Barlow, system-ui, sans-serif";ctx.textBaseline="middle";
  items.forEach(it=>{const x=chartArea.right+8;ctx.fillStyle=it.c;ctx.fillRect(x,it.y-4,8,8);ctx.fillStyle=css("--ink-2");ctx.fillText(it.t,x+12,it.y)});ctx.restore();
}};
function drawCharts(labels,active,volBy,setBy){
  const ink3=css("--ink-3"),line=css("--line"),surf=css("--surface");
  const tip=Object.assign(tipBase(),{callbacks:{title:items=>"Semana de "+items[0].label}});
  const narrow=window.innerWidth<640;
  const volDS=active.map(g=>({label:g.k,data:volBy[g.k].map(v=>+v.toFixed(2)),borderColor:css(g.v),backgroundColor:css(g.v),borderWidth:2,tension:.3,pointRadius:0,pointHoverRadius:5,pointHoverBorderColor:surf,pointHoverBorderWidth:2}));
  chartEmpty("ch-vol",null);
  charts["ch-vol"]=new Chart($("#ch-vol"),{type:"line",data:{labels,datasets:volDS},plugins:narrow?[]:[endLabels],
    options:{maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},layout:{padding:{right:narrow?4:84}},
      plugins:{legend:{display:false},tooltip:{...tip,callbacks:{...tip.callbacks,label:c=>" "+c.dataset.label+": "+nf1.format(c.parsed.y)+" t"}}},
      scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:narrow?5:10,color:ink3}},y:{beginAtZero:true,grid:{color:line},border:{display:false},ticks:{color:ink3,callback:v=>nf1.format(v)+" t"}}}}});
  const setDS=active.map(g=>({label:g.k,data:setBy[g.k],backgroundColor:css(g.v),borderColor:surf,borderWidth:{top:2},borderRadius:3,borderSkipped:"bottom",maxBarThickness:28}));
  chartEmpty("ch-sets",null);
  charts["ch-sets"]=new Chart($("#ch-sets"),{type:"bar",data:{labels,datasets:setDS},
    options:{maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},
      plugins:{legend:{display:false},tooltip:{...tip,callbacks:{...tip.callbacks,label:c=>" "+c.dataset.label+": "+c.parsed.y+" séries",footer:items=>"Total: "+items.reduce((a,i)=>a+i.parsed.y,0)+" séries"}}},
      scales:{x:{stacked:true,grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:narrow?5:8,color:ink3}},y:{stacked:true,beginAtZero:true,grid:{color:line},border:{display:false},ticks:{color:ink3,precision:0}}}}});
  const lg=active.map(g=>'<span><i style="background:var('+g.v+')"></i>'+esc(g.k)+'</span>').join("");
  $("#lg-vol").innerHTML=lg;$("#lg-sets").innerHTML=lg;
}
/* Evolução: tocar no título abre e fecha o bloco. O app lembra como ficou. */
const EVO_MIN="dt2-evo-min";
const tituloCard=c=>{const t=c.querySelector(".card-h h2");return t?t.textContent:""};
function aplicarMinEvo(){
  const fechados=store(EVO_MIN)||[];
  document.querySelectorAll("#v-evo .card").forEach(c=>{const h=c.querySelector(".card-h");if(!h)return;
    const min=fechados.includes(tituloCard(c));c.classList.toggle("min",min);
    h.setAttribute("role","button");h.setAttribute("tabindex","0");h.setAttribute("aria-expanded",String(!min))});
}
function alternarCardEvo(h){
  const c=h.parentElement;const min=c.classList.toggle("min");h.setAttribute("aria-expanded",String(!min));
  const fechados=[...document.querySelectorAll("#v-evo .card.min")].map(tituloCard);store(EVO_MIN,fechados);
  if(!min)renderEvo(); // gráfico precisa redesenhar depois de ficar visível
}
$("#v-evo").addEventListener("click",e=>{const h=e.target.closest(".card-h");if(h)alternarCardEvo(h)});
$("#v-evo").addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const h=e.target.closest(".card-h");if(h){e.preventDefault();alternarCardEvo(h)}});
aplicarMinEvo();
$("#f-period").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;S.period=+b.dataset.p;renderEvo()});

/* ========== AVALIAÇÃO ========== */
const isoToBr=s=>{const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+"/"+m[2]+"/"+m[1]:""};
const brToIso=s=>{const m=String(s||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?m[3]+"-"+pad(+m[2])+"-"+pad(+m[1]):""};
function fmtVal(k,v){const n=Body.num(v);if(!isFinite(n))return esc(v||"–");return (k==="RCQ"?nf2:nf1).format(n)}
function renderAval(){
  const el=$("#aval");
  if(needAluno(el))return;
  if(!S.loaded){el.innerHTML='<div class="empty">'+(S.error?"Sem dados da planilha. Veja o aviso acima.":"Lendo a planilha…")+'</div>';return}
  const prof=S.role==="prof";
  if(S.avEdit)return renderAvalEdit(el);
  const list=S.avals;
  if(!list.length){
    el.innerHTML='<div class="av-top"><h2>Avaliação física</h2>'+(prof?'<button class="btn primary" id="av-new">+ Nova avaliação</button>':"")+'</div>'+
      '<div class="empty">'+(prof?"Nenhuma avaliação ainda. Toque em <b>Nova avaliação</b> para lançar peso e medidas.":"Seu professor ainda não lançou nenhuma avaliação física. Quando lançar, ela aparece aqui com a sua evolução.")+'</div>';
    const n=$("#av-new");if(n)n.onclick=()=>startAvEdit(null);return;
  }
  if(S.avSel==null||!list[S.avSel])S.avSel=list.length-1;
  const cur=list[S.avSel],prev=list[S.avSel-1]||null;
  const c=Body.calc(cur.v,S.aluno||{},cur.date),pc=prev?Body.calc(prev.v,S.aluno||{},prev.date):{};
  const get=(a,cc,k)=>{const n=Body.num(a.v[k]);return isFinite(n)?n:(isFinite(cc[k])?cc[k]:NaN)};
  const delta=(k,inv)=>{if(!prev)return "";const a=get(cur,c,k),b=get(prev,pc,k);if(!isFinite(a)||!isFinite(b))return "";const d=a-b;if(Math.abs(d)<0.05)return '<span class="delta flat">= igual</span>';
    const good=inv?d<0:d>0;return '<span class="delta '+(good?"up":"down")+'">'+(d>0?"▲ +":"▼ ")+nf1.format(d)+'</span>'};
  const menos=new Set(["% Gordura","Massa gorda (kg)","Cintura (cm)","Abdômen (cm)","RCQ","IMC"].concat(Body.DOB.map(f=>f.k)));
  const field=f=>{const v=cur.v[f.k];if(!String(v||"").trim())return "";
    return '<div class="mfield" data-k="'+esc(f.k)+'"><label>'+esc(f.k.replace(/ \((cm|mm|kg|bpm)\)$/,""))+'</label><span class="val">'+fmtVal(f.k,v)+(f.u?'<small>'+f.u+'</small>':"")+'</span>'+delta(f.k,menos.has(f.k))+'</div>'};
  const sec=(t,fs)=>{const h=fs.map(field).join("");return h?'<div class="av-sec"><h3>'+t+'</h3><div class="mgrid">'+h+'</div></div>':""};
  const kpi=(l,k,u)=>{const v=get(cur,c,k);if(k==="% Gordura"&&c._estimado)l="% Gordura (aprox.)";return isFinite(v)?'<div class="kpi"><span class="l">'+l+'</span><span class="v">'+(k==="RCQ"?nf2:nf1).format(v)+(u?'<small>'+u+'</small>':"")+'</span>'+delta(k,menos.has(k))+'</div>':""};
  el.innerHTML='<div class="av-top"><div><h2>Avaliação física</h2><span class="muted small">'+list.length+(list.length===1?" avaliação":" avaliações")+(prev?" · comparando com "+prev.dataS:"")+'</span></div>'+
    '<div class="row-btns"><select id="av-sel" aria-label="Escolher avaliação">'+list.map((a,i)=>'<option value="'+i+'"'+(i===S.avSel?" selected":"")+'>'+esc(a.dataS)+'</option>').join("")+'</select>'+
    (prof?'<button class="btn" id="av-edit">Editar</button><button class="btn primary" id="av-new">+ Nova</button>':"")+'</div></div>'+
    '<div class="calc" style="margin-bottom:14px">'+kpi("Peso","Peso (kg)","kg")+kpi("IMC","IMC","")+kpi("% Gordura","% Gordura","%")+kpi("Massa magra","Massa magra (kg)","kg")+kpi("Massa gorda","Massa gorda (kg)","kg")+kpi("Cintura/quadril","RCQ","")+'</div>'+
    graficosAval(get(cur,c,"% Gordura"),get(cur,c,"Massa magra (kg)"),get(cur,c,"Massa gorda (kg)"))+estimativaHtml(get(cur,c,"Peso (kg)"),get(cur,c,"% Gordura"))+
    '<div class="av-grid"><div class="card body-card"><div class="body-wrap" id="body">'+Body.svg(cur.v,S.avPt)+'</div>'+
    '<div class="body-legend"><span><i style="background:var(--good)"></i>medido</span><span><i style="background:var(--action)"></i>medida (fita)</span><span><i style="background:#eda100"></i>dobra</span></div></div>'+
    '<div>'+sec("Geral",Body.GERAL)+sec("Bioimpedância",Body.BIO)+sec("Perímetros (fita)",Body.PER)+sec("Dobras cutâneas",Body.DOB)+
    (cur.v[Body.OBS]?'<div class="av-sec"><h3>Observações</h3><p>'+esc(cur.v[Body.OBS])+'</p></div>':"")+
    notaGordura(c)+'</div></div>'+fotosAvHtml(cur);
  ligarEstimativa();ligarFotosAv(cur);
  $("#av-sel").onchange=e=>{S.avSel=+e.target.value;S.avPt=null;renderAval()};
  const n=$("#av-new");if(n)n.onclick=()=>startAvEdit(null);
  const ed=$("#av-edit");if(ed)ed.onclick=()=>startAvEdit(cur);
  bindBody(false);
}
/* Explica de onde veio o % de gordura. Sem dobras nem bioimpedância, mostra as duas estimativas. */
function notaGordura(c){
  if(!c._protocolo)return "";
  if(!c._estimado)return '<p class="note">% de gordura calculado por '+esc(c._protocolo)+'.</p>';
  const ambos=isFinite(c._gMedidas)&&isFinite(c._gPesoIdade);
  return '<p class="note">% de gordura aproximado, calculado por '+esc(c._estimado)+'.'+
    (ambos?' Pelo peso, altura e idade daria '+nf1.format(c._gPesoIdade)+'%. Esse segundo valor costuma sair alto em quem tem muito músculo.':"")+
    ' Compare sempre avaliações com as mesmas medidas e a fita no mesmo lugar.</p>';
}
function bindBody(edit){
  $("#body").querySelectorAll(".pt").forEach(g=>{
    const go=()=>{
      const p=Body.POINTS.find(x=>x.id===g.dataset.pt);S.avPt=p.id;
      $("#body").innerHTML=Body.svg(edit?S.avEdit.v:S.avals[S.avSel].v,S.avPt);bindBody(edit);
      document.querySelectorAll(".mfield.sel").forEach(m=>m.classList.remove("sel"));
      let first=null;p.keys.forEach(k=>{const m=document.querySelector('.mfield[data-k="'+CSS.escape(k)+'"]');if(m){m.classList.add("sel");first=first||m}});
      if(first){const det=first.closest("details");if(det)det.open=true;first.scrollIntoView({block:"center",behavior:"smooth"});const i=first.querySelector("input");if(i)setTimeout(()=>i.focus({preventScroll:true}),250)}
      else if(!edit)toast(p.t+": não medido nesta avaliação");
    };
    g.addEventListener("click",go);g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}});
  });
}
function startAvEdit(a){
  const last=S.avals[S.avals.length-1];
  const v=a?Object.assign({},a.v):{"Data":fmtDate(new Date()),"Altura (cm)":(last&&last.v["Altura (cm)"])||(S.aluno&&S.aluno.altura)||""};
  S.avEdit={linha:a?a.linha:null,v};S.avPt=null;renderAval();window.scrollTo({top:0});
}
function renderAvalEdit(el){
  const E=S.avEdit;const v=E.v;
  const inp=f=>'<div class="mfield" data-k="'+esc(f.k)+'"><label for="av-'+esc(f.k)+'">'+esc(f.k)+'</label><input id="av-'+esc(f.k)+'" data-k="'+esc(f.k)+'" '+(f.text?'':'inputmode="decimal" ')+'autocomplete="off" value="'+esc(v[f.k]||"")+'" placeholder="'+esc(f.ph||"")+'"></div>';
  const sec=(t,fs,note)=>'<div class="av-sec"><h3>'+t+'</h3>'+(note?'<p class="muted small" style="margin:0 0 8px">'+note+'</p>':"")+'<div class="mgrid">'+fs.map(inp).join("")+'</div></div>';
  // Quem não tem o aparelho não precisa ver o campo. Se já houver valor, ele continua aberto.
  const temValor=fs=>fs.some(f=>String(v[f.k]||"").trim());
  const opc=(t,fs,note)=>'<details class="av-opc"'+(temValor(fs)?" open":"")+'><summary>'+t+'</summary>'+sec("",fs,note).replace("<h3></h3>","")+'</details>';
  const faltaPerfil=Body.calc({},S.aluno||{})._faltaPerfil;
  el.innerHTML='<div class="av-top"><div><h2>'+(E.linha?"Editar avaliação":"Nova avaliação")+'</h2><span class="muted small">Toque num ponto do corpo para ir direto à medida. Deixe em branco o que não mediu.</span></div>'+
    '<div class="row-btns"><button class="btn ghost" id="av-cancel">Cancelar</button><button class="btn primary" id="av-save">Salvar avaliação</button></div></div>'+
    '<p class="setup-msg" id="av-msg" role="status"></p>'+
    '<div class="av-grid"><div class="card body-card"><div class="body-wrap" id="body">'+Body.svg(v,S.avPt)+'</div>'+
    '<div class="body-legend"><span><i style="background:var(--good)"></i>preenchido</span><span><i style="background:var(--action)"></i>medida (fita)</span><span><i style="background:#eda100"></i>dobra</span></div></div>'+
    '<div><div class="av-sec"><h3>Data</h3><div class="mgrid"><div class="mfield"><label for="av-data">Data da avaliação</label><input id="av-data" type="date" value="'+esc(brToIso(v["Data"]))+'"></div></div></div>'+
    sec("Geral",Body.GERAL.filter(f=>f.k!=="Pressão arterial"||temValor([f])))+'<div class="calc" id="av-calc" style="margin-bottom:6px"></div><div id="av-calc-nota"></div>'+
    sec("Perímetros (fita, cm)",Body.PER,"Para aproximar a gordura, meça pescoço, cintura e abdômen. Na mulher, meça também o quadril."+(faltaPerfil?" <b>Para o cálculo, preencha data de nascimento e sexo no Perfil do aluno.</b>":""))+
    opc("Bioimpedância (opcional)",Body.BIO,"Se usar balança ou aparelho de bioimpedância, digite o que ele mostrar.")+
    opc("Dobras cutâneas (opcional, adipômetro)",Body.DOB,"Com as 7 dobras o app calcula o % de gordura (Jackson & Pollock). Com 3 dobras também funciona.")+
    '<div class="av-sec"><h3>Observações</h3><textarea class="obs" id="av-obs" style="height:80px;padding:8px 10px;width:100%" placeholder="Postura, lesões, objetivos para o próximo bimestre…">'+esc(v[Body.OBS]||"")+'</textarea></div>'+
    '</div></div>';
  const upCalc=()=>{const d=parseDate(v["Data"])||new Date();const c=Body.calc(v,S.aluno||{},d);
    const k=(l,key,u)=>isFinite(c[key])?'<div class="kpi"><span class="l">'+l+'</span><span class="v">'+(key==="RCQ"?nf2:nf1).format(c[key])+(u?'<small>'+u+'</small>':"")+'</span></div>':"";
    $("#av-calc-nota").innerHTML=notaGordura(c);
    $("#av-calc").innerHTML=k("IMC","IMC","")+k(c._estimado?"% Gordura (aprox.)":"% Gordura","% Gordura","%")+k("Massa magra","Massa magra (kg)","kg")+k("Massa gorda","Massa gorda (kg)","kg")+k("Cintura/quadril","RCQ","");};
  el.querySelectorAll("input[data-k]").forEach(i=>i.addEventListener("input",()=>{v[i.dataset.k]=i.value;upCalc();
    const p=Body.POINTS.find(p=>p.keys.includes(i.dataset.k));if(p){$("#body").innerHTML=Body.svg(v,S.avPt);bindBody(true)}}));
  $("#av-data").addEventListener("input",e=>{v["Data"]=isoToBr(e.target.value);upCalc()});
  $("#av-obs").addEventListener("input",e=>{v[Body.OBS]=e.target.value});
  $("#av-cancel").onclick=()=>{S.avEdit=null;S.avPt=null;renderAval()};
  $("#av-save").onclick=saveAval;
  bindBody(true);upCalc();
}
async function saveAval(){
  const E=S.avEdit;const v=E.v;const msg=$("#av-msg");const btn=$("#av-save");
  if(!parseDate(v["Data"])){msg.textContent="Escolha a data da avaliação.";msg.className="setup-msg bad";return}
  const valores={"Data":v["Data"]};
  Body.FIELDS.forEach(f=>{const s=String(v[f.k]==null?"":v[f.k]).trim();if(!s){if(E.linha)valores[f.k]="";return}
    const n=Body.num(s);valores[f.k]=f.text||!isFinite(n)?s:n});
  const c=Body.calc(v,S.aluno||{},parseDate(v["Data"]));
  Body.CALC.forEach(k=>{if(isFinite(c[k]))valores[k]=c[k];else if(E.linha)valores[k]=""});
  valores[Body.OBS]=String(v[Body.OBS]||"").trim();
  const filled=Body.FIELDS.some(f=>String(v[f.k]||"").trim());
  if(!filled){msg.textContent="Preencha pelo menos uma medida.";msg.className="setup-msg bad";return}
  if(!navigator.onLine){msg.textContent="Sem internet. A avaliação continua aqui; salve quando a conexão voltar.";msg.className="setup-msg bad";return}
  btn.disabled=true;msg.textContent="Salvando…";msg.className="setup-msg";
  try{
    await callA("avaliacao",{valores,linha:E.linha});
    S.avEdit=null;S.avPt=null;S.avSel=null;S.painelAt=0;toast("Avaliação salva na planilha do aluno");
    await fetchDados();render();
    const av=$("#aval");if(av&&S.aluno){av.insertAdjacentHTML("afterbegin",nivelHtml(S.aluno));ligarNivel(av,()=>{const b=$("#nv-box");if(b)b.innerHTML='<p class="muted small">Nível de '+esc(String(S.aluno.nome||"").split(" ")[0])+': <b>'+esc(S.aluno.nivel)+'</b>.</p><button class="btn primary" id="nv-montar">Montar treinos</button>';const m=$("#nv-montar");if(m)m.onclick=()=>openModelEditor(S.alunoId)})}
  }catch(e){
    msg.textContent=errText(e)+(e.sent?" Confira a aba Avaliações antes de salvar de novo.":"");msg.className="setup-msg bad";btn.disabled=false;
  }
}

/* ========== ALUNOS (professor) ========== */
function waLink(a){
  const digits=String(a.telefone||"").replace(/\D/g,"");
  const tel=digits.length>=10&&digits.length<=11?"55"+digits:digits;
  const msg="Olá, "+String(a.nome||"").split(" ")[0]+"! Este é o seu acesso ao Diário de Treino:\n"+a.link+
    "\n\nAbra no celular e toque em \"Instalar app\" (no iPhone: Compartilhar → Adicionar à Tela de Início). Não compartilhe este link.";
  return "https://wa.me/"+(tel||"")+"?text="+encodeURIComponent(msg);
}
function shareBox(a){
  if(!a.link)return '<p class="muted small">O link aparece quando o endereço do programa central estiver definido.</p>';
  return '<div class="sheet-card" style="max-width:none;margin:12px 0"><h3>Acesso de '+esc(a.nome)+'</h3>'+
    '<p class="muted small">Envie este link para o aluno. Ele é o login dele: quem tiver o link entra como ele. <b>Não abra este link no seu celular</b>: você continua usando o seu link de professor.</p>'+
    '<div class="linkbox">'+esc(a.link)+'</div>'+
    '<div class="row-btns"><a class="btn wa" href="'+esc(waLink(a))+'" target="_blank" rel="noopener">Enviar pelo WhatsApp</a><button class="btn" data-copy="'+esc(a.link)+'">Copiar link</button></div></div>';
}
function bindCopy(root){root.querySelectorAll("[data-copy]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast("Link copiado")}catch(e){prompt("Copie o link:",b.dataset.copy)}})}
// Só o Chrome do Android abre a lista de contatos. Nos outros celulares o botão não aparece.
const temContatos=()=>"contacts" in navigator&&"ContactsManager" in window;
function telContato(tels){
  const l=(tels||[]).map(t=>{let d=String(t).replace(/\D/g,"").replace(/^0+/,"");if(d.length>=12&&d.startsWith("55"))d=d.slice(2);return d}).filter(Boolean);
  return l.find(d=>d.length===11)||l[0]||"";
}
function renderAlunoForm(el){
  const f=S.alunoForm;const novo=!f.id;
  const i=(k,l,type,extra)=>'<label class="fld2">'+l+'<input data-k="'+k+'" type="'+(type||"text")+'" value="'+esc(type==="date"?brToIso(f[k]):f[k]||"")+'" '+(extra||"")+'></label>';
  el.innerHTML='<div class="session-head"><div><h2>'+(novo?"Novo aluno":"Editar "+esc(f.nome))+'</h2>'+(novo?'<div class="muted small">O app cria uma planilha só deste aluno no seu Drive e gera o link de acesso dele.</div>':"")+'</div></div>'+
    '<div class="card"><div class="form-grid">'+i("nome","Nome completo *","text",'autocomplete="off"')+(temContatos()?'<button type="button" class="btn small af-contato" id="af-contato">Pegar dos contatos do celular</button>':"")+i("telefone","WhatsApp (com DDD)","tel",'placeholder="11 99999-9999"')+'</div>'+
    (novo?'<p class="muted small" style="margin:10px 0 0">O resto do cadastro (idade, altura, objetivo, restrições) <b>o aluno preenche</b> quando abrir o link pela primeira vez. Você recebe o aviso aqui no app.</p>':"")+
    (novo?'<details style="margin-top:12px"><summary class="small">Preencher mais dados agora (opcional)</summary>':"")+
    '<div class="form-grid" style="margin-top:12px">'+i("nasc","Data de nascimento","date")+
    '<label class="fld2">Sexo<select data-k="sexo"><option value=""></option>'+["Masculino","Feminino"].map(s=>'<option'+(f.sexo===s?" selected":"")+'>'+s+'</option>').join("")+'</select></label>'+
    i("altura","Altura (cm)","text",'inputmode="decimal" placeholder="ex.: 172"')+i("peso","Peso (kg)","text",'inputmode="decimal"')+
    i("objetivo","Objetivo","text",'placeholder="Hipertrofia, emagrecimento…"')+i("dias","Dias por semana","text",'inputmode="numeric"')+i("email","E-mail","email")+'</div>'+
    '<label class="fld2" style="margin-top:12px">Observações (lesões, restrições…)<textarea data-k="obs">'+esc(f.obs||"")+'</textarea></label>'+
    (novo?'</details>':"")+
    (novo?'<details style="margin-top:12px"><summary class="small">Este aluno já tem uma planilha de treinos? (ex.: você mesmo)</summary><label class="fld2" style="margin-top:8px">Link da planilha existente<input data-k="planilhaExistente" placeholder="https://docs.google.com/spreadsheets/d/…" value="'+esc(f.planilhaExistente||"")+'"></label><p class="muted small">O app passa a usar essa planilha em vez de criar uma nova. Os treinos antigos continuam lá.</p></details>'
      :'<label class="show-key" style="margin-top:12px"><input type="checkbox" data-k="ativo"'+(f.ativo!==false?" checked":"")+'> Acesso ativo (desmarque para pausar o link do aluno)</label>')+
    '<p class="setup-msg" id="af-msg" role="status"></p>'+
    '<div class="setup-row"><button class="btn ghost" id="af-cancel">Cancelar</button><button class="btn primary" id="af-save">'+(novo?"Criar aluno e planilha":"Salvar")+'</button></div></div>';
  el.querySelectorAll("[data-k]").forEach(x=>x.addEventListener(x.tagName==="SELECT"||x.type==="checkbox"?"change":"input",()=>{
    f[x.dataset.k]=x.type==="checkbox"?x.checked:x.type==="date"?isoToBr(x.value):x.value}));
  const ct=$("#af-contato");if(ct)ct.onclick=async()=>{
    try{const c=(await navigator.contacts.select(["name","tel"],{multiple:false}))[0];if(!c)return;
      const nm=(c.name||[])[0],tel=telContato(c.tel);
      if(nm&&!String(f.nome||"").trim()){f.nome=nm;el.querySelector('[data-k="nome"]').value=nm}
      if(tel){f.telefone=tel;el.querySelector('[data-k="telefone"]').value=tel}else toast("Esse contato não tem telefone.");
    }catch(x){toast("Não consegui abrir os contatos. Digite o número.")}};
  $("#af-cancel").onclick=()=>{const back=!novo;S.alunoForm=null;back?setView("perfil"):renderAlunos()};
  $("#af-save").onclick=async()=>{
    const msg=$("#af-msg"),btn=$("#af-save");
    if(!String(f.nome||"").trim()){msg.textContent="Escreva o nome do aluno.";msg.className="setup-msg bad";return}
    if(!navigator.onLine){msg.textContent="Sem internet.";msg.className="setup-msg bad";return}
    btn.disabled=true;msg.className="setup-msg";msg.textContent=novo?"Criando a planilha do aluno… (leva alguns segundos)":"Salvando…";
    try{
      const d=Object.assign({},f);
      const r=await Api.call("salvarAluno",{dados:d});
      const a=r.aluno;const i=S.alunos.findIndex(x=>x.id===a.id);if(i>=0)S.alunos[i]=a;else S.alunos.push(a);
      S.alunoForm=null;
      if(S.alunoId===a.id){S.aluno=Object.assign({},S.aluno,a);updateWho()}
      if(novo){S.shareFor=a;toast("Aluno criado com planilha própria");renderAlunos();window.scrollTo({top:0})}
      else{toast("Dados salvos");setView("perfil")}
      Api.call("inicio").then(d=>Api.cacheSet("inicio",d)).catch(()=>{});
    }catch(e){msg.textContent=errText(e);msg.className="setup-msg bad";btn.disabled=false}
  };
}

/* ========== CADASTRO DO ALUNO (primeira vez) ========== */
const OBJETIVOS=["Hipertrofia (ganhar massa)","Emagrecimento","Condicionamento e saúde","Força","Outro"];
/* Aceite dos termos: aparece uma vez para o aluno, ao abrir o link. Só depois ele usa o app. */
function showAceite(){
  const el=$("#cadastro");if(!el.hidden&&$("#ace-form"))return;
  el.innerHTML='<form class="sheet-card" id="ace-form" novalidate><h2>Antes de começar</h2>'+
    '<p>Seus treinos e avaliações, inclusive dados de saúde, ficam na planilha do seu professor, que usa essas informações para acompanhar você.</p>'+
    '<p>Para escrever o parecer do coach, os números e comentários dos treinos vão para um serviço de inteligência artificial (Cloudflare), sem o seu nome, WhatsApp ou e-mail.</p>'+
    '<label class="ace-ok"><input type="checkbox" id="ace-chk"><span>Li e aceito a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a> e os <a href="termos.html" target="_blank" rel="noopener">Termos de Uso</a>.</span></label>'+
    '<p class="muted small">Se não concordar, fale com o seu professor antes de usar o app.</p><p class="setup-msg" id="ace-msg" role="status"></p>'+
    '<div class="setup-row"><button class="btn primary" id="ace-go" type="submit">Aceitar e continuar</button></div></form>';
  el.hidden=false;
  $("#ace-form").onsubmit=async e=>{
    e.preventDefault();const m=$("#ace-msg");
    if(!$("#ace-chk").checked){m.textContent="Marque a caixa para continuar.";m.className="setup-msg bad";return}
    const b=$("#ace-go");b.disabled=true;b.textContent="Salvando…";
    try{
      const r=await Api.call("aceitar");S.aluno=r.aluno;el.hidden=true;el.innerHTML="";
      Api.cacheSet("inicio",Object.assign({},Api.cacheGet("inicio")||{},{aluno:r.aluno}));
      if(r.aluno.cadastroPendente)showCadastro();render();
    }catch(x){m.textContent=errText(x);m.className="setup-msg bad";b.disabled=false;b.textContent="Aceitar e continuar"}
  };
}
function showCadastro(){
  const el=$("#cadastro");if(!el.hidden)return;
  const a=S.aluno||{};const f={nasc:a.nasc||"",sexo:a.sexo||"",altura:a.altura||"",peso:a.peso||"",objetivo:a.objetivo||"",dias:a.dias||"",obs:a.obs||"",email:a.email||""};
  el.innerHTML='<form class="sheet-card" id="cad-form" novalidate><h2>Olá, '+esc(String(a.nome||"").split(" ")[0])+'!</h2>'+
    '<p>Antes de começar, complete seu cadastro. Seu professor usa essas informações para montar o seu treino.</p>'+
    '<div class="form-grid">'+
    '<label class="fld2">Data de nascimento *<input type="date" data-k="nasc" value="'+esc(brToIso(f.nasc))+'"></label>'+
    '<label class="fld2">Sexo *<select data-k="sexo"><option value=""></option>'+["Feminino","Masculino"].map(s=>'<option'+(f.sexo===s?" selected":"")+'>'+s+'</option>').join("")+'</select></label>'+
    '<label class="fld2">Altura (cm) *<input data-k="altura" inputmode="numeric" placeholder="ex.: 165" value="'+esc(f.altura)+'"></label>'+
    '<label class="fld2">Peso (kg)<input data-k="peso" inputmode="decimal" placeholder="ex.: 62,5" value="'+esc(f.peso)+'"></label>'+
    '<label class="fld2">Objetivo<select data-k="objetivo"><option value=""></option>'+OBJETIVOS.map(s=>'<option'+(f.objetivo===s?" selected":"")+'>'+s+'</option>').join("")+'</select></label>'+
    '<label class="fld2">Dias por semana para treinar<select data-k="dias"><option value=""></option>'+[1,2,3,4,5,6,7].map(n=>'<option'+(String(f.dias)===String(n)?" selected":"")+'>'+n+'</option>').join("")+'</select></label>'+
    '</div>'+
    '<label class="fld2">Lesões, dores ou restrições<textarea data-k="obs" placeholder="Ex.: dor no joelho direito, hérnia, nenhuma">'+esc(f.obs)+'</textarea></label>'+
    '<label class="fld2">E-mail (opcional)<input type="email" data-k="email" value="'+esc(f.email)+'"></label>'+
    '<p class="setup-msg" id="cad-msg" role="status"></p>'+
    '<div class="setup-row"><button class="btn primary" id="cad-save">Enviar cadastro</button></div></form>';
  el.hidden=false;
  el.querySelectorAll("[data-k]").forEach(x=>x.addEventListener(x.tagName==="SELECT"?"change":"input",()=>{f[x.dataset.k]=x.type==="date"?isoToBr(x.value):x.value}));
  $("#cad-form").addEventListener("submit",async ev=>{
    ev.preventDefault();const msg=$("#cad-msg"),btn=$("#cad-save");
    let alt=Body.num(f.altura);if(alt>0&&alt<3){alt=Math.round(alt*100);f.altura=String(alt)}
    if(!parseDate(f.nasc)||!f.sexo||!(alt>100&&alt<250)){msg.textContent="Preencha data de nascimento, sexo e altura em centímetros (ex.: 165).";msg.className="setup-msg bad";return}
    if(!navigator.onLine){msg.textContent="Sem internet. Tente de novo quando a conexão voltar.";msg.className="setup-msg bad";return}
    btn.disabled=true;msg.className="setup-msg";msg.textContent="Enviando…";
    try{
      const r=await Api.call("meuCadastro",{dados:f});
      S.aluno=r.aluno;Api.cacheSet("inicio",{papel:"aluno",aluno:r.aluno});
      el.hidden=true;updateWho();toast("Cadastro enviado! Seu professor vai montar o seu treino.");render();
    }catch(e){msg.textContent=errText(e);msg.className="setup-msg bad";btn.disabled=false}
  });
}

/* ========== AVISOS PARA O PROFESSOR ========== */
const statusPill=a=>a.status==="montar treino"?'<span class="pill warn">cadastro feito: montar treino</span>':a.status==="aguardando cadastro"?'<span class="pill">aguardando cadastro do aluno</span>':"";
function profNotice(){
  const pend=S.alunos.filter(a=>a.ativo&&a.status==="montar treino");
  if(!pend.length||$("#banner").innerHTML)return;
  banner('<p><b>'+pend.map(a=>esc(String(a.nome).split(" ")[0])).join(", ")+'</b> '+(pend.length>1?"completaram":"completou")+' o cadastro. Falta montar o treino e cadastrar o plano.</p><button class="btn" id="b-montar">Montar agora</button>'+(S.fin&&S.fin.ativo?'<button class="btn ghost" id="b-plano">Cadastrar plano</button>':""));
  $("#b-montar").onclick=()=>{banner("");openModelEditor(pend[0].id)};
  const bp=$("#b-plano");if(bp)bp.onclick=()=>{banner("");S.finAluno=pend[0].id;S.finDe="";S.finEdit=false;S.finPag=false;S.ctxAluno=false;abrir("fin")};
}

/* ========== MONTAR TREINOS (professor) ========== */
function openModelEditor(alunoId){
  if(alunoId&&alunoId!==S.alunoId)selectAluno(alunoId,true);
  S.cmNota="";S.cmPedido="";
  S.modEdit="carregando";setView("lancar");
  const go=()=>{S.modEdit=[...S.models.entries()].map(([nome,itens])=>({nome,itens:itens.map(it=>({ex:it.ex,series:it.series,metas:it.metas.filter(Boolean).join("; "),peso:it.pesos.filter(Boolean).join("; ")}))}));
    if(!S.modEdit.length&&!(S.aluno&&S.aluno.metodo))S.modEdit=[{nome:"Treino A",itens:[novoItem()]}];render()};
  if(S.loaded)go();else{const t=setInterval(()=>{if(S.loaded){clearInterval(t);go()}},300);setTimeout(()=>clearInterval(t),30000)}
}
const novoItem=()=>({ex:"",series:3,metas:"12",peso:"",novo:true});
const itemGrupo=it=>it.grupo||S.exMap.get(strip(it.ex))||(String(it.ex||"").trim()?guessGroup(it.ex):"Sem grupo");
// Um dia já treinado vira lista de exercícios do treino padrão (séries, metas e peso daquele dia).
function itensDaSessao(ses){
  const ordem=[],por=new Map();
  ses.rows.forEach(r=>{if(!r.ex)return;if(!por.has(r.ex)){por.set(r.ex,[]);ordem.push(r.ex)}por.get(r.ex).push(r)});
  return ordem.map(ex=>{const rs=por.get(ex);const metas=rs.map(r=>String(r.meta||"").trim());
    return {ex,series:rs.length,metas:metas.every(m=>m===metas[0])?metas[0]:metas.join("; "),peso:String(rs[0].peso||"").trim()}});
}
function renderModelEditor(el){
  if(S.modEdit==="carregando"){el.innerHTML='<div class="empty">Lendo a planilha do aluno…</div>';return}
  const M=S.modEdit;const a=S.aluno||{};
  const sessOpts=sessions().filter(x=>x.rows.length).slice(-40).reverse().map(x=>'<option value="'+esc(x.key)+'">'+esc(fmtShort(x.date)+" · "+x.treino+" ("+(n=>n+(n===1?" exercício":" exercícios"))(new Set(x.rows.map(r=>r.ex)).size)+")")+'</option>').join("");
  const seen=new Set();const names=(S.catalogo||[]).map(r=>r[0]).concat(S.exList||[],S.rows.map(r=>r.ex),window.Metodos?Metodos.bibNomes():[]).filter(n=>{const k=strip(n);if(!k||seen.has(k))return false;seen.add(k);return true}).sort((x,y)=>x.localeCompare(y,"pt-BR"));
  el.innerHTML='<div class="session-head"><div><h2>Treinos de '+esc(String(a.nome||"").split(" ")[0])+'</h2><div class="muted small">'+
    [a.objetivo,a.dias?a.dias+"x por semana":"",a.obs?"Restrições: "+a.obs:""].filter(Boolean).map(esc).join(" · ")+'</div></div>'+
    '<div class="row-btns"><button class="btn ghost" id="mt-cancel">Cancelar</button><button class="btn primary" id="mt-save">Salvar treinos</button></div></div>'+
    '<p class="setup-msg" id="mt-msg" role="status"></p>'+
    comecarHtml(a)+metodoCard(a)+metodosProntosHtml(a)+'<div id="jt-box"></div>'+
    '<div class="par-h">Treinos padrão (aba Modelos)</div>'+
    '<p class="muted small" style="margin:0 0 10px">Estes são os <b>treinos padrão</b>. Ao escolher um treino, o app monta sempre a partir daqui (não do último dia). Do último dia ele só mostra o que foi feito e o peso usado.</p>'+
    M.map((t,ti)=>'<div class="mt" data-t="'+ti+'"><div class="mt-h"><input data-f="nome" value="'+esc(t.nome)+'" placeholder="Nome do treino (ex.: Treino A — Pernas)" aria-label="Nome do treino">'+
      '<button class="btn ghost small" data-act="rm-t">Remover</button></div>'+
      '<div class="mt-copy"><select data-act="copiar" aria-label="Copiar exercícios de um dia já treinado"><option value="">Copiar exercícios de um dia já treinado…</option>'+sessOpts+'</select></div>'+
      t.itens.map((it,ii)=>'<div class="mt-row" data-i="'+ii+'"><div class="ex-in"><input data-f="ex" list="mt-list" value="'+esc(it.ex)+'" placeholder="Exercício (busque pelo nome)" aria-label="Exercício">'+
        '<div class="mt-acts"><button data-act="up" aria-label="Subir">↑</button><button data-act="down" aria-label="Descer">↓</button><button data-act="ins" aria-label="Incluir exercício abaixo" title="Incluir exercício abaixo">+</button><button data-act="rm" aria-label="Remover exercício">✕</button></div></div>'+
        '<div class="mt-nums"><label>Séries<input data-f="series" inputmode="numeric" value="'+esc(it.series)+'"></label>'+
        '<label>Reps meta<input data-f="metas" value="'+esc(it.metas)+'" placeholder="12 ou 15; 12; 10"></label>'+
        '<label>Peso inicial<input data-f="peso" value="'+esc(it.peso)+'" placeholder="ex.: 10 kg"></label>'+
        '<label class="g">Grupo muscular'+grupoSelect(itemGrupo(it),'data-f2="grupo"')+'</label></div>'+(it.ult?'<div class="ult-vez small muted">'+esc(it.ult)+'</div>':"")+'</div>').join("")+
      '<div class="mt-f"><button class="btn" data-act="add">+ Exercício</button></div></div>').join("")+
    '<div class="row-btns" style="margin-bottom:12px"><button class="btn" id="mt-addt">+ Novo treino</button>'+
    '<select id="mt-plano" class="mt-plano" aria-label="Acrescentar plano pronto"><option value="">Acrescentar plano pronto…</option>'+(window.Metodos?Metodos.planos():[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nome+" ("+p.dias+")")+'</option>').join("")+'</select></div>'+
    '<p class="note">Reps meta diferentes por série: separe com ponto e vírgula (15; 12; 10). Peso inicial vale até o aluno fazer o exercício a primeira vez; depois o app sugere o último peso usado.</p>'+
    '<datalist id="mt-list">'+names.map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>';
  ligarComecar(el,a,M);ligarMetodosProntos(el,a,M);pintarJeito();
  el.querySelectorAll(".mt").forEach(card=>{
    const ti=+card.dataset.t;const t=M[ti];
    card.querySelector('[data-f="nome"]').addEventListener("input",e=>{t.nome=e.target.value});
    card.querySelector('[data-act="copiar"]').onchange=e=>{const ses=sessions().find(x=>x.key===e.target.value);if(!ses)return;
      t.itens=itensDaSessao(ses);if(!String(t.nome||"").trim()||/^Treino [A-Z]$/.test(t.nome))t.nome=ses.treino;render();
      toast("Copiei "+t.itens.length+" exercícios de "+fmtShort(ses.date)+". Ajuste e toque em Salvar treinos.")};
    card.querySelector('[data-act="rm-t"]').onclick=e=>armed(e.target,"Toque de novo para remover","Remover",()=>{M.splice(ti,1);render()});
    card.querySelector('[data-act="add"]').onclick=()=>{t.itens.push(novoItem());render();const r=$('.mt[data-t="'+ti+'"] .mt-row:last-of-type [data-f="ex"]');if(r)r.focus()};
    card.querySelectorAll(".mt-row").forEach(row=>{
      const ii=+row.dataset.i;const it=t.itens[ii];
      const gsel=row.querySelector('[data-f2="grupo"]');
      row.querySelectorAll("[data-f]").forEach(inp=>inp.addEventListener("input",()=>{it[inp.dataset.f]=inp.value;
        if(inp.dataset.f==="ex"&&!it.grupoManual){const g=itemGrupo(it);if(![...gsel.options].some(o=>o.value===g))gsel.add(new Option(g,g));gsel.value=g}}));
      gsel.onchange=()=>{it.grupo=gsel.value;it.grupoManual=true};
      row.querySelector('[data-f="ex"]').addEventListener("change",()=>{if(!it.novo)return;const u=ultimaVez(it.ex);if(!u){it.ult="";return}
        it.series=u.series;it.metas=u.metas;it.peso=u.peso;it.ult=u.txt;render()});
      row.querySelector('[data-act="ins"]').onclick=()=>{t.itens.splice(ii+1,0,novoItem());render();const r=$('.mt[data-t="'+ti+'"] .mt-row[data-i="'+(ii+1)+'"] [data-f="ex"]');if(r)r.focus()};
      row.querySelector('[data-act="rm"]').onclick=()=>{t.itens.splice(ii,1);render()};
      row.querySelector('[data-act="up"]').onclick=()=>{if(ii>0){t.itens.splice(ii-1,0,t.itens.splice(ii,1)[0]);render()}};
      row.querySelector('[data-act="down"]').onclick=()=>{if(ii<t.itens.length-1){t.itens.splice(ii+1,0,t.itens.splice(ii,1)[0]);render()}};
    });
  });
  bindMetodoCard();
  $("#mt-plano").onchange=e=>{const p=Metodos.planos().find(x=>x.id===e.target.value);if(!p)return;
    p.treinos.forEach(t=>M.push({nome:t.nome,itens:t.exercicios.map(([ex,series,metas])=>({ex,series,metas:String(metas),peso:""}))}));
    render();toast("Plano "+p.nome+" acrescentado. Ajuste e toque em Salvar treinos.")};
  $("#mt-addt").onclick=()=>{M.push({nome:"Treino "+String.fromCharCode(65+M.length),itens:[novoItem()]});render();window.scrollTo({top:document.body.scrollHeight})};
  $("#mt-cancel").onclick=()=>{S.modEdit=null;render()};
  $("#mt-save").onclick=saveModels;
}
/* Ligar um método (arquivo em metodos/) no aluno, com data de início. */
function proximaSegunda(){const d=new Date();const k=(8-d.getDay())%7;d.setDate(d.getDate()+(d.getDay()===1?0:k));return d}
function metodoCard(a){
  const ms=window.Metodos?Metodos.todos():[];
  const atual=a.metodo&&window.Metodos?Metodos.get(a.metodo):null;
  const F=atual?Metodos.fase(atual,a.metodoInicio,new Date()):null;
  return '<div class="card" style="margin-bottom:12px"><h3>Método de treino</h3>'+
    (atual?'<p class="small" style="margin:6px 0">Ligado: <b>'+esc(atual.nome)+'</b> desde '+esc(a.metodoInicio)+' · '+esc(faseTexto(F))+'</p>':'<p class="muted small" style="margin:6px 0">Ligue um método e o app monta os treinos, as fases e a progressão sozinho.</p>')+
    '<div class="form-grid"><label class="fld2">Método<select id="me-m"><option value="">Nenhum</option>'+ms.map(m=>'<option value="'+esc(m.id)+'"'+(a.metodo===m.id?" selected":"")+'>'+esc(m.nome)+' ('+esc(m.publico||"")+')</option>').join("")+'</select></label>'+
    '<label class="fld2">Começa em<input id="me-d" type="date" value="'+esc(brToIso(a.metodoInicio)||brToIso(fmtDate(proximaSegunda())))+'"></label></div>'+
    '<p class="setup-msg" id="me-msg" role="status"></p><div class="row-btns"><button class="btn" id="me-save">'+(atual?"Atualizar método":"Ligar método")+'</button></div></div>';
}
function bindMetodoCard(){
  const b=$("#me-save");if(!b)return;
  b.onclick=async()=>{
    const metodo=$("#me-m").value,inicio=isoToBr($("#me-d").value),msg=$("#me-msg");
    if(metodo&&!inicio){msg.textContent="Escolha a data de início.";msg.className="setup-msg bad";return}
    b.disabled=true;msg.className="setup-msg";msg.textContent="Salvando…";
    try{
      const r=await callA("aplicarMetodo",{metodo,inicio});
      S.aluno=Object.assign({},S.aluno,r.aluno);const i=S.alunos.findIndex(x=>x.id===r.aluno.id);if(i>=0)S.alunos[i]=r.aluno;
      toast(metodo?"Método ligado. Já aparece no app do aluno.":"Método desligado.");profNotice();
      Api.call("inicio").then(d=>Api.cacheSet("inicio",d)).catch(()=>{});
      if(!S.models.size&&metodo){S.modEdit=null}render();
    }catch(e){msg.textContent=errText(e);msg.className="setup-msg bad";b.disabled=false}
  };
}
async function saveModels(){
  const M=S.modEdit;const msg=$("#mt-msg"),btn=$("#mt-save");
  const bad=t=>{msg.textContent=t;msg.className="setup-msg bad";window.scrollTo({top:0})};
  const linhas=[];const nomes=new Set();
  for(const t of M){
    const nome=String(t.nome||"").trim();const itens=t.itens.filter(it=>String(it.ex||"").trim());
    if(!itens.length)continue;
    if(!nome)return bad("Dê um nome para cada treino.");
    if(nomes.has(strip(nome)))return bad("Há dois treinos com o nome \""+nome+"\". Use nomes diferentes.");
    nomes.add(strip(nome));
    for(const it of itens){
      const n=parseInt(it.series,10);if(!(n>=1&&n<=20))return bad("Séries de \""+it.ex+"\" precisa ser um número de 1 a 20.");
      linhas.push([nome,String(it.ex).trim(),String(n),String(it.metas||"").trim(),String(it.peso||"").trim()]);
    }
  }
  const known=new Set((S.catalogo||[]).map(r=>strip(r[0])).concat([...S.exMap.keys()]));
  const itensTodos=M.flatMap(t=>t.itens).filter(it=>String(it.ex||"").trim());
  const grupoDe=n=>{const it=itensTodos.find(x=>strip(x.ex)===strip(n));return it?itemGrupo(it):guessGroup(n)};
  const novos=[];linhas.forEach(r=>{const k=strip(r[1]);if(!known.has(k)){known.add(k);novos.push([r[1],grupoDe(r[1])])}});
  const grupos=[];itensTodos.forEach(it=>{const k=strip(it.ex);if(it.grupoManual&&S.exMap.has(k)&&S.exMap.get(k)!==it.grupo&&!grupos.some(g=>strip(g[0])===k))grupos.push([String(it.ex).trim(),it.grupo])});
  if(!navigator.onLine)return bad("Sem internet. Os treinos continuam aqui; salve quando a conexão voltar.");
  btn.disabled=true;msg.className="setup-msg";msg.textContent="Salvando na planilha do aluno…";
  try{
    await callA("salvarModelos",{linhas,exerciciosNovos:novos,grupos});
    novos.concat(grupos).forEach(x=>S.exMap.set(strip(x[0]),x[1]));
    S.catalogo=(S.catalogo||[]).concat(novos);
    const a=S.alunos.find(x=>x.id===S.alunoId);if(a&&linhas.length)a.status="ok";
    S.modEdit=null;toast(linhas.length?"Treinos salvos. Já aparecem no app do aluno.":"Treinos apagados.");
    profNotice();await fetchDados();render();
    Api.call("inicio").then(d=>Api.cacheSet("inicio",d)).catch(()=>{});
  }catch(e){bad(errText(e)+(e.sent?" Confira a aba Modelos antes de salvar de novo.":""));btn.disabled=false}
}

/* ========== PERFIL ========== */
let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;if(S.view==="perfil")renderPerfil();installBanner()});
const standalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function installHtml(){
  if(standalone())return '<p class="muted small">O app já está instalado neste aparelho.</p>';
  if(installEvt)return '<button class="btn primary" id="p-install">Instalar o app neste celular</button>';
  if(isIOS())return '<p>No iPhone: toque em <b>Compartilhar</b> (o quadrado com a seta, embaixo) e depois em <b>Adicionar à Tela de Início</b>.</p>';
  return '<p>No menu do navegador (⋮), toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>';
}
function installBanner(){
  if(standalone()||store("dt2-install-ok"))return;
  if(!$("#banner").innerHTML&&(installEvt||isIOS())){
    banner('<p>'+(installEvt?'Instale o Diário de Treino para abrir como um app.':'Para instalar: toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>.')+'</p>'+
      (installEvt?'<button class="btn" id="b-inst">Instalar</button>':"")+'<button class="btn ghost" id="b-inst-x">Agora não</button>');
    const i=$("#b-inst");if(i)i.onclick=doInstall;
    $("#b-inst-x").onclick=()=>{store("dt2-install-ok",1);banner("")};
  }
}
async function doInstall(){if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;banner("");render()}
function renderPerfil(){
  const el=$("#perfil");const prof=S.role==="prof";
  let html="";
  if(S.aluno){
    const a=S.aluno;const id=idade(a);
    html+='<div class="card" style="margin-bottom:14px"><div class="perfil-top"><span class="perfil-av">'+Icone("user-circle",32)+'</span><div><h2 style="text-transform:none">'+esc(a.nome)+'</h2>'+(prof&&a.ativo===false?'<span class="pill bad">acesso pausado</span>':"")+'</div></div><dl class="kv">'+
      [["Idade",id!=null?id+" anos":""],["Nascimento",a.nasc],["Sexo",a.sexo],["Altura",a.altura?a.altura+" cm":""],["Peso",a.peso?a.peso+" kg":""],["Objetivo",a.objetivo],["Dias por semana",a.dias],["Restrições",a.obs],
       ["Método",(()=>{const mt=metodoAluno();return mt?mt.m.nome+" · "+faseTexto(mt.F):""})()],
       ...(prof?[["WhatsApp",a.telefone],["E-mail",a.email],["Desde",a.criado]]:[])].filter(x=>x[1]).map(x=>'<dt>'+x[0]+'</dt><dd>'+esc(x[1])+'</dd>').join("")+'</dl>'+
      (prof?'<div class="row-btns" style="margin-top:14px"><button class="btn" id="p-edit">Editar dados</button>'+(a.planilhaUrl?'<a class="btn" href="'+esc(a.planilhaUrl)+'" target="_blank" rel="noopener">Abrir planilha</a>':"")+'</div>':"")+
      '</div>';
    if(prof)html+=relatorioHtml()+nomesHtml();
    if(prof)html+=shareBox(a)+'<div class="card" style="margin-bottom:14px"><h3>Segurança</h3><p class="muted small">Se o link vazar ou o aluno trocar de celular, gere um novo. O link antigo para de funcionar.</p><div class="row-btns"><button class="btn" id="p-newlink">Gerar novo link</button></div></div>';
    if(prof)html+='<div class="card" style="margin-bottom:14px"><h3>Treinos deste aluno</h3><p class="muted small">'+statusPill(a)+' Monte e edite os treinos aqui pelo app (ficam na aba Modelos da planilha do aluno).</p><div class="row-btns"><button class="btn primary" id="p-montar">✎ Montar treinos</button></div></div>';
  }else if(prof){
    html+='<div class="empty" style="margin-bottom:14px">Escolha um aluno em <b>Alunos</b>, na tela inicial, para ver o perfil.</div>';
  }
  html+='<p class="note" style="text-align:center">Instalar o app, atualizar e sair deste aparelho: toque na <b>engrenagem</b>, no topo.</p>';
  el.innerHTML=html;
  if(prof&&S.aluno){ligarRelatorio();ligarNomes()}
  const pm=$("#p-montar");if(pm)pm.onclick=()=>openModelEditor(null);
  const pe=$("#p-edit");if(pe)pe.onclick=()=>{S.alunoForm=Object.assign({},S.aluno);abrir("alunos")};
  const pn=$("#p-newlink");if(pn)pn.onclick=()=>armed(pn,"Toque de novo: o link antigo vai parar","Gerar novo link",async()=>{
    try{const r=await callA("novoCodigo");S.aluno=Object.assign({},S.aluno,r.aluno);const i=S.alunos.findIndex(x=>x.id===r.aluno.id);if(i>=0)S.alunos[i]=r.aluno;toast("Novo link gerado. Envie para o aluno.");renderPerfil()}
    catch(e){toast(errText(e))}});
  bindCopy(el);
}

/* ========== BOTÃO ↻: relê a planilha e, se houver versão nova do app, atualiza ========== */
let atualizando=false;
async function atualizarTudo(comApp){
  if(atualizando)return;
  if(!navigator.onLine){toast("Sem internet. Tente quando a conexão voltar.");return}
  if(S.saving){toast("Espere terminar de salvar o treino.");return}
  atualizando=true;const b=$("#b-refresh");b.classList.add("girando");
  try{
    if(comApp){try{const r=await window.Atualizacao.verificar();if(r.nova){toast("Baixando a versão nova…");await window.Atualizacao.aplicar();return}}catch(e){}}
    await refreshInicio();
    const ok=S.alunoId?await fetchDados():true;
    toast(ok?(comApp?"Tudo atualizado: treinos e aplicativo.":"Treinos atualizados."):"Não consegui atualizar agora.");
  }finally{atualizando=false;b.classList.remove("girando")}
}
$("#b-refresh").onclick=()=>atualizarTudo(true);

/* ========== COACH ========== */
// Monta o resumo do período escolhido e compara com o período anterior de mesmo tamanho.
function resumoCoach(sel){
  const todasLinhas=S.rows;if(S.view==="evo"&&S.evoGrupo)S.rows=S.rows.filter(r=>r.grupo===S.evoGrupo);
  try{return resumoCoachDe(sel)}finally{S.rows=todasLinhas}
}
function resumoCoachDe(sel){
  const hoje=new Date();const amanha=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()+1);
  const dias=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  if(/^\d{4}-\d{2}$/.test(sel))return Coach.mes(S.rows,sel);
  if(sel==="tudo"){const ini=new Date(Math.min(...S.rows.map(r=>+r.date)));return Coach.periodo(S.rows,ini,amanha,null,"Todo o histórico","período anterior")}
  if(sel==="datas"){
    const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
    if(!S.coachDe)S.coachDe=iso(dias(hoje,-30));if(!S.coachAte)S.coachAte=iso(hoje);
    const p=s=>{const [a,m,d]=s.split("-").map(Number);return new Date(a,m-1,d)};
    let ini=p(S.coachDe),ult=p(S.coachAte);if(ult<ini){const t=ini;ini=ult;ult=t}
    const n=Math.round((ult-ini)/864e5)+1;
    return Coach.periodo(S.rows,ini,dias(ult,1),dias(ini,-n),fmtDate(ini)+" a "+fmtDate(ult),"período anterior");
  }
  const n=+sel.slice(1)*7;const ini=dias(amanha,-n);
  return Coach.periodo(S.rows,ini,amanha,dias(ini,-n),"Últimos "+n+" dias","período anterior");
}
/* A IA reescreve o parecer em texto. Sem ela, ou se falhar, fica o parecer por regras. */
const iaLendo=t=>'<div class="ia-lendo" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><div><b>'+esc(t||"O coach está lendo os comentários do treino.")+'</b><div class="muted small">Já volta com a resposta.</div></div></div>';
function pedirParecerIA(key){
  if(!key||S.memoria.has(key)||S.iaTentou.has(key))return;
  const A=Coach.treino(S.rows,key);if(!A)return;
  S.iaTentou.add(key);S.iaPend=S.iaPend||new Set();S.iaPend.add(key);
  const fim=()=>{S.iaPend.delete(key);if(S.view==="coach")renderCoach()};
  const id=S.alunoId;
  callA("coachIA",{key,data:A.dateS,treino:A.treino,fatos:Object.assign(Coach.fatosIA(A),{respostasDoAluno:(S.metasResp||[]).slice(-3).map(r=>({pergunta:r[4],resposta:r[5]}))})}).then(r=>{
    if(S.alunoId!==id||!r||!r.item)return;
    S.memoria.set(key,r.item);
  }).catch(()=>{}).finally(fim);
}
/* Metas com pergunta. A resposta fica na planilha do aluno, e o coach avalia pelo objetivo e pelo jeito do professor. */
const podeResponder=()=>S.role!=="prof"||!!(S.aluno&&S.aluno.master);
function respostaDaMeta(id){const l=(S.metasResp||[]).filter(r=>r[2]===id);return l[l.length-1]||null}
// Comentários dos últimos 30 dias, para o coach fazer a próxima pergunta sobre o que a pessoa viveu.
function comentariosRecentes(){
  const corte=Date.now()-30*864e5,v=[],vis=new Set();
  for(let i=S.rows.length-1;i>=0&&v.length<10;i--){const r=S.rows[i];if(+r.date<corte)break;
    const t=String(r.obs||"").replace(/\[[^\]]*\]/g," ").replace(/\s*·\s*/g," ").replace(/\s+/g," ").trim();
    if(t.length<6||vis.has(t))continue;vis.add(t);v.push(r.ex+": "+t.slice(0,180))}
  return v;
}
function metasHtml(A){
  const qs=A&&A.metasQ||[];if(!qs.length)return "";
  return '<div class="ch-sec foco"><h3>🎯 Metas</h3>'+qs.map(q=>{const r=respostaDaMeta(q.id);const prox=r&&r[7];
    const aberta=podeResponder()&&(!r||!!prox||S.metaAberta===q.id);
    return '<div class="mq" data-q="'+esc(q.id)+'"><p>'+q.txt+'</p><p class="mq-p">'+esc(r?r[4]:q.perg)+'</p>'+
      (r?'<p class="aux-c eu">'+esc(r[5])+'</p>'+(r[6]?'<p class="aux-c ia">'+esc(r[6])+'</p>':'<p class="muted small">Resposta guardada. O coach ainda não comentou.</p>')+
        (prox?'<p class="mq-p mq-nova">Próxima pergunta do coach: '+esc(prox)+'</p>':(podeResponder()&&S.metaAberta!==q.id?'<button class="btn ghost small" data-mq="abrir">Responder de novo</button>':"")):podeResponder()?"":'<p class="muted small">O aluno ainda não respondeu.</p>')+
      (r&&prox&&!podeResponder()?'<p class="muted small">Aguardando a resposta do aluno.</p>':"")+
      (aberta?'<textarea class="obs mq-t" placeholder="Escreva a sua resposta" aria-label="Sua resposta"></textarea><button class="btn small" data-mq="enviar">Responder</button>':"")+'</div>'}).join("")+'</div>';
}
function ligarMetas(el,A){
  el.querySelectorAll(".mq").forEach(box=>{
    const id=box.dataset.q,q=(A.metasQ||[]).find(x=>x.id===id);if(!q)return;
    const ab=box.querySelector('[data-mq="abrir"]');if(ab)ab.onclick=()=>{S.metaAberta=id;renderCoach()};
    const env=box.querySelector('[data-mq="enviar"]');if(!env)return;
    env.onclick=async()=>{const t=box.querySelector(".mq-t").value.trim();if(!t){toast("Escreva a resposta.");return}
      env.disabled=true;env.textContent="O coach está lendo a sua resposta…";env.insertAdjacentHTML("afterend",iaLendo("O coach está lendo a sua resposta."));
      const ult=respostaDaMeta(id);const perg=ult&&ult[7]?ult[7]:q.perg;
      try{const r=await callA("metaResponder",{treino:A.treino,tema:id,meta:q.txt.replace(/<[^>]+>/g,""),pergunta:perg,resposta:t,comentarios:comentariosRecentes()});
        S.metasResp=(S.metasResp||[]).concat([r.linha]);S.metaAberta=null;renderCoach();toast(r.linha[6]?"O coach avaliou e já deixou a próxima pergunta.":"Resposta guardada. Já tem uma próxima pergunta.");
      }catch(x){toast(errText(x));env.disabled=false;env.textContent="Responder"}};
  });
}
/* Relatório do aluno: parecer prévio para o professor, sem gastar a IA ao abrir. */
/* Nomes padronizados: o professor confere caso a caso e aplica. A marca sai do nome e vai para a coluna Máquina. */
function propostasNomes(){
  if(!window.Nomes)return [];const m=new Map();
  const add=n=>{n=String(n||"").replace(/\s+/g," ").trim();if(!n||m.has(n))return;const p=Nomes.padronizar(n);if(p.mudou||p.maquina)m.set(n,p)};
  S.rows.forEach(r=>add(r.ex));[...S.models.values()].forEach(l=>l.forEach(it=>add(it.ex)));
  return [...m].map(([de,p])=>({de,para:p.nome,maq:p.maquina})).sort((a,b)=>a.para.localeCompare(b.para)||a.de.localeCompare(b.de));
}
function nomesHtml(){
  if(!S.loaded)return "";const L=propostasNomes();
  if(!L.length)return '<div class="card" style="margin-bottom:14px"><h3>Nomes dos exercícios</h3><p class="muted small">Todos os nomes já estão no padrão.</p></div>';
  return '<div class="card" style="margin-bottom:14px"><h3>Nomes dos exercícios</h3><p class="small">'+L.length+' nomes podem ficar no padrão. A marca da máquina sai do nome e vai para o campo Máquina, e o coach passa a comparar a carga só na mesma máquina.</p>'+
    (S.nomesAberto?'<ul class="nomes-l">'+L.map((x,i)=>'<li><label><input type="checkbox" data-nm="'+i+'" checked><span><span class="muted">'+esc(x.de)+'</span><br>→ <b>'+esc(x.para)+'</b>'+(x.maq?' · máquina <b>'+esc(x.maq)+'</b>':"")+'</span></label></li>').join("")+'</ul><button class="btn primary" id="nm-ok">Aplicar os marcados</button>':'<button class="btn" id="nm-ver">Ver a lista, caso a caso</button>')+'</div>';
}
function ligarNomes(){
  const v=$("#nm-ver");if(v)v.onclick=()=>{S.nomesAberto=true;renderPerfil()};
  const ok=$("#nm-ok");if(!ok)return;
  ok.onclick=async()=>{const L=propostasNomes();const mapa=[...document.querySelectorAll("[data-nm]")].filter(c=>c.checked).map(c=>{const x=L[+c.dataset.nm];return [x.de,x.para,x.maq]});
    if(!mapa.length){toast("Marque pelo menos um nome.");return}
    ok.disabled=true;ok.textContent="Trocando na planilha…";
    try{const r=await callA("padronizarNomes",{mapa});S.nomesAberto=false;toast("Pronto: "+r.historico+" linhas do histórico e "+r.modelos+" dos treinos com o nome novo.");S.painelAt=0;await fetchDados();renderPerfil()}
    catch(x){toast(errText(x));ok.disabled=false;ok.textContent="Aplicar os marcados"}};
}
function relatorioHtml(){
  if(!S.loaded)return '<div class="card" style="margin-bottom:14px"><h3>Relatório do aluno</h3><p class="muted small">Lendo a planilha…</p></div>';
  const R=Coach.relatorio(S.rows);S.relDados=R;const P=S.relParecer;
  const pill={good:"ok",bad:"bad",flat:""}[R.tom];
  const sec=(t,l)=>l.length?'<div class="par-h">'+t+'</div><ul class="rel-l">'+l.map(x=>'<li>'+x+'</li>').join("")+'</ul>':"";
  const resp=(S.metasResp||[]).slice(-3).reverse().map(r=>"<b>"+esc(r[4])+"</b> “"+esc(String(r[5]).slice(0,160))+"”");
  return '<div class="card aux-b" style="margin-bottom:14px"><h3>Relatório do aluno</h3><p><span class="pill '+pill+'">'+esc(R.veredito)+'</span></p>'+
    '<p class="muted small">Últimas 4 semanas contra as 4 anteriores: '+R.treinos+' treinos (antes '+R.treinosAntes+')'+(R.volumeDif!=null?", volume "+(R.volumeDif>0?"+":"")+R.volumeDif+"%":"")+", "+R.recordes+(R.recordes===1?" recorde":" recordes")+", "+R.metasBatidas+(R.metasBatidas===1?" meta batida":" metas batidas")+'.</p>'+
    (R.nexoUltimo?'<p class="small"><b>Último treino ('+esc(R.ultimoTreino)+'):</b> '+esc(R.nexoUltimo)+'</p>':"")+
    sec("O que o aluno relatou e o efeito no treino",R.fatores.map(f=>f.texto))+
    sec("Dor ou incômodo",R.dores.map(d=>esc(d.parte)+": "+d.treinos+(d.treinos===1?" treino":" treinos")))+
    sec("Pedidos para rever",R.pedidos.map(p=>"<b>"+esc(p.data+" · "+p.exercicio)+":</b> “"+esc(p.texto)+"”"))+
    sec("Respostas às metas",resp)+
    '<p class="muted small">A relação com o treino compara o volume com e sem cada relato. Mostra um sinal, não prova a causa.</p>'+
    '<div class="par-h">Parecer do assistente</div>'+(P&&P.parecer?'<p class="aux-c ia">'+esc(P.parecer)+'</p><p class="muted small">'+esc(P.data||"")+'</p>':'<p class="muted small">Ele junta tudo isso com o objetivo do aluno e o seu jeito de trabalhar.</p>')+
    '<button class="btn" id="rel-ia">'+(P&&P.parecer?"Refazer parecer":"Pedir parecer")+'</button></div>';
}
function ligarRelatorio(){
  if(S.loaded&&S.relParecer==null){S.relParecer={};callA("alunoParecer",{}).then(d=>{if(d.item){S.relParecer=d.item;if(S.view==="perfil")renderPerfil()}}).catch(()=>{})}
  const b=$("#rel-ia");if(!b)return;
  b.onclick=async()=>{b.disabled=true;b.textContent="Lendo os treinos…";b.insertAdjacentHTML("beforebegin",iaLendo("O assistente está lendo os treinos e os comentários do aluno."));
    try{const a=S.aluno||{};const d=await callA("alunoParecer",{gerar:true,fatos:Object.assign({},S.relDados,{fatores:(S.relDados.fatores||[]).map(f=>f.texto.replace(/<[^>]+>/g,"")),respostas:(S.metasResp||[]).slice(-5).map(r=>({meta:r[3],pergunta:r[4],resposta:r[5]})),nivel:a.nivel||""})});
      if(d.item){S.relParecer=d.item;renderPerfil()}else{toast(d.motivo==="limite_do_dia"?"O limite de hoje acabou.":"O assistente não conseguiu agora.");b.disabled=false;b.textContent="Pedir parecer"}
    }catch(x){toast(errText(x));b.disabled=false;b.textContent="Pedir parecer"}};
}
function renderCoach(){
  const naEvo=S.view==="evo";const el=naEvo?$("#evo-geral"):$("#coach");if(!el)return;
  if(needAluno(el))return;
  if(!S.loaded){el.innerHTML='<div class="empty">'+(S.error?"Sem dados da planilha. Veja o aviso acima.":"Lendo a planilha…")+'</div>';return}
  const ses=Coach.sessoes(S.rows).filter(s=>s.rows.some(r=>r.done)).reverse();
  if(!ses.length&&!S.coachEsperando){el.innerHTML='<div class="empty">Faça o primeiro treino. A Avaliação do Coach aparece aqui.</div>';return}
  if(!S.coachEsperando&&(!S.coachSel||!ses.some(s=>s.key===S.coachSel)))S.coachSel=ses[0].key;
  const A=Coach.treino(S.rows,S.coachSel);
  const lista=(t,itens,cls)=>itens.length?'<div class="ch-sec '+(cls||"")+'"><h3>'+t+'</h3><ul>'+itens.map(x=>'<li>'+x+'</li>').join("")+'</ul></div>':"";
  const E=Coach.EMO;
  const difKpi=(v,bomSeMaior,u)=>v==null?"":v===0?'<span class="delta flat">igual</span>':bomSeMaior==null?'<span class="delta flat">'+(v>0?"+":"−")+nf1.format(Math.abs(v))+(u||"")+'</span>':'<span class="delta '+((v>0)===bomSeMaior?"up":"down")+'">'+(v>0?"+":"−")+nf1.format(Math.abs(v))+(u||"")+'</span>';
  const meses=Coach.meses(S.rows);
  const fixos=[["p4","Últimas 4 semanas"],["p12","Últimas 12 semanas"],["p26","Últimos 6 meses"],["tudo","Todo o histórico"],["datas","Escolher datas…"]];
  if(!S.coachMes||!(meses.includes(S.coachMes)||fixos.some(x=>x[0]===S.coachMes)))S.coachMes="p4";
  const M=S.coachMes?resumoCoach(S.coachMes):null;
  const rot=M?M.rotAnt:"";
  const dif=(a,b,u)=>b?(a>=b?'<span class="delta up">▲ ':'<span class="delta down">▼ ')+nf1.format(Math.abs(a-b))+(u||"")+' vs '+rot+'</span>':'<span class="delta flat">sem '+rot+'</span>';
  const G=Coach.academias(M?M.linhas:S.rows);
  const AI=A&&A.animoInfo;const MEM=S.memoria.get(S.coachSel);
  if(!naEvo&&ses.length&&S.coachSel===ses[0].key)pedirParecerIA(S.coachSel);
  const htmlTreino='<div class="ch-bloco"><h2>'+(S.coachSel===(ses[0]&&ses[0].key)?"Último treino":"Treino escolhido")+'</h2><button class="btn ghost small" id="ch-ir">Parecer geral na Evolução →</button></div><div class="card" style="margin-bottom:14px">'+
    '<div class="pick-ex"><select id="ch-ses" aria-label="Escolher treino">'+ses.slice(0,30).map(s=>'<option value="'+esc(s.key)+'"'+(s.key===S.coachSel?" selected":"")+'>'+esc(fmtShort(s.date)+" · "+s.treino)+'</option>').join("")+'</select></div>'+
    (A&&S.iaPend&&S.iaPend.has(S.coachSel)?iaLendo():"")+(A?'<p class="ch-tit">'+esc(MEM&&MEM.titulo||A.titulo)+'</p><p class="ch-texto">'+esc(MEM&&MEM.parecer||A.texto)+'</p>'+
      (A.sequenciaTexto?'<div class="ch-seq">'+esc(A.sequenciaTexto)+'</div>':"")+
      (A.academiaDica?'<div class="ch-seq">'+esc(A.academiaDica)+'</div>':"")+
      (S.role==="aluno"&&S.profWhats&&(A.sequencia||A.abaixo.length||A.comentarios.some(c=>/Dor ou incômodo/.test(c)))?'<a class="btn ch-prof" href="https://wa.me/'+esc(S.profWhats)+'?text='+encodeURIComponent("Professor, queria falar sobre o meu treino.")+'" target="_blank" rel="noopener">Falar com o professor</a>':"")+
      (A.academia?'<p class="muted small" style="margin:0 0 8px">Academia: '+esc(A.academia)+'.</p>':"")+
      (AI?'<div class="ch-animo"><b>Ânimo: '+(AI.ini&&AI.fim?"chegou "+E[AI.ini]+" → saiu "+E[AI.fim]:AI.ini?"chegou "+E[AI.ini]:E[AI.fim])+'</b><br>'+esc(AI.texto)+'</div>':"")+
      (A.comp?'<h3 class="ch-comp">Comparado com '+(A.comp.n===1?"o último treino igual":"os últimos "+A.comp.n+" treinos iguais")+'</h3><div class="gr3" style="margin-bottom:10px">'+
        '<div class="kpi"><span class="l">Volume</span><span class="v">'+nf1.format(A.comp.vol)+'<small>t</small></span>'+difKpi(A.comp.volDif,true,"%")+'</div>'+
        '<div class="kpi"><span class="l">Séries</span><span class="v">'+A.comp.series+'</span>'+difKpi(A.comp.seriesDif,true)+'</div>'+
        (A.comp.tempo?'<div class="kpi"><span class="l">Tempo</span><span class="v">'+esc(fmtMin(A.comp.tempo))+'</span>'+difKpi(A.comp.tempoDif,null," min")+'</div>':"")+'</div>':"")+
      lista("🏆 Melhor do dia",A.bem.slice(0,4),"bem")+lista("⚠️ Merece atenção",A.abaixo.slice(0,4),"mal")+lista("💬 O que você comentou",A.comentarios)+lista("📝 Pedidos para o professor rever",(A.pedidos||[]).map(p=>"<b>"+esc(p.exercicio)+":</b> “"+esc(p.texto.slice(0,140))+"”"))+(A.academiaDif||A.maquinaDif?lista("🏋️ Academia ou máquina diferente",[A.academiaDif].concat(A.maquinaDif||[]).filter(Boolean).map(esc)):"")+(A.nexoTreino?lista("🔗 O que isso teve a ver com o treino",[esc(A.nexoTreino)]):"")+lista("📌 No próximo "+esc(A.treino),A.proximo)
      :iaLendo())+'</div>';
  const htmlGeral='<div class="ch-bloco" id="ch-geral"><h2>Parecer geral até aqui</h2></div>'+
    '<div class="pick-ex evo-filtros"><select id="ch-mes" aria-label="Escolher período">'+fixos.map(x=>'<option value="'+x[0]+'"'+(x[0]===S.coachMes?" selected":"")+'>'+esc(x[1])+'</option>').join("")+'<optgroup label="Mês">'+meses.slice(0,18).map(k=>'<option value="'+k+'"'+(k===S.coachMes?" selected":"")+'>'+esc(Coach.nomeMes(k))+'</option>').join("")+'</optgroup></select>'+
    '<select id="ch-grupo" aria-label="Escolher grupo muscular"><option value="">Todos os grupos</option>'+GROUPS.map(g=>'<option'+(S.evoGrupo===g.k?" selected":"")+'>'+esc(g.k)+'</option>').join("")+'</select></div>'+
    parecerPeriodoHtml(M)+caminhoHtml()+projecaoHtml()+desafiosHtml()+(A?'<div class="card" style="margin-bottom:14px">'+metasHtml(A)+'</div>':"")+
    (M?'<div class="card" style="margin-bottom:14px"><div class="card-h"><h2>Números do período</h2></div>'+
    (S.coachMes==="datas"?'<div class="ch-datas"><label class="fld2">De<input type="date" id="ch-de" value="'+esc(S.coachDe)+'"></label><label class="fld2">Até<input type="date" id="ch-ate" value="'+esc(S.coachAte)+'"></label></div>':"")+
    (M.treinos?"":'<p class="muted small">Nenhum treino neste período.</p>')+
    '<div class="calc" style="margin-bottom:10px">'+
      '<div class="kpi"><span class="l">Treinos</span><span class="v">'+M.treinos+'</span>'+dif(M.treinos,M.treinosAnt)+'</div>'+
      '<div class="kpi"><span class="l">Séries</span><span class="v">'+M.series+'</span>'+dif(M.series,M.seriesAnt)+'</div>'+
      '<div class="kpi"><span class="l">Volume</span><span class="v">'+nf1.format(M.volume)+'<small>t</small></span>'+dif(M.volume,M.volumeAnt," t")+'</div>'+
      (M.duracao?'<div class="kpi"><span class="l">Duração média</span><span class="v" style="font-size:24px">'+fmtMin(M.duracao)+'</span></div>':"")+'</div>'+
    lista("🎯 Foco daqui para frente",M.foco.map(esc),"foco")+
    lista("🏆 Recordes",M.recordes.slice(0,5).map(r=>'<b>'+esc(r.nome)+'</b>: '+nf1.format(r.de)+' → '+nf1.format(r.para)+' kg (estimado)'),"bem")+
    lista("📈 Volume por grupo",M.grupos.map(x=>esc(x.g)+': '+nf1.format(x.v)+' t'+(x.dif!=null?' ('+(x.dif>0?"+":"")+x.dif+'%)':"")))+
    lista("💬 O que se repetiu nos comentários",M.comentarios.map(c=>esc(c.nome)+': '+c.n+(c.n===1?" treino":" treinos")).concat(M.partes.map(p=>'Dor/incômodo no '+esc(p.p)+': '+p.n+(p.n===1?" treino":" treinos"))))+
    ((M.animo.bom+M.animo.ok+M.animo.ruim)?'<p class="small muted">Ânimo no período: 😀 '+M.animo.bom+' · 😐 '+M.animo.ok+' · 😞 '+M.animo.ruim+'</p>':"")+
    ((M.animoMudou.melhorou+M.animoMudou.igual+M.animoMudou.piorou)?'<p class="small"><b>Ânimo:</b> em '+M.animoMudou.melhorou+' de '+(M.animoMudou.melhorou+M.animoMudou.igual+M.animoMudou.piorou)+' treinos você saiu melhor do que chegou.</p>':"")+'</div>':"")+
    '<div class="card"><div class="card-h"><h2>Minhas academias</h2><p>no período escolhido</p></div>'+
    (G.length?G.map(g=>'<details class="acad-card"><summary><b>'+esc(g.nome)+'</b> · '+g.treinos+(g.treinos===1?" treino":" treinos")+' · ânimo 😀'+g.bom+' 😐'+g.ok+' 😞'+g.ruim+'</summary>'+
      '<p class="small muted" style="margin:6px 0">Último treino: '+esc(g.ultima)+' · volume médio '+nf1.format(g.volMedio)+' t'+(g.duracao?' · '+fmtMin(g.duracao):"")+'</p>'+
      (g.cargas.length?'<div class="tbl-wrap"><table><thead><tr><th>Exercício</th><th>Última carga aqui</th></tr></thead><tbody>'+g.cargas.map(c=>'<tr><td>'+esc(c.ex)+'</td><td>'+esc(c.peso)+' × '+esc(c.reps)+'</td></tr>').join("")+'</tbody></table></div>':"")+'</details>').join("")
      :'<p class="muted small">Nenhuma academia informada neste período. Escolha a academia no início do treino: aqui aparecem os pesos e o ânimo de cada uma.</p>')+'</div>'+
    (S.role==="prof"?chatEvoHtml():"");
  el.innerHTML=naEvo?htmlGeral:htmlTreino;
  if(naEvo){ligarGeral(el,M);ligarMetas(el,A)}
  const cs=$("#ch-ses");if(cs)cs.onchange=e=>{S.coachSel=e.target.value;renderCoach()};
  const irg=$("#ch-ir");if(irg)irg.onclick=()=>setView("evo");
  const cm=$("#ch-mes");if(cm)cm.onchange=e=>{S.coachMes=e.target.value;renderCoach()};
  [["#ch-de","coachDe"],["#ch-ate","coachAte"]].forEach(([id,k])=>{const i=$(id);if(i)i.onchange=()=>{if(i.value){S[k]=i.value;renderCoach()}}});
}

/* ---------- Parecer geral na Evolução ---------- */
const chaveParecer=()=>[S.coachMes||"p4",S.evoGrupo||"todos",S.role==="prof"?"coach":"aluno"].join("|");
function parecerPeriodoHtml(M){
  const k=chaveParecer();const sal=(S.evoPar||[]).filter(r=>r[1]===k).pop();const pend=S.evoParPend===k;
  const resumo=!M?"":S.role==="prof"?(()=>{const R=Coach.relatorio(S.rows);return "Situação: "+R.veredito+". "+M.treinos+(M.treinos===1?" treino":" treinos")+" no período, "+M.recordes.length+(M.recordes.length===1?" recorde":" recordes")+"."})()
    :M.treinos?"Você fez "+M.treinos+(M.treinos===1?" treino":" treinos")+" neste período"+(M.recordes.length?" e bateu "+M.recordes.length+(M.recordes.length===1?" recorde":" recordes"):"")+". Cada treino registrado mostra o quanto você evoluiu.":"Ainda não há treinos neste período.";
  return '<div class="card aux-b" style="margin-bottom:14px"><h3>'+(S.role==="prof"?"Leitura do coach para você":"Como você está evoluindo")+'</h3><p>'+esc(resumo)+'</p>'+
    (pend?iaLendo("O coach está lendo os treinos e os comentários deste período."):sal?'<p class="aux-c ia">'+esc(sal[4])+'</p><p class="muted small">Parecer de '+esc(sal[0])+'</p>':"")+
    '<button class="btn" id="evo-par"'+(pend?" disabled":"")+'>'+(sal?"Pedir parecer de novo":"Pedir parecer deste período")+'</button></div>';
}
function caminhoHtml(){
  const c=Coach.caminhoCerto(S.rows);if(!c)return "";
  return '<div class="card caminho" style="margin-bottom:14px"><p>✅ '+esc(c.texto)+'</p></div>';
}
function projecaoHtml(){
  const P=Coach.projecao(S.rows);const a=S.aluno||{};const sobe={sobe:"↗",estavel:"→",cai:"↘"};
  if(!P.length)return "";
  return '<div class="card" style="margin-bottom:14px"><h3>Previsão de evolução</h3><p class="muted small">Pela tendência das últimas 12 semanas, se mantiver o ritmo. É estimativa, não promessa.</p>'+
    '<ul class="rel-l">'+P.map(p=>'<li><b>'+esc(p.nome)+'</b> '+sobe[p.tendencia]+' força estimada '+nf1.format(p.hoje)+' kg hoje'+(p.tendencia==="sobe"?', cerca de '+nf1.format(p.em4)+' kg em 4 semanas e '+nf1.format(p.em12)+' kg em 12.':p.tendencia==="cai"?'. Caiu nas últimas semanas: vale olhar recuperação e carga.':'. Estável: é hora de buscar um pouco mais.')+'</li>').join("")+'</ul>'+
    (a.pesoMeta?'<p class="small">Objetivo de peso: <b>'+esc(a.pesoMeta)+' kg</b>. Veja a estimativa completa na Avaliação física.</p>':"")+'</div>';
}
function desafiosHtml(){
  const D=Coach.desafios(S.rows);const todos=D.every(d=>d.ok);
  return '<div class="card desafios'+(todos?" ok":"")+'" style="margin-bottom:14px"><h3>'+(todos?"🏆 Desafios da semana completos!":"🎯 Desafios da semana")+'</h3>'+
    D.map(d=>{const p=Math.min(100,Math.round(d.feito/d.alvo*100));return '<div class="des"><span>'+(d.ok?"✅ ":"")+esc(d.titulo)+'</span><b>'+Math.min(d.feito,d.alvo)+'/'+d.alvo+'</b><i style="--p:'+p+'%"></i></div>'}).join("")+'</div>';
}
function chatEvoHtml(){
  const st=S.evoChat||(S.evoChat={chat:[],pensando:false});
  return '<div class="card aux-b" style="margin-bottom:14px"><h3>Conversar com o coach sobre este período</h3><p class="muted small">Ele usa o histórico, as cargas, as trocas, os comentários e o seu jeito de trabalhar. Fica salvo na planilha do aluno.</p>'+
    '<div>'+st.chat.map(m=>'<p class="aux-c '+m.papel+'">'+esc(m.texto)+'</p>').join("")+(st.pensando?iaLendo("O coach está lendo os treinos e a sua pergunta."):"")+'</div>'+
    '<textarea class="obs" id="evo-q" style="height:64px;padding:8px 10px;width:100%" placeholder="Ex.: o que você mudaria no treino de perna dele?"></textarea><button class="btn primary" id="evo-env" style="width:100%;margin-top:6px"'+(st.pensando?" disabled":"")+'>Enviar</button></div>';
}
// Máquinas usadas no período, por exercício, com o salto de carga: a IA só compara carga na mesma máquina.
function maquinasDoPeriodo(M){
  const m=new Map();((M&&M.linhas)||[]).forEach(r=>{if(!r.maq)return;const k=Coach.base(r.ex)+"|"+strip(r.maq);m.set(k,{exercicio:r.ex.replace(/\s+(d|e)$/i,""),maquina:r.maq,saltoDeCargaKg:r.salto||null})});
  return [...m.values()].slice(0,20);
}
function fatosPeriodo(M){
  const R=Coach.relatorio(S.rows),P=Coach.projecao(S.rows);
  return {periodo:M?M.nome:"",grupo:S.evoGrupo||"todos",treinos:M?M.treinos:0,treinosAntes:M?M.treinosAnt:0,volumeT:M?Math.round(M.volume*10)/10:0,volumeAntesT:M?Math.round(M.volumeAnt*10)/10:0,
    recordes:M?M.recordes.slice(0,6).map(r=>r.nome+": "+nf1.format(r.de)+" para "+nf1.format(r.para)+" kg estimados"):[],evolucoes:M?M.evolucoes.slice(0,6).map(e=>e.nome+" "+e.d+"%"):[],
    gruposVolume:M?M.grupos.map(g=>g.g+" "+(g.dif==null?"sem comparação":g.dif+"%")):[],comentariosRepetidos:M?M.comentarios.map(c=>c.nome+" "+c.n):[],dores:R.dores,pedidos:R.pedidos,
    relacaoComOTreino:R.fatores.map(f=>f.texto.replace(/<[^>]+>/g,"")),metasBatidas:R.metasBatidas,situacao:R.veredito,previsao:P,objetivo:(S.aluno||{}).objetivo||"",nivel:(S.aluno||{}).nivel||"",maquinas:maquinasDoPeriodo(M)};
}
function ligarGeral(el,M){
  const cg=$("#ch-grupo");if(cg)cg.onchange=e=>{S.evoGrupo=e.target.value;renderCoach()};
  const bp=$("#evo-par");if(bp)bp.onclick=async()=>{
    const k=chaveParecer();S.evoParPend=k;renderCoach();
    try{const d=await callA("evoParecer",{chave:k,fatos:fatosPeriodo(M)});
      if(d.linha)S.evoPar=(S.evoPar||[]).concat([d.linha]);else toast(d.motivo==="limite_do_dia"?"O limite de hoje acabou.":d.motivo==="nao_liberada"?"O coach com IA vale depois que o aluno aceita os termos.":"O coach não conseguiu agora.");
    }catch(x){toast(errText(x))}
    S.evoParPend=null;if(S.view==="evo")renderCoach()};
  const env=$("#evo-env");if(env)env.onclick=async()=>{
    const q=$("#evo-q").value.trim();if(!q)return;const st=S.evoChat;const hist=st.chat.slice(-6);
    st.chat.push({papel:"eu",texto:q});st.pensando=true;renderCoach();
    try{const d=await callA("auxChat",{pergunta:q,historico:hist,fatos:fatosPeriodo(M),origem:"Evolução"});
      st.chat.push({papel:"ia",texto:d.resposta||(d.motivo==="limite_do_dia"?"O limite de conversas de hoje acabou.":"Não consegui responder agora.")})}
    catch(x){st.chat.push({papel:"ia",texto:errText(x)})}
    st.pensando=false;if(S.view==="evo")renderCoach()};
}

/* ---------- Boas-vindas: aparece uma vez, no primeiro acesso ---------- */
function boasVindas(){
  if(!S.aluno||!S.aluno.aceite||document.querySelector(".foto-box.bv"))return;
  const k="dt2-boasvindas-"+S.aluno.id;if(Api.store.load(k))return;
  const ov=document.createElement("div");ov.className="foto-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-label","Boas-vindas");
  const nome=String((S.aluno&&S.aluno.nome)||"").split(" ")[0];
  ov.innerHTML='<div class="foto-box bv"><p class="bv-tit">Olá'+(nome?", "+esc(nome):"")+'! Eu sou o seu coach. 💪</p><p class="bv-slogan">Não só aprendo com você: eu evoluo junto.</p>'+
    '<ol class="bv-l"><li><b>Treinar:</b> escolha o treino do dia e preencha as repetições. Eu marco a série e conto o descanso.</li><li><b>Comente:</b> sono, comida, dor, máquina diferente. Eu leio tudo e ajusto as próximas metas.</li><li><b>Avaliação do Coach:</b> depois de cada treino, o meu parecer.</li><li><b>Evolução:</b> como você está indo, a previsão e os desafios da semana.</li></ol>'+
    '<button class="btn primary" style="width:100%">Vamos começar</button></div>';
  ov.querySelector("button").onclick=()=>{Api.store.put(k,1);ov.remove()};document.body.appendChild(ov);
}

/* ---------- Fotos da avaliação: salvas no Drive do professor ---------- */
function fotosAvHtml(cur){
  if(S.role!=="prof")return "";
  const lista=(S.fotosAv||{})[cur.dataS];
  return '<div class="card" style="margin:14px 0"><h3>Fotos desta avaliação</h3><p class="muted small">Ficam numa pasta do aluno no seu Google Drive. Não vão para a galeria do celular.</p>'+
    '<div class="row-btns">'+["Frente","Lado","Costas"].map(p=>'<label class="btn">📷 '+p+'<input type="file" accept="image/*" capture="environment" data-pose="'+p+'" hidden></label>').join("")+'</div>'+
    '<div id="av-fotos">'+(lista==null?'<p class="muted small">Lendo as fotos…</p>':lista.length?'<ul class="rel-l">'+lista.map(f=>'<li><a href="'+esc(f.url)+'" target="_blank" rel="noopener">'+esc(f.nome)+'</a></li>').join("")+'</ul>':'<p class="muted small">Nenhuma foto ainda.</p>')+'</div></div>';
}
function reduzirFoto(file){
  return new Promise((ok,no)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const m=1280,e=Math.min(1,m/Math.max(img.width,img.height));
    const c=document.createElement("canvas");c.width=Math.round(img.width*e);c.height=Math.round(img.height*e);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);
    ok(c.toDataURL("image/jpeg",0.82).split(",")[1])};img.onerror=no;img.src=u});
}
function ligarFotosAv(cur){
  if(S.role!=="prof")return;
  S.fotosAv=S.fotosAv||{};
  if(S.fotosAv[cur.dataS]==null){S.fotosAv[cur.dataS]=undefined;callA("fotosListar",{data:cur.dataS}).then(d=>{S.fotosAv[cur.dataS]=d.fotos||[];if(S.view==="aval"&&!S.avEdit)renderAval()}).catch(()=>{S.fotosAv[cur.dataS]=[];if(S.view==="aval"&&!S.avEdit)renderAval()})}
  document.querySelectorAll("#aval [data-pose]").forEach(inp=>inp.onchange=async()=>{
    const f=inp.files&&inp.files[0];if(!f)return;toast("Enviando a foto para o seu Drive…");
    try{const b64=await reduzirFoto(f);const d=await callA("fotoSalvar",{data:cur.dataS,pose:inp.dataset.pose,b64});
      S.fotosAv[cur.dataS]=(S.fotosAv[cur.dataS]||[]).concat([d.foto]);toast("Foto salva no Drive.");renderAval()}
    catch(x){toast(/teste.html/.test(location.pathname)?"Na versão de teste as fotos não são salvas.":errText(x))}
  });
}

/* ========== CONFIGURAÇÕES ========== */
function quando(ms){if(!ms)return "nunca";const d=new Date(ms);return (fmtDate(d)===fmtDate(new Date())?"hoje":fmtShort(d))+" às "+hhmm(d)}
function renderConfig(){
  const el=$("#config");const prof=S.role==="prof";const U=window.Atualizacao;const ult=U.ultima();
  el.innerHTML='<div class="card" style="margin-bottom:14px"><h3>Aparência</h3><div class="tema-esc">'+
    [["light","sun","Claro"],["dark","moon","Escuro"]].map(([k,ic,t])=>'<button class="btn'+(temaAtual()===k?" primary":"")+'" data-tema="'+k+'" aria-pressed="'+(temaAtual()===k)+'">'+Icone(ic,18)+t+'</button>').join("")+'</div></div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Atualização do app</h3>'+
    '<dl class="kv" style="margin:8px 0"><dt>Versão instalada</dt><dd>'+esc(U.VERSAO)+' <span class="muted small">('+esc(U.DATA)+')</span></dd>'+
    '<dt>Última verificação</dt><dd id="cf-ult">'+esc(quando(ult&&ult.em))+'</dd></dl>'+
    '<p class="muted small">O app se atualiza sozinho quando há internet. Use o botão se quiser conferir agora. O treino em andamento e o seu acesso não são apagados.</p>'+
    '<p class="setup-msg" id="cf-msg" role="status"></p><div id="cf-notas"></div>'+
    '<div class="row-btns"><button class="btn" id="cf-dados">Atualizar treinos</button><button class="btn primary" id="cf-check">Buscar atualizações</button><button class="btn" id="cf-apply" hidden>Atualizar agora</button></div></div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Instalar o app</h3>'+installHtml()+'</div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Este aparelho</h3><p class="muted small">'+(prof?"Você está entrando como <b>professor</b>.":"Você está entrando como aluno.")+' Para trocar de conta, saia e abra outro link.</p><div class="row-btns"><button class="btn ghost" id="p-out">Sair deste aparelho</button></div></div>'+
    '<p class="note" style="text-align:center"><a href="privacidade.html">Privacidade</a> · <a href="termos.html">Termos</a> · gratuito</p>';
  el.querySelectorAll("[data-tema]").forEach(b=>b.onclick=()=>{setTema(b.dataset.tema);renderConfig()});
  const pi=$("#p-install");if(pi)pi.onclick=doInstall;
  $("#p-out").onclick=()=>armed($("#p-out"),"Toque de novo para sair","Sair deste aparelho",()=>{Api.logout();location.hash="";location.reload()});
  $("#cf-apply").onclick=atualizarAgora;
  $("#cf-dados").onclick=()=>atualizarTudo(false);
  $("#cf-check").onclick=async()=>{
    const msg=$("#cf-msg"),b=$("#cf-check");b.disabled=true;msg.className="setup-msg";msg.textContent="Buscando…";
    try{
      const r=await U.verificar();$("#cf-ult").textContent=quando(Date.now());
      if(r.nova){
        msg.className="setup-msg good";msg.textContent="Versão nova disponível: "+r.remota+" ("+(r.info.data||"")+").";
        $("#cf-notas").innerHTML=(r.info.notas||[]).length?'<ul class="small">'+r.info.notas.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul>':"";
        $("#cf-apply").hidden=false;
      }else{msg.className="setup-msg good";msg.textContent="Você já está na versão mais nova ("+r.local+")."}
    }catch(e){msg.className="setup-msg bad";msg.textContent=e.code==="offline"?"Sem internet. Tente de novo quando a conexão voltar.":(e.message||"Não consegui buscar atualizações.")}
    finally{b.disabled=false}
  };
}
async function atualizarAgora(){
  if(S.saving){toast("Espere terminar de salvar o treino.");return}
  toast("Baixando a versão nova…");
  await window.Atualizacao.aplicar();
}
// Verificação automática: ao abrir e ao voltar para o app (no máximo a cada 6 horas).
async function checarAtualizacaoAuto(){
  try{
    const ult=window.Atualizacao.ultima();
    if(ult&&Date.now()-ult.em<6*36e5&&!(ult.remota&&window.Atualizacao.cmp(ult.remota,window.Atualizacao.VERSAO)>0))return;
    const r=await window.Atualizacao.verificar();
    if(r.nova&&!$("#banner").innerHTML){
      banner('<p><b>Versão nova disponível ('+esc(r.remota)+').</b> '+esc((r.info.notas||[])[0]||"")+'</p><button class="btn" id="b-upd">Atualizar agora</button><button class="btn ghost" id="b-upd-x">Depois</button>');
      $("#b-upd").onclick=atualizarAgora;$("#b-upd-x").onclick=()=>banner("");
    }
  }catch(e){}
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checarAtualizacaoAuto()});


/* ========== PÁGINAS DO PROFESSOR ==========
   Usam o resumo de todos os alunos (ação painel). Na primeira tela o professor é o próprio aluno master;
   ao abrir alguém pela lista, S.ctxAluno fica ligado até voltar para o início. */
const masterId=()=>(S.alunos.find(a=>a.master)||{}).id||null;
const ocultos=()=>store("dt2-ocultos")||[];
let painelRodando=false;
async function carregarPainel(forcar){
  if(S.role!=="prof"||painelRodando)return;
  if(!forcar&&Date.now()-(S.painelAt||0)<3e5)return;
  painelRodando=true;
  if(!S.painel){const c=Api.cacheGet("painel");if(c&&c.resumos){S.painel=c.resumos;redesenharPainel()}}
  try{
    for(let i=0;i<6;i++){
      const d=await Api.call("painel",{});
      S.painel=Object.assign({},S.painel||{},d.resumos);
      Api.cacheSet("painel",{resumos:Object.fromEntries(Object.entries(S.painel).map(([k,v])=>{const c=Object.assign({},v);delete c.s;return [k,c]}))});
      redesenharPainel();
      if(!d.faltam)break;
    }
    S.painelAt=Date.now();
  }catch(e){}finally{painelRodando=false}
}
function redesenharPainel(){if(["inicio","alunos","aluno","alcal"].includes(S.view)&&!S.alunoForm)render()}
function resumoDe(id){
  const r=S.painel&&S.painel[id];if(!r)return null;
  // A cópia guardada no aparelho traz as datas como texto: refaz a lista a partir de r.t.
  if(!r.s||(r.s[0]&&!(r.s[0].date instanceof Date)))r.s=(r.t||[]).map(x=>({dateS:x[0],date:parseDate(x[0]),treino:x[1],vol:x[2],series:x[3],e:x[4]})).filter(x=>x.date).sort((a,b)=>a.date-b.date);
  return r;
}
function diaZero(d){const h=d||new Date();return new Date(h.getFullYear(),h.getMonth(),h.getDate())}
const diasEntre=(a,b)=>Math.round((diaZero(b)-diaZero(a))/864e5);
const ultimoTreino=(r,ate)=>{if(!r)return null;const s=r.s.filter(x=>!ate||x.date<=ate);return s.length?s[s.length-1]:null};
function textoDias(n){return n<=0?"hoje":n===1?"ontem":"há "+n+" dias"}
const pedeAtencao=a=>{if(!a.ativo||a.master)return false;if(a.status==="montar treino")return true;if(a.status!=="ok")return false;
  const r=resumoDe(a.id);if(!r)return false;const u=ultimoTreino(r);return !u||diasEntre(u.date)>=10};
/* Força: compara o melhor de cada exercício na 1ª e na 2ª metade do período. */
function forcaPct(r,dias){
  if(!r)return null;const h=diaZero(),ini=+h-dias*864e5,meio=+h-dias/2*864e5,a={},b={};
  r.s.forEach(s=>{if(+s.date<ini)return;const m=+s.date<meio?a:b;s.e.forEach(([i,f])=>{if(!m[i]||f>m[i])m[i]=f})});
  const v=Object.keys(a).filter(i=>b[i]).map(i=>(b[i]/a[i]-1)*100);
  return v.length?v.reduce((x,y)=>x+y,0)/v.length:null;
}
const assinado=n=>(n>0?"+":n<0?"−":"")+nf1.format(Math.abs(n));
function semanasDe(dias){
  const h=diaZero(),out=[];let d=new Date(+h-dias*864e5);d=new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7));
  while(d<=h){out.push(d);d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+7)}
  return out;
}
const semanaIdx=(sem,date)=>{for(let i=sem.length-1;i>=0;i--)if(date>=sem[i])return i;return -1};
const num=Body.num;
function gorduraDe(av,a){const n=num(av["% Gordura"]);if(isFinite(n))return n;const d=parseDate(av["Data"]);const c=Body.calc(av,a||{},d||new Date());return isFinite(c["% Gordura"])?c["% Gordura"]:NaN}
/* Valores por semana. Força: o início de cada exercício no período vale 100. */
function serieDe(a,met,dias){
  const r=resumoDe(a.id);const sem=semanasDe(dias);const v=sem.map(()=>null);if(!r)return {sem,v};
  const corte=sem[0];
  if(met==="freq"||met==="vol"){v.fill(0);r.s.forEach(s=>{if(s.date<corte)return;const i=semanaIdx(sem,s.date);v[i]+=met==="vol"?s.vol/1000:1});return {sem,v:v.map(x=>Math.round(x*10)/10)}}
  if(met==="forca"){
    const base={},porSem=sem.map(()=>({}));
    r.s.forEach(s=>{if(s.date<corte)return;const i=semanaIdx(sem,s.date);s.e.forEach(([k,f])=>{if(!base[k])base[k]=f;if(!porSem[i][k]||f>porSem[i][k])porSem[i][k]=f})});
    porSem.forEach((o,i)=>{const ks=Object.keys(o);if(ks.length)v[i]=Math.round(ks.reduce((t,k)=>t+o[k]/base[k]*100,0)/ks.length*10)/10});
    return {sem,v};
  }
  r.a.forEach(av=>{const d=parseDate(av["Data"]);if(!d||d<corte)return;const i=semanaIdx(sem,d);
    const x=met==="gordura"?gorduraDe(av,a):num(av[met==="peso"?"Peso (kg)":"Cintura (cm)"]);if(isFinite(x))v[i]=x});
  return {sem,v};
}
function linhaSvg(vals,cor){
  const p=vals.filter(x=>x!=null);if(p.length<2)return '<svg class="mini" viewBox="0 0 150 40" preserveAspectRatio="none"><line x1="4" x2="146" y1="30" y2="30" style="stroke:var(--line-2)" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>';
  const mx=Math.max(...p),mn=Math.min(...p),X=i=>4+i*142/(p.length-1),Y=v=>35-(v-mn)*30/((mx-mn)||1);
  return '<svg class="mini" viewBox="0 0 150 40" preserveAspectRatio="none"><polyline fill="none" style="stroke:var('+cor+')" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="'+p.map((v,i)=>X(i)+","+Y(v)).join(" ")+'"/></svg>';
}
function cardAluno(a){
  const r=resumoDe(a.id),pct=forcaPct(r,60),u=ultimoTreino(r),d=u?diasEntre(u.date):null;
  const parado=d!=null&&d>=10;
  const cor=!u?"--ink-3":parado?"--bad":pct==null?"--ink-3":pct>=1?"--action":pct<=-1?"--warn":"--ink-3";
  const sub=!a.ativo?"Acesso pausado":a.status==="montar treino"?"Montar treino":a.status==="aguardando cadastro"?"Aguardando cadastro":!r?"Lendo…":!u?"Ainda sem treino":parado?d+" dias parado":(pct!=null?assinado(pct)+"% · ":"")+textoDias(d);
  return '<button class="acard2'+(a.master?" master":"")+(a.ativo?"":" off")+'" data-id="'+esc(a.id)+'"><span class="a2-h"><b>'+esc(a.nome)+'</b>'+(a.master?'<span class="pill good">Aluno master</span>':"")+'</span>'+(relatorioDevido(a)?'<span class="pill warn">Relatório pronto</span>':"")+'<span class="a2-s">'+esc(sub)+'</span>'+linhaSvg(serieDe(a,"forca",60).v,cor)+'</button>';
}
function abrirAluno(id){
  const a=S.alunos.find(x=>x.id===id);S.shareFor=null;S.ctxAluno=true;S.alunoMet="forca";S.alMes=null;S.alDia=null;
  if(a&&a.status==="montar treino"&&!a.master){openModelEditor(id);return}
  selectAluno(id,true);abrir("aluno");
}
function visiveis(){const o=ocultos();return S.alunos.filter(a=>!o.includes(a.id)).sort((a,b)=>(b.master?1:0)-(a.master?1:0)||(b.ativo-a.ativo)||a.nome.localeCompare(b.nome,"pt-BR"))}
function renderAlunos(){
  const el=$("#v-alunos");
  if(S.alunoForm)return renderAlunoForm(el);
  const aba=S.alunosAba||"lista";
  if(aba==="escolher")return renderEscolher(el);
  if(aba==="calendario")return S.calDia?renderCalDia(el):renderCalTodos(el);
  if(aba==="comparar")return renderComparar(el);
  const q=strip(S.busca);const vis=visiveis();
  const list=vis.filter(a=>!q||strip(a.nome).includes(q));const master=list.find(a=>a.master);const resto=list.filter(a=>!a.master);
  el.innerHTML='<p class="muted small" style="margin:0 0 8px">'+vis.length+' de '+S.alunos.length+' aparecendo</p>'+
    (S.shareFor?shareBox(S.shareFor):"")+
    '<div class="a2-busca"><input class="search" id="a-busca" type="search" placeholder="Buscar aluno" value="'+esc(S.busca)+'"><button class="btn" id="a-esc">Escolher</button></div>'+
    (master?cardAluno(master):"")+
    (resto.length?'<div class="alist2">'+resto.map(cardAluno).join("")+'</div>':(master?"":'<div class="empty">'+(S.alunos.length?"Nenhum aluno para mostrar.":"Nenhum aluno ainda. Toque em <b>Novo</b>.")+'</div>'));
  $("#a-esc").onclick=()=>{S.alunosAba="escolher";render();window.scrollTo({top:0})};
  const bs=$("#a-busca");bs.addEventListener("input",()=>{S.busca=bs.value;const p=bs.selectionStart;renderAlunos();const n=$("#a-busca");n.focus();n.setSelectionRange(p,p)});
  el.querySelectorAll(".acard2").forEach(b=>b.onclick=()=>abrirAluno(b.dataset.id));
  bindCopy(el);
}
function renderEscolher(el){
  const o=ocultos();const todos=[...S.alunos].sort((a,b)=>(b.master?1:0)-(a.master?1:0)||a.nome.localeCompare(b.nome,"pt-BR"));
  el.innerHTML='<div class="av-top"><div><h2>Quem aparece</h2><span class="muted small">Toque para mostrar ou esconder.</span></div></div>'+
    '<div class="row-btns" style="margin-bottom:10px"><button class="btn" id="e-todos">Marcar todos</button><button class="btn" id="e-ativos">Só os ativos</button></div>'+
    '<div class="esc-lista">'+todos.map(a=>'<button class="esc-l" data-id="'+esc(a.id)+'"><span class="esc-c'+(o.includes(a.id)?"":" on")+'">'+(o.includes(a.id)?"":Icone("check",16))+'</span>'+esc(a.nome)+(a.master?" (master)":"")+(a.ativo?"":' <span class="pill bad">pausado</span>')+'</button>').join("")+'</div>'+
    '<p class="muted small">Quem fica de fora só sai da sua tela. O aluno continua treinando normalmente.</p>'+
    '<button class="btn primary" id="e-ok" style="width:100%">Pronto</button>';
  el.querySelectorAll(".esc-l").forEach(b=>b.onclick=()=>{const l=ocultos();const i=l.indexOf(b.dataset.id);if(i>=0)l.splice(i,1);else l.push(b.dataset.id);store("dt2-ocultos",l);renderEscolher(el)});
  $("#e-todos").onclick=()=>{store("dt2-ocultos",[]);renderEscolher(el)};
  $("#e-ativos").onclick=()=>{store("dt2-ocultos",S.alunos.filter(a=>!a.ativo).map(a=>a.id));renderEscolher(el)};
  $("#e-ok").onclick=()=>{S.alunosAba="lista";render();window.scrollTo({top:0})};
}
function renderCalTodos(el){
  const n=S.calDias||14,h=diaZero(),dias=[];for(let i=n-1;i>=0;i--)dias.push(new Date(h.getFullYear(),h.getMonth(),h.getDate()-i));
  const vis=visiveis().filter(a=>a.ativo);
  const col=n>14?"20px":"minmax(14px,1fr)";
  el.innerHTML='<div class="chips-l" id="cal-p">'+[[7,"7 dias"],[14,"14 dias"],[30,"30 dias"]].map(x=>'<button class="chip'+(x[0]===n?" on":"")+'" data-n="'+x[0]+'">'+x[1]+'</button>').join("")+'</div>'+
    '<div class="card mx-wrap"><div class="mx" style="grid-template-columns:72px repeat('+n+','+col+') 24px"><span></span>'+dias.map(d=>'<button class="h" data-dia="'+fmtDate(d)+'">'+d.getDate()+'</button>').join("")+'<span class="h2">Total</span>'+
    vis.map(a=>{const r=resumoDe(a.id);const set=new Set(r?r.s.map(s=>s.dateS):[]);let t=0;
      return '<button class="n" data-al="'+esc(a.id)+'">'+esc(primeiroNome(a))+'</button>'+dias.map(d=>{const on=set.has(fmtDate(d));if(on)t++;return '<button class="c'+(on?" on":"")+'" data-dia="'+fmtDate(d)+'" aria-label="'+esc(primeiroNome(a))+', '+fmtShort(d)+(on?", treinou":", não treinou")+'"></button>'}).join("")+'<span class="q">'+t+'</span>'}).join("")+'</div></div>'+
    '<div class="mx-lg"><span><i class="on"></i>Treinou</span><span><i></i>Não treinou</span></div><p class="muted small">Cada linha é um aluno. Toque em um dia para ver quem foi.</p>';
  el.querySelectorAll("#cal-p .chip").forEach(b=>b.onclick=()=>{S.calDias=+b.dataset.n;renderAlunos()});
  el.querySelectorAll("[data-dia]").forEach(b=>b.onclick=()=>{S.calDia=b.dataset.dia;renderAlunos();window.scrollTo({top:0})});
  el.querySelectorAll("[data-al]").forEach(b=>b.onclick=()=>abrirAluno(b.dataset.al));
}
const waConversa=a=>{const d=String(a.telefone||"").replace(/\D/g,"");return d?"https://wa.me/"+(d.length>=10&&d.length<=11?"55"+d:d):""};
function renderCalDia(el){
  const d=parseDate(S.calDia);const vis=visiveis().filter(a=>a.ativo);const foi=[],nao=[];
  vis.forEach(a=>{const r=resumoDe(a.id);const s=r?r.s.filter(x=>x.dateS===S.calDia):[];if(s.length)foi.push([a,s]);else nao.push(a)});
  const nomeD=d.toLocaleDateString("pt-BR",{weekday:"long"});
  const lin=(a,sub,dir)=>'<div class="dia-l"><button class="dia-a" data-al="'+esc(a.id)+'"><b>'+esc(a.nome)+'</b><span>'+esc(sub)+'</span></button>'+dir+'</div>';
  el.innerHTML='<div class="av-top"><div><h2 style="text-transform:capitalize">'+esc(nomeD)+', '+fmtShort(d)+'</h2></div></div>'+
    '<h3 class="dia-t">Treinaram ('+foi.length+')</h3>'+(foi.map(([a,s])=>lin(a,s.map(x=>x.treino).join(", "),"")).join("")||'<p class="muted small">Ninguém treinou neste dia.</p>')+
    '<h3 class="dia-t">Não treinaram ('+nao.length+')</h3>'+nao.map(a=>{const u=ultimoTreino(resumoDe(a.id),d);const w=waConversa(a);
      return lin(a,u?"Último treino: "+textoDias(diasEntre(u.date,d)).replace("hoje","no dia").replace("ontem","na véspera"):"Sem treino antes deste dia",w?'<a class="btn wa-p" href="'+esc(w)+'" target="_blank" rel="noopener">'+Icone("whatsapp",18)+'WhatsApp</a>':"")}).join("");
  el.querySelectorAll("[data-al]").forEach(b=>b.onclick=()=>abrirAluno(b.dataset.al));
}
const METRICAS=[["forca","Força"],["freq","Frequência"],["peso","Peso"],["gordura","% Gordura"]];
const CORES_COMP=["--g-inf","--g-cos","--g-pei","--g-bra","--g-omb"];
function desenharLinhas(id,sets,labels,fmt){
  if(charts[id]){charts[id].destroy();delete charts[id]}
  const cv=$("#"+id);if(!cv)return;const line=css("--line"),ink3=css("--ink-3");
  charts[id]=new Chart(cv,{type:"line",data:{labels,datasets:sets.map(s=>({label:s.label,data:s.data,borderColor:s.cor,backgroundColor:s.cor,borderWidth:2.5,tension:.3,pointRadius:2,spanGaps:true}))},
    options:{maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:Object.assign(tipBase(),{callbacks:{label:c=>" "+c.dataset.label+": "+fmt(c.parsed.y)}})},
      scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:5,color:ink3}},y:{grid:{color:line},border:{display:false},ticks:{color:ink3,maxTicksLimit:5}}}}});
}
function compStats(a,dias){
  const r=resumoDe(a.id);const corte=+diaZero()-dias*864e5;const s=r?r.s.filter(x=>+x.date>=corte):[];
  let gap=0;for(let i=1;i<s.length;i++)gap=Math.max(gap,diasEntre(s[i-1].date,s[i].date));
  const av=(r?r.a:[]).map(x=>({d:parseDate(x["Data"]),x})).filter(x=>x.d&&+x.d>=corte).sort((p,q)=>p.d-q.d);
  const dif=f=>{const v=av.map(y=>f(y.x)).filter(isFinite);return v.length>1?v[v.length-1]-v[0]:null};
  return {forca:forcaPct(r,dias),treinos:s.length,sem:s.length/(dias/7),gap,peso:dif(x=>num(x["Peso (kg)"])),gord:dif(x=>gorduraDe(x,a)),cint:dif(x=>num(x["Cintura (cm)"]))};
}
function renderComparar(el){
  const C=S.comp=S.comp||{ids:[],met:"forca",dias:90,modo:"grafico"};
  const vis=visiveis();C.ids=C.ids.filter(i=>S.alunos.some(a=>a.id===i));
  if(!C.ids.length)C.ids=vis.filter(a=>a.ativo).slice(0,3).map(a=>a.id);
  const sel=C.ids.map(i=>S.alunos.find(a=>a.id===i));const fora=vis.filter(a=>!C.ids.includes(a.id));
  const chipP=[[30,"1 mês"],[90,"3 meses"],[180,"6 meses"],[365,"1 ano"]];
  let corpo="";
  if(C.modo==="grafico"){
    corpo='<div class="chips-l" id="c-met">'+METRICAS.map(m=>'<button class="chip'+(m[0]===C.met?" on":"")+'" data-m="'+m[0]+'">'+m[1]+'</button>').join("")+'</div>'+
      '<div class="card"><div class="comp-g"><canvas id="ch-comp"></canvas></div>'+(C.met==="forca"?'<p class="muted small" style="margin:6px 0 0">O começo do período vale 100.</p>':"")+'</div>';
  }else{
    const st=sel.map(a=>compStats(a,C.dias));const cel=(f)=>st.map(s=>'<td class="r">'+f(s)+'</td>').join("");
    const dd=(x,u)=>x==null?"–":assinado(x)+u;
    const sinal=x=>x==null?"–":'<span class="'+(x>=0?"up":"down-t")+'">'+assinado(x)+'%</span>';
    corpo='<div class="card comp-t"><table><tr><th></th>'+sel.map(a=>'<th class="r">'+esc(primeiroNome(a))+'</th>').join("")+'</tr>'+
      '<tr><td>Força</td>'+cel(s=>sinal(s.forca))+'</tr><tr><td>Treinos</td>'+cel(s=>s.treinos)+'</tr><tr><td>Por semana</td>'+cel(s=>nf1.format(s.sem))+'</tr><tr><td>Maior intervalo</td>'+cel(s=>s.gap?s.gap+" dias":"–")+'</tr>'+
      '<tr><td>Peso</td>'+cel(s=>dd(s.peso," kg"))+'</tr><tr><td>% Gordura</td>'+cel(s=>dd(s.gord,""))+'</tr><tr><td>Cintura</td>'+cel(s=>dd(s.cint," cm"))+'</tr></table></div>';
    if(sel.length>1){
      const mais=st.map((s,i)=>[s.sem,i]).sort((a,b)=>b[0]-a[0])[0];const fo=st.map((s,i)=>[s.forca,i]).filter(x=>x[0]!=null).sort((a,b)=>b[0]-a[0])[0];
      corpo+='<div class="card"><h3 class="dia-t" style="margin-top:0">Resumo</h3><p style="margin:0">'+esc(primeiroNome(sel[mais[1]]))+' foi quem mais treinou por semana'+(fo?(fo[1]===mais[1]?" e também teve a maior alta de força.":". "+esc(primeiroNome(sel[fo[1]]))+" teve a maior alta de força."):".")+'</p></div>';
    }
  }
  el.innerHTML='<div class="chips-l" id="c-al">'+sel.map((a,i)=>'<button class="chip" style="border-color:var('+CORES_COMP[i]+');border-width:2px" data-x="'+esc(a.id)+'">'+esc(primeiroNome(a))+' ×</button>').join("")+
      (C.ids.length<5&&fora.length?'<select class="chip" id="c-add" aria-label="Adicionar aluno"><option value="">+ Aluno</option>'+fora.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.nome)+'</option>').join("")+'</select>':"")+'</div>'+
    '<div class="chips-l" id="c-modo"><button class="chip'+(C.modo==="grafico"?" on":"")+'" data-v="grafico">Gráfico</button><button class="chip'+(C.modo==="tabela"?" on":"")+'" data-v="tabela">Tabela</button></div>'+corpo+
    '<div class="chips-l" id="c-per">'+chipP.map(p=>'<button class="chip'+(p[0]===C.dias?" on":"")+'" data-d="'+p[0]+'">'+p[1]+'</button>').join("")+'</div>';
  el.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{C.ids=C.ids.filter(i=>i!==b.dataset.x);if(!C.ids.length)C.ids=[];renderAlunos()});
  const add=$("#c-add");if(add)add.onchange=()=>{if(add.value){C.ids.push(add.value);renderAlunos()}};
  el.querySelectorAll("#c-met .chip").forEach(b=>b.onclick=()=>{C.met=b.dataset.m;renderAlunos()});
  el.querySelectorAll("#c-modo .chip").forEach(b=>b.onclick=()=>{C.modo=b.dataset.v;renderAlunos()});
  el.querySelectorAll("#c-per .chip").forEach(b=>b.onclick=()=>{C.dias=+b.dataset.d;renderAlunos()});
  if(C.modo==="grafico"&&sel.length){
    const ser=sel.map(a=>serieDe(a,C.met,C.dias));
    const u={forca:"",freq:" treinos",peso:" kg",gordura:"%"}[C.met];
    desenharLinhas("ch-comp",ser.map((s,i)=>({label:primeiroNome(sel[i]),data:s.v,cor:css(CORES_COMP[i])})),ser[0].sem.map(fmtShort),v=>nf1.format(v)+u);
  }
}
function renderAlunoPag(){
  const el=$("#v-aluno");const a=S.aluno;if(!a){el.innerHTML='<div class="empty">Escolha um aluno.</div>';return}
  const id=idade(a);const w=waConversa(a);const met=S.alunoMet||"forca";
  const tile=(ir,ic,nome)=>'<button class="home-tile" data-ir="'+ir+'">'+nome+'<span class="home-ic">'+Icone(ic,46)+'</span></button>';
  const s=serieDe(a,met,90);const tem=s.v.filter(x=>x!=null&&(met!=="vol"||x>0)).length>1;
  el.innerHTML='<div class="al-top"><span class="muted small">'+[id!=null?id+" anos":"",a.objetivo,a.dias?a.dias+"x por semana":""].filter(Boolean).map(esc).join(" · ")+'</span>'+(w?'<a class="btn wa-p" href="'+esc(w)+'" target="_blank" rel="noopener">'+Icone("whatsapp",18)+'WhatsApp</a>':"")+chaveEvo()+'</div>'+
    (evoModo()==="setas"?evoSetasHtml():'<div class="card"><div class="chips-l" id="al-met">'+[["forca","Força"],["vol","Volume"],["peso","Peso"],["cintura","Medidas"]].map(m=>'<button class="chip'+(m[0]===met?" on":"")+'" data-m="'+m[0]+'">'+m[1]+'</button>').join("")+'</div>'+
    (tem?'<div class="al-g"><canvas id="ch-aluno"></canvas></div>':'<div class="empty" style="padding:26px 8px">'+(S.painel?"Ainda sem dados suficientes para este gráfico.":"Lendo os dados…")+'</div>')+'</div>')+
    '<button class="home-alunos aux-tile" data-ir="evo">'+Icone("trending-up",28)+'<span><b>Parecer geral e previsão</b>Evolução, desafios e conversa com o coach</span>'+Icone("chevron-right",22)+'</button>'+'<button class="home-alunos aux-tile" data-ir="auxil">'+Icone("clipboard",28)+'<span><b>Auxiliar do Coach</b>'+(relatorioDevido(a)?"Relatório de 30 dias pronto":"Análise de 30 dias e conversa")+'</span>'+Icone("chevron-right",22)+'</button>'+'<div class="al-box">'+tile("alcal","calendar","Calendário")+(S.fin&&S.fin.ativo&&!a.master?tile("fin","coin","Financeiro"):"")+tile("coach","speakerphone","Avaliação do Coach")+tile("aval","ruler-measure","Avaliação física")+tile("treinos","clipboard","Montar treinos")+tile("comparar","chart-line","Comparar")+tile("perfil","user-circle","Perfil")+'</div>';
  ligarChaveEvo(el,renderAlunoPag);
  el.querySelectorAll("#al-met .chip").forEach(b=>b.onclick=()=>{S.alunoMet=b.dataset.m;renderAlunoPag()});
  el.querySelectorAll("[data-ir]").forEach(b=>b.onclick=()=>irAluno(b.dataset.ir));
  if(tem&&evoModo()!=="setas"){const u={forca:"",vol:" t",peso:" kg",cintura:" cm"}[met];desenharLinhas("ch-aluno",[{label:primeiroNome(a),data:s.v,cor:css("--action")}],s.sem.map(fmtShort),v=>nf1.format(v)+u)}
}
function irAluno(ir){
  if(ir==="fin"){S.finAluno=S.alunoId;S.finDe="aluno";S.finEdit=false;S.finPag=false;carregarFin(true);abrir("fin");return}
  if(ir==="treinos"){openModelEditor(S.alunoId);return}
  if(ir==="comparar"){const m=masterId();S.comp=Object.assign(S.comp||{met:"forca",dias:90,modo:"grafico"},{ids:[S.alunoId].concat(m&&m!==S.alunoId?[m]:[])});S.alunosAba="comparar";S.calDia=null;S.ctxAluno=false;abrir("alunos");return}
  abrir(ir);
}
function renderAlunoCal(){
  const el=$("#alcal-c")||$("#v-alcal");const a=S.aluno;if(!a){el.innerHTML="";return}
  const r=resumoDe(a.id);const h=diaZero();const ult=ultimoTreino(r);const base=ult?ult.date:h;const m=S.alMes||new Date(base.getFullYear(),base.getMonth(),1);
  const fim=new Date(m.getFullYear(),m.getMonth()+1,0),n=fim.getDate();
  const doMes=r?r.s.filter(s=>s.date>=m&&s.date<=fim):[];const set=new Map(doMes.map(s=>[s.date.getDate(),s]));
  let g=["D","S","T","Q","Q","S","S"].map(d=>'<span class="hd">'+d+'</span>').join("");
  for(let i=0;i<m.getDay();i++)g+="<span></span>";
  for(let d=1;d<=n;d++)g+=set.has(d)?'<button class="on" data-d="'+d+'">'+d+'</button>':'<span class="vz">'+d+'</span>';
  let gap=0,ant=null;doMes.forEach(s=>{if(ant)gap=Math.max(gap,diasEntre(ant,s.date));ant=s.date});
  const corridos=Math.max(1,m.getMonth()===h.getMonth()&&m.getFullYear()===h.getFullYear()?h.getDate():n);
  const sel=S.alDia&&set.get(S.alDia)||doMes[doMes.length-1];
  const nome=m.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  el.innerHTML='<div class="card"><div class="cal-h"><button class="btn ghost" id="cm-a" aria-label="Mês anterior">‹</button><b style="text-transform:capitalize">'+esc(nome)+'</b><button class="btn ghost" id="cm-p" aria-label="Próximo mês">›</button></div><div class="cal-g">'+g+'</div></div>'+
    '<div class="calc" style="margin:10px 0"><div class="kpi"><span class="l">Treinos no mês</span><span class="v">'+doMes.length+'</span></div><div class="kpi"><span class="l">Por semana</span><span class="v">'+nf1.format(doMes.length/(corridos/7))+'</span></div><div class="kpi"><span class="l">Maior intervalo</span><span class="v">'+gap+'<small>dias</small></span></div></div>'+
    (sel?'<div class="card"><b>'+esc(sel.date.toLocaleDateString("pt-BR",{weekday:"long"}))+', '+fmtShort(sel.date)+'</b><br><span class="muted small">'+esc(sel.treino)+' · '+sel.series+' séries · '+nf1.format(sel.vol/1000)+' t</span></div>':'<p class="muted small">'+(r?"Nenhum treino neste mês.":"Lendo os dados…")+'</p>');
  $("#cm-a").onclick=()=>{S.alMes=new Date(m.getFullYear(),m.getMonth()-1,1);S.alDia=null;renderAlunoCal()};
  $("#cm-p").onclick=()=>{S.alMes=new Date(m.getFullYear(),m.getMonth()+1,1);S.alDia=null;renderAlunoCal()};
  el.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{S.alDia=+b.dataset.d;renderAlunoCal()});
}
function renderNavBaixo(){
  const nav=$("#nav-baixo");let itens=null,on="";
  if(S.role==="prof"&&S.view==="alunos"&&!S.alunoForm&&S.alunosAba!=="escolher"){
    on=S.alunosAba==="calendario"?"calendario":S.alunosAba==="comparar"?"comparar":"lista";
    itens=[["lista","squares","Alunos"],["calendario","calendar","Calendário"],["comparar","chart-line","Comparar"],["novo","user-plus","Novo"]];
  }else if(S.role==="prof"&&S.ctxAluno&&["evo","alcal","coach","aval"].includes(S.view)&&!S.avEdit){
    on=S.view;
    itens=[["evo","trending-up","Evolução"],["alcal","calendar","Calendário"],["coach","speakerphone","Coach"],["aval","ruler-measure","Física"],["treinos","clipboard","Treinos"]];
  }
  nav.hidden=!itens;document.body.classList.toggle("tem-nav",!!itens);
  if(!itens)return;
  nav.innerHTML=itens.map(x=>'<button class="'+(x[0]===on?"on":"")+'" data-n="'+x[0]+'"'+(x[0]===on?' aria-current="page"':"")+'>'+Icone(x[1],24)+'<span>'+x[2]+'</span></button>').join("");
  nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{const n=b.dataset.n;
    if(["lista","calendario","comparar"].includes(n)){S.alunosAba=n;S.calDia=null;render();window.scrollTo({top:0})}
    else if(n==="novo"){S.alunoForm={};S.shareFor=null;render();window.scrollTo({top:0})}
    else irAluno(n)});
}

/* ========== AUXILIAR DO COACH (professor) ========== */
const hojeBr=()=>fmtDate(diaZero());
function relatorioDevido(a){
  if(!a.ativo)return false;const r=resumoDe(a.id);if(!r||!r.s.length)return false;
  const h=diaZero(),rec=r.s.filter(s=>diasEntre(s.date,h)<30).length;if(rec<4)return false;
  const base=r.ux?parseDate(r.ux):r.s[0].date;return !!base&&diasEntre(base,h)>=30;
}
function auxFatos(){
  const a=S.aluno;
  return Auxiliar.analisar({rows:S.rows,avals:S.avals,aluno:a,idade:idade(a),exKey,fim:diaZero(),
    bibDoGrupo:g=>window.Metodos?Metodos.bibDoGrupo(g):[],gorduraDe:v=>gorduraDe(v,a)});
}
const parseJson=s=>{try{return s?JSON.parse(s):null}catch(e){return null}};
const MOTIVO_DEC={sem_texto:"Sua decisão foi salva. Para mudar o treino, escreva a mudança na caixa.",nao_aplicar:"Sua decisão foi salva, e o treino não mudou, porque você marcou \"Não vou aplicar\".",nao_liberada:"Sua decisão foi salva, mas o treino não mudou: o aluno ainda não aceitou os termos da IA. Use Montar treinos.",sem_chave:"Sua decisão foi salva, mas o treino não mudou: a IA não está configurada. Use Montar treinos.",limite_do_dia:"Sua decisão foi salva, mas o treino não mudou: o limite de IA de hoje acabou. Use Montar treinos.",falhou:"Sua decisão foi salva, mas o treino não mudou: a IA não respondeu. Salve de novo ou use Montar treinos."};
const MOTIVO_AUX={nao_liberada:"O aluno ainda não aceitou os termos da IA. Abaixo está a análise por regras.",sem_chave:"A IA não está configurada. Abaixo está a análise por regras.",limite_do_dia:"O limite de IA de hoje acabou. Abaixo está a análise por regras.",texto_recusado:"A IA citou números fora dos dados, e o texto foi descartado. Abaixo está a análise por regras.",falhou:"A IA não respondeu agora. Abaixo está a análise por regras."};
async function auxAbrir(){
  const st=S.aux={id:S.alunoId,lista:null,sel:null,chat:[],aviso:"",metodos:null,verMetodos:false};
  try{
    const [d,m]=await Promise.all([callA("auxLer"),Api.call("metodos",{})]);
    if(S.aux!==st)return;
    st.lista=d.relatorios||[];st.metodos=m.metodos||[];st.sel=st.lista.length-1;
    if(S.aluno&&relatorioDevido(S.aluno)&&S.loaded)return auxGerar(false);
  }catch(e){if(S.aux!==st)return;st.lista=st.lista||[];st.aviso=errText(e)}
  if(S.view==="auxil")renderAuxil();
}
async function auxGerar(refazer){
  const st=S.aux;if(!st||st.gerando)return;
  const f=auxFatos();
  if(f.frequencia.treinos<4){st.aviso="São necessários pelo menos 4 treinos nos últimos 30 dias.";renderAuxil();return}
  st.gerando=true;st.aviso="";if(S.view==="auxil")renderAuxil();
  try{
    const d=await callA("auxGerar",{ini:f.periodo.inicio,fim:f.periodo.fim,estrategia:f.regras.estrategia,fatos:f,refazer:!!refazer});
    if(S.aux!==st)return;
    const i=st.lista.findIndex(x=>x.linha===d.relatorio.linha);if(i>=0)st.lista[i]=d.relatorio;else st.lista.push(d.relatorio);
    st.sel=st.lista.indexOf(d.relatorio);st.aviso=MOTIVO_AUX[d.motivo]||"";S.painelAt=0;st.chat=[];
  }catch(e){if(S.aux===st)st.aviso=errText(e)}
  st.gerando=false;if(S.aux===st&&S.view==="auxil")renderAuxil();
}
function renderMetodosAux(el,st){
  const ms=st.metodos||[];
  el.innerHTML='<div class="av-top"><div><h2>Métodos de treino</h2><span class="muted small">A IA só pode sugerir o que você aprovar. Eles ficam na aba "Métodos de treino" do Painel, onde você também pode acrescentar os seus.</span></div></div>'+
    ms.map(m=>'<div class="card aux-m"><div class="st-l"><b>'+esc(m.metodo)+'</b><button class="chip'+(m.aprovado?" on":"")+'" data-l="'+m.linha+'" data-a="'+(m.aprovado?"0":"1")+'">'+(m.aprovado?"Aprovado":"Aprovar")+'</button></div><p>'+esc(m.como)+'</p><p class="muted small"><b>Cuidados:</b> '+esc(m.cuidados)+'</p><p class="muted small"><b>Fonte:</b> '+esc(m.fonte)+'</p></div>').join("")+
    '<div id="jt-box"></div><button class="btn" id="m-ok" style="width:100%">Voltar ao relatório</button>';
  pintarJeito();
  el.querySelectorAll("[data-l]").forEach(b=>b.onclick=async()=>{b.disabled=true;
    try{const d=await Api.call("metodoAprovar",{linha:+b.dataset.l,aprovado:b.dataset.a==="1"});st.metodos=d.metodos;renderMetodosAux(el,st)}catch(e){toast(errText(e));b.disabled=false}});
  $("#m-ok").onclick=()=>{st.verMetodos=false;renderAuxil();window.scrollTo({top:0})};
}
/* Conferência: mostra só os treinos citados, já preenchidos pela IA. Nada é gravado antes de Confirmar. */
function renderConferir(el,st){
  const P=st.proposta;
  const chave=x=>strip(x);
  const estado=(t,it)=>{const a=t.antes.find(r=>chave(r[0])===chave(it.ex));if(!a)return "novo";return String(a[1])===String(it.series)&&String(a[2]||"")===String(it.metas)&&String(a[3]||"")===String(it.peso)?"":"mudou"};
  el.innerHTML='<div class="av-top"><div><h2>Conferir mudança</h2><span class="muted small">Revise e corrija o que precisar. Nada muda no treino antes de você confirmar.</span></div></div>'+
    '<div class="card aux-b"><h3 class="dia-t">Você escreveu</h3><p>'+esc(P.texto)+'</p>'+(P.aviso?'<p class="aux-al">'+esc(P.aviso)+'</p>':"")+'</div>'+
    P.treinos.map((t,ti)=>{const saiu=t.antes.filter(r=>!t.itens.some(it=>chave(it.ex)===chave(r[0])));
      return '<div class="card cf-t"><div class="st-l"><h3 class="dia-t" style="margin:0">'+esc(t.nome)+'</h3><button class="btn ghost cf-fora" data-t="'+ti+'">Não mudar este treino</button></div>'+
      t.itens.map((it,i)=>{const e=estado(t,it);const foco=!e&&(t.foco||[]).includes(it.ex);return '<div class="cf-l'+(e||foco?" cf-m":"")+'"><div class="cf-top">'+(e?'<span class="pill '+(e==="novo"?"good":"warn")+'">'+(e==="novo"?"Novo":"Mudou")+'</span>':foco?'<span class="pill">Músculo citado</span>':'<span class="muted small">Sem mudança</span>')+'<button class="btn ghost cf-x" data-t="'+ti+'" data-i="'+i+'" aria-label="Remover '+esc(it.ex)+'">Remover</button></div>'+
        '<label class="cf-f">Exercício<input data-t="'+ti+'" data-i="'+i+'" data-c="ex" value="'+esc(it.ex)+'"></label><div class="cf-g"><label class="cf-f">Séries<input inputmode="numeric" data-t="'+ti+'" data-i="'+i+'" data-c="series" value="'+esc(it.series)+'"></label><label class="cf-f">Repetições<input data-t="'+ti+'" data-i="'+i+'" data-c="metas" value="'+esc(it.metas)+'"></label><label class="cf-f">Carga<input data-t="'+ti+'" data-i="'+i+'" data-c="peso" value="'+esc(it.peso)+'" placeholder="Preencher"></label></div></div>'}).join("")+
      (saiu.length?'<p class="cf-saiu"><b>Sai do treino:</b> '+saiu.map(r=>esc(r[0])).join(", ")+'</p>':"")+
      '<button class="btn cf-add" data-t="'+ti+'">+ Exercício</button></div>'}).join("")+
    '<p class="setup-msg bad" id="cf-msg" role="status"></p>'+
    '<div class="row-btns"><button class="btn primary" id="cf-ok">Confirmar e salvar</button><button class="btn" id="cf-no">Cancelar</button></div>';
  el.querySelectorAll("input[data-c]").forEach(n=>n.addEventListener("input",()=>{P.treinos[+n.dataset.t].itens[+n.dataset.i][n.dataset.c]=n.value}));
  el.querySelectorAll(".cf-x").forEach(b=>b.onclick=()=>{P.treinos[+b.dataset.t].itens.splice(+b.dataset.i,1);renderConferir(el,st)});
  el.querySelectorAll(".cf-add").forEach(b=>b.onclick=()=>{P.treinos[+b.dataset.t].itens.push({ex:"",series:"3",metas:"",peso:""});renderConferir(el,st)});
  el.querySelectorAll(".cf-fora").forEach(b=>b.onclick=()=>{P.treinos.splice(+b.dataset.t,1);if(P.treinos.length)renderConferir(el,st);else{st.proposta=null;st.retorno="Nada foi alterado no treino.";renderAuxil()}});
  $("#cf-no").onclick=()=>{st.proposta=null;st.retorno="Nada foi alterado no treino.";render();window.scrollTo({top:0})};
  $("#cf-ok").onclick=async()=>{
    const msg=$("#cf-msg"),bt=$("#cf-ok");
    for(const t of P.treinos)for(const it of t.itens){const n=parseInt(it.series,10);if(String(it.ex).trim()&&!(n>=1&&n<=20)){msg.textContent="Séries de \""+it.ex+"\" precisa ser um número de 1 a 20.";return}}
    if(!navigator.onLine){msg.textContent="Sem internet. A mudança continua aqui; confirme quando a conexão voltar.";return}
    const conhecidos=new Set((S.catalogo||[]).map(r=>strip(r[0])).concat([...S.exMap.keys()]));
    const novos=[];P.treinos.forEach(t=>t.itens.forEach(it=>{const k=strip(it.ex);if(k&&!conhecidos.has(k)){conhecidos.add(k);novos.push([String(it.ex).trim(),guessGroup(it.ex)])}}));
    bt.disabled=true;bt.textContent="Salvando…";msg.textContent="";
    try{
      const d=await callA("auxConfirmar",{linha:P.linha,treinos:P.treinos.map(t=>({nome:t.nome,linhas:t.itens.map(it=>[it.ex,it.series,it.metas,it.peso])})),exerciciosNovos:novos});
      if(S.aux!==st)return;
      const rel=st.lista.find(x=>x.linha===P.linha);if(rel)rel.mudancas=d.mudancas;
      novos.forEach(x=>S.exMap.set(strip(x[0]),x[1]));S.catalogo=(S.catalogo||[]).concat(novos);
      st.proposta=null;st.retorno="";await fetchDados();toast("Treino alterado");window.scrollTo({top:0});render();
    }catch(e){msg.textContent=errText(e)+(e.sent?" Confira o treino em Montar treinos antes de tentar de novo.":"");bt.disabled=false;bt.textContent="Confirmar e salvar"}
  };
}
function renderAuxil(){
  const el=$("#v-auxil");
  if(!S.aluno){el.innerHTML='<div class="empty">Escolha um aluno.</div>';return}
  if(!S.loaded){el.innerHTML='<div class="empty">Lendo a planilha…</div>';return}
  if(!S.aux||S.aux.id!==S.alunoId){el.innerHTML='<div class="empty">Abrindo o Auxiliar…</div>';auxAbrir();return}
  const st=S.aux;
  if(st.lista==null){el.innerHTML='<div class="empty">Abrindo o Auxiliar…</div>';return}
  if(st.verMetodos)return renderMetodosAux(el,st);
  if(st.proposta)return renderConferir(el,st);
  const rel=st.lista[st.sel];const f=rel?parseJson(rel.fatos):null;const ia=rel?parseJson(rel.ia):null;
  const aprov=(st.metodos||[]).filter(m=>m.aprovado).length;
  const r=resumoDe(S.aluno.id);const base=r&&(r.ux?parseDate(r.ux):r.s.length?r.s[0].date:null);const faltam=base?30-diasEntre(base,diaZero()):null;
  let h='<div class="av-top"><div><h2>Auxiliar do Coach</h2><span class="muted small">Sugestões para você decidir. Nada muda no treino do aluno sozinho.</span></div></div>';
  if(st.aviso)h+='<p class="setup-msg bad">'+esc(st.aviso)+'</p>';
  if(st.gerando)h+='<div class="empty">Analisando os últimos 30 dias…</div>';
  if(!rel&&!st.gerando)h+='<div class="empty">Ainda não há relatório. '+(faltam>0?"O primeiro fica pronto em "+faltam+(faltam===1?" dia":" dias")+" de treino.":"")+'</div>';
  if(st.lista.length>1)h+='<select id="aux-sel" class="aux-sel" aria-label="Escolher relatório">'+st.lista.map((x,i)=>'<option value="'+i+'"'+(i===st.sel?" selected":"")+'>'+esc(x.ini)+" a "+esc(x.fim)+'</option>').join("")+'</select>';
  if(f&&!st.gerando){
    const reg=f.regras||{};const fr=f.frequencia||{};const av=f.avaliacao;
    const bloco=(t,txt,itens)=>(!txt&&!(itens&&itens.length))?"":'<div class="card aux-b"><h3 class="dia-t">'+t+'</h3>'+(txt?'<p>'+esc(txt)+'</p>':"")+(itens&&itens.length?'<ul>'+itens.map(x=>'<li>'+x+'</li>').join("")+'</ul>':"")+'</div>';
    const sinal=n=>n==null?"–":'<span class="'+(n>=0?"aux-up":"aux-dn")+'">'+assinado(n)+'%</span>';
    h+='<div class="card aux-est"><span class="muted small">Estratégia sugerida · '+esc(rel.ini)+' a '+esc(rel.fim)+'</span><b>'+esc(Auxiliar.nomeEstrategia[rel.estrategia]||rel.estrategia)+'</b><p>'+esc(reg.motivo||"")+'</p>'+(reg.sinais||[]).map(s=>'<p class="aux-al">'+esc(s)+'</p>').join("")+(ia&&ia.estrategia?'<p>'+esc(ia.estrategia)+'</p>':"")+'</div>';
    h+=bloco("O que aconteceu",ia&&ia.leitura);
    h+='<div class="calc" style="margin:0 0 10px"><div class="kpi"><span class="l">Treinos</span><span class="v">'+fr.treinos+'</span></div><div class="kpi"><span class="l">Mês anterior</span><span class="v">'+fr.treinosMesAnterior+'</span></div>'+(fr.aderenciaPct!=null?'<div class="kpi"><span class="l">Do previsto</span><span class="v">'+fr.aderenciaPct+'<small>%</small></span></div>':"")+'<div class="kpi"><span class="l">Maior intervalo</span><span class="v">'+fr.maiorIntervaloDias+'<small>dias</small></span></div></div>';
    const porSug=new Map();(reg.carga||[]).forEach(c=>{if(!porSug.has(c.sugestao))porSug.set(c.sugestao,[]);porSug.get(c.sugestao).push(c.exercicio)});
    h+=bloco("Cargas",ia&&ia.carga,[...porSug].map(([s,ex])=>'<b>'+esc(s)+':</b> '+ex.map(esc).join(", ")));
    h+=bloco("Volume",ia&&ia.volume,(reg.volume||[]).map(c=>'<b>'+esc(c.grupo)+':</b> '+esc(c.sugestao)));
    h+=bloco("Exercícios",ia&&ia.exercicios,(reg.trocar||[]).map(c=>'<b>'+esc(c.exercicio)+':</b> sem evolução'+(c.alternativas&&c.alternativas.length?'. Opções: '+c.alternativas.map(esc).join(", "):"")));
    h+=bloco("Método",ia&&ia.metodo?ia.metodo:(aprov?"":"Você ainda não aprovou nenhum método, então a IA não sugere nenhum."));
    if((f.exercicios||[]).length)h+='<details class="av-opc"><summary>Resposta por exercício</summary><div class="comp-t"><table><tr><th></th><th class="r">Treinos</th><th class="r">Sobrando</th><th class="r">Força</th></tr>'+f.exercicios.map(e=>'<tr><td class="aux-n">'+esc(e.nome)+'</td><td class="r">'+e.sessoes+'</td><td class="r">'+(e.rirMedio==null?"–":nf1.format(e.rirMedio))+'</td><td class="r">'+(e.forcaPct==null?"novo":sinal(e.forcaPct))+'</td></tr>').join("")+'</table></div></details>';
    if((f.grupos||[]).length)h+='<details class="av-opc"><summary>Séries por semana em cada grupo</summary><div class="comp-t"><table><tr><th></th><th class="r">Agora</th><th class="r">Antes</th></tr>'+f.grupos.map(g=>'<tr><td>'+esc(g.grupo)+'</td><td class="r">'+nf1.format(g.seriesSemana)+'</td><td class="r">'+nf1.format(g.seriesSemanaAntes)+'</td></tr>').join("")+'</table></div></details>';
    if(av)h+='<details class="av-opc"><summary>Avaliação física de '+esc(av.data)+'</summary><p class="muted small" style="margin:8px 0 0">'+[av.pesoKg!=null?"Peso: "+nf1.format(av.pesoKg)+" kg":"",av.gorduraPct!=null?"Gordura: "+nf1.format(av.gorduraPct)+"%":"",av.variacaoPesoKg!=null?"Variação de peso: "+assinado(av.variacaoPesoKg)+" kg":"",av.variacaoCinturaCm!=null?"Variação de cintura: "+assinado(av.variacaoCinturaCm)+" cm":""].filter(Boolean).map(esc).join(" · ")+'</p></details>';
    h+='<div class="card aux-b"><h3 class="dia-t">Sua decisão</h3><div class="chips-l" id="aux-dec">'+["Vou aplicar","Vou ajustar","Não vou aplicar"].map(d=>'<button class="chip'+(rel.decisao===d?" on":"")+'" data-d="'+d+'">'+d+'</button>').join("")+'</div><textarea class="obs" id="aux-obs" style="height:64px;padding:8px 10px;width:100%" placeholder="Ex.: trocar remada baixa por unilateral, 4 séries cada lado">'+esc(rel.obs||"")+'</textarea><p class="muted small" style="margin:6px 0 0">Ao salvar, abre uma página com o treino citado já preenchido, para você conferir. Nada muda antes de você confirmar.</p><div class="row-btns" style="margin-top:8px"><button class="btn primary" id="aux-sal">Salvar e conferir</button><button class="btn" id="aux-mon">Montar treinos</button></div>'+
      (st.retorno?'<p class="setup-msg bad" style="margin-top:8px">'+esc(st.retorno)+'</p>':"")+
      (rel.mudancas?'<div class="aux-feito"><b>O que mudou no treino</b>'+rel.mudancas.split("\n").map(l=>'<p>'+esc(l)+'</p>').join("")+'<button class="btn" id="aux-desf">Desfazer</button></div>':"")+'</div>';
    h+='<div class="card aux-b"><h3 class="dia-t">Conversar sobre este aluno</h3><div id="aux-chat">'+st.chat.map(m=>'<p class="aux-c '+m.papel+'">'+esc(m.texto)+(m.papel==="ia"&&m.confere===false?'<small>Confira: esta resposta cita um número que não está nos dados.</small>':"")+'</p>').join("")+(st.pensando?iaLendo("O coach está lendo os treinos e a sua pergunta."):"")+'</div><textarea class="obs" id="aux-p" style="height:64px;padding:8px 10px;width:100%" placeholder="Ex.: o que você faria com o supino?">'+esc(st.rascunho||"")+'</textarea><button class="btn primary" id="aux-env" style="width:100%;margin-top:8px"'+(st.pensando?" disabled":"")+'>Enviar</button></div>';
  }
  h+='<div class="row-btns" style="margin-top:4px"><button class="btn" id="aux-met">Métodos ('+aprov+(aprov===1?' aprovado':' aprovados')+')</button><button class="btn" id="aux-ger"'+(st.gerando?" disabled":"")+'>Gerar agora</button></div>';
  el.innerHTML=h;
  const on=(id,ev,fn)=>{const n=$("#"+id);if(n)n[ev]=fn};
  on("aux-sel","onchange",e=>{st.sel=+e.target.value;st.chat=[];renderAuxil()});
  on("aux-met","onclick",()=>{st.verMetodos=true;renderAuxil();window.scrollTo({top:0})});
  on("aux-ger","onclick",()=>auxGerar(true));
  on("aux-mon","onclick",()=>openModelEditor(S.alunoId));
  el.querySelectorAll("#aux-dec .chip").forEach(b=>b.onclick=()=>{rel.decisao=b.dataset.d;rel.obs=$("#aux-obs").value;el.querySelectorAll("#aux-dec .chip").forEach(c=>c.classList.toggle("on",c===b))});
  on("aux-sal","onclick",async()=>{rel.obs=$("#aux-obs").value;const bt=$("#aux-sal");bt.disabled=true;bt.textContent="Preparando…";
    try{const d=await callA("auxDecidir",{linha:rel.linha,decisao:rel.decisao||"",observacao:rel.obs});
      if(S.aux!==st)return;
      if(d.proposta){st.retorno="";st.proposta={linha:rel.linha,texto:rel.obs,resumo:d.proposta.resumo,aviso:d.proposta.aviso||"",treinos:d.proposta.treinos.map(t=>({nome:t.nome,foco:t.foco||[],antes:t.antes,itens:t.itens.map(x=>({ex:x[0],series:x[1],metas:x[2]||"",peso:x[3]||""}))}))};window.scrollTo({top:0});render();return}
      st.retorno=d.aplicado?"":(d.duvida||MOTIVO_DEC[d.motivo]||"Sua decisão foi salva, mas o treino não mudou.");
      if(d.aplicado)rel.mudancas=d.mudancas||"";toast(d.aplicado?"Essa mudança já estava aplicada":"O treino não mudou");
    }catch(e){st.retorno=errText(e)+" Confira o treino em Montar treinos antes de tentar de novo."}
    if(S.aux===st&&S.view==="auxil")renderAuxil()});
  on("aux-desf","onclick",async()=>{const bt=$("#aux-desf");bt.disabled=true;
    try{await callA("auxDesfazer",{linha:rel.linha});rel.mudancas="";st.retorno="";await fetchDados();toast("Treino voltou como estava")}catch(e){toast(errText(e));bt.disabled=false}
    if(S.aux===st&&S.view==="auxil")renderAuxil()});
  const p=$("#aux-p");if(p)p.addEventListener("input",()=>{st.rascunho=p.value});
  on("aux-env","onclick",async()=>{const q=String(st.rascunho||"").trim();if(!q||st.pensando)return;
    const hist=st.chat.slice();st.chat.push({papel:"eu",texto:q});st.rascunho="";st.pensando=true;renderAuxil();
    try{const d=await callA("auxChat",{pergunta:q,historico:hist,fatos:f,});
      if(S.aux!==st)return;
      st.chat.push(d.resposta?{papel:"ia",texto:d.resposta,confere:d.confere}:{papel:"ia",texto:MOTIVO_AUX[d.motivo]?MOTIVO_AUX[d.motivo].replace(" Abaixo está a análise por regras.",""):"Sem resposta agora."});
    }catch(e){st.chat.push({papel:"ia",texto:errText(e)})}
    st.pensando=false;if(S.aux===st&&S.view==="auxil")renderAuxil()});
}

/* ========== navegação ========== */
const VIEWS=["fin","inicio","alunos","aluno","alcal","auxil","lancar","coach","evo","aval","perfil","config"];
const TITULOS={fin:"Financeiro",auxil:"Auxiliar do Coach",alcal:"Calendário",alunos:"Alunos",lancar:"Treinar",coach:"Avaliação do Coach",evo:"Evolução",aval:"Avaliação física",perfil:"Perfil",config:"Configurações"};
function setView(v){
  if(!VIEWS.includes(v))v="inicio";
  if(["alunos","aluno","alcal","auxil"].includes(v)&&S.role!=="prof")v="inicio";
  if(v==="inicio")S.ctxAluno=false;
  S.view=v;
  VIEWS.forEach(x=>{$("#v-"+x).hidden=x!==v});
  // o botão Voltar do celular leva para a tela inicial, sem sair do app
  const dentro=history.state&&history.state.dt;
  if(v!=="inicio"&&!dentro)history.pushState({dt:1},"");
  else if(v==="inicio"&&dentro)history.back();
  render();
}
function abrir(v){S.fim=false;window.scrollTo({top:0});setView(v)}
// Para onde o Voltar leva. Devolve false quando só troca de página dentro de Alunos.
function destinoVoltar(){
  if(S.role==="prof"){
    if(S.view==="alunos"){
      if(S.alunoForm){S.alunoForm=null;return "alunos"}
      if(S.calDia){S.calDia=null;return "alunos"}
      if(S.alunosAba&&S.alunosAba!=="lista"){S.alunosAba="lista";return "alunos"}
      return "inicio";
    }
    if(S.view==="aluno")return "alunos";
    if(S.view==="fin"){
      if(S.finEdit){S.finEdit=false;return "fin"}
      if(S.finPag){S.finPag=false;return "fin"}
      if(S.finAluno){const de=S.finDe;S.finAluno=null;S.finDe="";return de==="aluno"?"aluno":"fin"}
      return "inicio";
    }
    if(S.view==="auxil"&&S.aux&&S.aux.proposta){S.aux.proposta=null;S.aux.retorno="Nada foi alterado no treino.";return "auxil"}
    if(S.view==="auxil"&&S.aux&&S.aux.verMetodos){S.aux.verMetodos=false;return "auxil"}
    if(S.ctxAluno&&["evo","alcal","auxil","coach","aval","perfil","lancar"].includes(S.view))return "aluno";
  }
  S.alunoForm=null;return "inicio";
}
function voltar(){
  if(S.fim){S.fim=false;render();window.scrollTo({top:0});return}
  abrir(destinoVoltar());
}
window.addEventListener("popstate",()=>{
  if(S.fim){S.fim=false;history.pushState({dt:1},"");render();return}
  if(S.view!=="inicio"){const d=destinoVoltar();window.scrollTo({top:0});if(d!=="inicio")history.pushState({dt:1},"");setView(d)}
});
$("#b-voltar").innerHTML=Icone("arrow-left",24);$("#b-voltar").onclick=voltar;
$("#b-refresh").innerHTML=Icone("refresh",22);
$("#b-config").innerHTML=Icone("settings",22);$("#b-config").onclick=()=>{if(S.view!=="config")abrir("config")};

/* ---- tema: só claro ou escuro, escolhido por cada pessoa ---- */
function temaAtual(){const t=document.documentElement.getAttribute("data-theme");return t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}
function aplicarCorBarra(){const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",css("--bar"))}
function setTema(t){document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("dt2-tema",t)}catch(e){}aplicarCorBarra()}

/* ---- topo e tela inicial ---- */
// Uma frase por dia, para animar na tela inicial.
const FRASES=["Vamos pra cima! Hoje é dia de treinão! 💪","Bora! O treino de hoje vai render! 💪","Hoje é dia de fazer bonito! 💪","Foco no treino, o resto a gente resolve depois! 💪","Mais um dia para ficar mais forte! 💪","Chegou a hora, vamos com tudo! 💪","Treino bom é treino feito. Bora! 💪"];
function fraseDoDia(){const h=new Date();return FRASES[Math.floor(new Date(h.getFullYear(),h.getMonth(),h.getDate())/864e5)%FRASES.length]}
function primeiroNome(a){return String(a&&a.nome||"").trim().split(/\s+/)[0]}
function renderTopo(){
  const home=S.view==="inicio";
  document.documentElement.setAttribute("data-genero",/^f/i.test(String(S.aluno&&S.aluno.sexo||""))?"f":"m");
  $("#b-voltar").hidden=home;
  let t=TITULOS[S.view]||"Diário de Treino";
  if(S.view==="lancar"){if(S.fim)t="Concluir treino";else if(S.modEdit&&S.role==="prof")t="Montar treinos";else if(S.draft&&!S.picker)t=S.draft.treino}
  if(S.view==="aluno"&&S.aluno)t=S.aluno.nome;
  if(S.view==="auxil"&&S.aux&&S.aux.proposta)t="Conferir mudança";
  if(S.view==="alunos"&&!S.alunoForm)t={calendario:"Calendário",comparar:"Comparar",escolher:"Quem aparece"}[S.alunosAba]||t;
  $("#top-titulo").textContent=t;
  const sub=$("#top-sub");const verSub=!home&&S.role==="prof"&&S.ctxAluno&&S.aluno&&!["alunos","aluno","config"].includes(S.view);
  sub.hidden=!verSub;sub.textContent=verSub?"Aluno: "+S.aluno.nome:"";
  const sa=$("#saudacao");sa.hidden=!home;
  if(home){
    const nome=primeiroNome(S.aluno);
    sa.innerHTML='<b>Olá, <i class="nome-g" style="font-style:normal">'+esc(nome||(S.role==="prof"?"professor":""))+'</i></b><small>Vamos treinar!</small><span>'+esc(fraseDoDia())+'</span>';
  }
}
function textoTreinar(){
  if(!S.alunoId)return S.role==="prof"?"Escolha um aluno":"Carregando…";
  if(S.draft&&savableSets()>0)return "Continuar: "+S.draft.treino;
  if(!S.loaded)return "Lendo os treinos…";
  const sug=suggestion(templates());
  return sug?"Próximo: "+sug:"Escolher o treino";
}
function renderInicio(){
  if(S.role==="aluno"&&S.aluno&&!S.aluno.cadastroPendente)setTimeout(boasVindas,400);
  const tile=(v,ic,nome)=>'<button class="home-tile" data-ir="'+v+'">'+nome+'<span class="home-ic">'+Icone(ic,58)+'</span></button>';
  if(S.role==="prof"){
    // A primeira tela é sempre do próprio professor: o Treinar nunca grava na planilha de outro aluno.
    const m=masterId();if(m&&S.alunoId!==m)selectAluno(m,true);
    carregarPainel();carregarFin();
    const ativos=S.alunos.filter(a=>a.ativo&&!a.master).length,at=S.alunos.filter(pedeAtencao).length,rel=S.alunos.filter(relatorioDevido).length;
    $("#inicio-tela").innerHTML='<div class="home-wrap"><div class="home-prof">'+
      '<button class="home-hero" data-ir="lancar"><span class="home-halter">'+Icone("barbell",136)+'</span><span><b>Treinar</b><span>'+esc(textoTreinar())+'</span></span></button>'+
      '<div class="home-col">'+tile("coach","speakerphone","Avaliação do Coach")+tile("evo","trending-up","Evolução")+tile("aval","ruler-measure","Avaliação física")+tile("perfil","user-circle","Perfil")+'</div></div>'+
      '<button class="home-alunos" data-ir="alunos">'+Icone("users",28)+'<span><b>Alunos</b>'+ativos+(ativos===1?" ativo":" ativos")+(at?" · "+at+(at===1?" pede atenção":" pedem atenção"):"")+(rel?" · "+rel+(rel===1?" relatório pronto":" relatórios prontos"):"")+'</span>'+Icone("chevron-right",22)+'</button>'+finTile()+'</div>';
    $("#inicio-tela").querySelectorAll("[data-ir]").forEach(b=>b.onclick=()=>{
      if(b.dataset.ir==="alunos"){S.alunoForm=null;S.alunosAba="lista";S.calDia=null;carregarPainel()}
      if(b.dataset.ir==="lancar"){S.picker=false;S.modEdit=null}
      if(b.dataset.ir==="fin"){S.finAluno=b.dataset.a||null;S.finDe="";S.finEdit=false;S.finPag=false;S.ctxAluno=false;carregarFin(true)}
      abrir(b.dataset.ir);
    });
    return;
  }
  $("#inicio-tela").innerHTML='<div class="home-wrap"><div class="home-grid">'+
    '<button class="home-hero" data-ir="lancar"><span class="home-halter">'+Icone("barbell",136)+'</span><span><b>Treinar</b><span>'+esc(textoTreinar())+'</span></span></button>'+
    tile("coach","speakerphone","Avaliação do Coach")+tile("evo","trending-up","Evolução")+
    tile("aval","ruler-measure","Avaliação física")+tile("perfil","user-circle","Perfil")+'</div></div>';
  $("#inicio-tela").querySelectorAll("[data-ir]").forEach(b=>b.onclick=()=>{
    if(b.dataset.ir==="lancar")S.picker=false;
    abrir(b.dataset.ir);
  });
}
function render(){
  document.body.classList.toggle("na-home",S.view==="inicio"&&S.role!=="prof");
  renderTopo();
  renderNavBaixo();
  $("#savebar").hidden=S.view!=="lancar"||!S.draft||S.picker||S.fim||!S.alunoId;
  if(S.view==="inicio")renderInicio();
  else if(S.view==="alunos")renderAlunos();
  else if(S.view==="aluno")renderAlunoPag();
  else if(S.view==="fin")renderFin();
  else if(S.view==="alcal")renderAlunoCal();
  else if(S.view==="auxil")renderAuxil();
  else if(S.view==="lancar")renderLancar();
  else if(S.view==="evo")renderEvo();
  else if(S.view==="aval")renderAval();
  else if(S.view==="config")renderConfig();
  else if(S.view==="coach")renderCoach();
  else renderPerfil();
}
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(S.view==="evo")renderEvo()})}catch(e){}
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.view==="evo")renderEvo()},200)});

/* ========== EVOLUÇÃO EM SETAS ========== */
// O aluno vê setas e nível. O professor escolhe entre setas e gráfico.
const evoModo=()=>S.role==="prof"?(store("dt2-evo-modo")||"grafico"):"setas";
function chaveEvo(){
  if(S.role!=="prof")return "";const m=evoModo();
  return '<span class="chave" role="group" aria-label="Como ver a evolução">'+[["setas","Setas"],["grafico","Gráfico"]].map(x=>'<button data-evo="'+x[0]+'" class="'+(x[0]===m?"on":"")+'" aria-pressed="'+(x[0]===m)+'">'+x[1]+'</button>').join("")+'</span>';
}
function ligarChaveEvo(el,fn){el.querySelectorAll("[data-evo]").forEach(b=>b.onclick=()=>{store("dt2-evo-modo",b.dataset.evo);fn()})}
function pontosNivel(rows){
  const dias=new Set(),melhor={};let rec=0;
  rows.slice().sort((a,b)=>a.date-b.date).forEach(r=>{if(!r.done)return;dias.add(r.dateS+"|"+r.treino);const k=exKey(r.ex);if(!r.e1)return;if(melhor[k]&&r.e1>melhor[k]+.5)rec++;if(!melhor[k]||r.e1>melhor[k])melhor[k]=r.e1});
  const p=dias.size*10+rec*15;return {p,nivel:Math.floor(p/100)+1,resto:p%100};
}
function evoExercicios(rows,dias){
  const corte=new Date(Date.now()-dias*864e5),por=new Map();
  rows.forEach(r=>{
    if(!r.done||r.date<corte||/^cardio$/i.test(r.grupo||"")||/aquec/i.test(r.ex))return;
    const k=exKey(r.ex);if(!por.has(k))por.set(k,{nome:r.ex,d:new Map()});
    const o=por.get(k).d,atual=o.get(r.dateS),sc=r.e1||r.reps[0];
    if(!atual||sc>atual.sc)o.set(r.dateS,{sc,date:r.date,peso:r.pesoN?r.pesoN[0]:null,reps:r.reps[0]});
  });
  const out=[];
  por.forEach(x=>{
    if(x.d.size<2)return;
    const l=[...x.d.values()].sort((a,b)=>a.date-b.date),a=l[0],b=l[l.length-1];
    let txt,ini,fim;
    if(a.peso&&b.peso&&a.peso!==b.peso){ini=a.peso;fim=b.peso;txt=nf1.format(ini)+" → "+nf1.format(fim)+" kg"}
    else{ini=a.reps;fim=b.reps;txt=(b.peso?nf1.format(b.peso)+" kg: ":"")+ini+" → "+fim+" reps"}
    out.push({nome:x.nome,txt,pct:ini?Math.round((fim-ini)/ini*100):0,dir:Math.sign(fim-ini)});
  });
  return out.sort((a,b)=>b.pct-a.pct);
}
function linhaSeta(nome,txt,dir,bom,pct,fala){
  const cl=bom==null?"flat":bom?"up":"dn";
  return '<div class="ev"><span class="ev-a '+cl+'" aria-hidden="true">'+(dir>0?"↑":dir<0?"↓":"=")+'</span><div class="ev-n"><b>'+esc(nome)+'</b><span class="muted small">'+esc(txt)+'</span></div>'+
    '<div class="ev-p '+cl+'"><b>'+(pct>0?"+":pct<0?"−":"")+Math.abs(pct)+'%</b><span class="muted small">'+esc(fala)+'</span></div></div>';
}
function evoCorpo(){
  const ser=avalSeries();if(ser.length<2)return "";
  const a=S.aluno||{},obj=strip(a.objetivo||"");
  const pesoBom=/emagrec/.test(obj)?-1:/hipertrof|massa|forca/.test(obj)?1:0;
  const it=[["Peso",x=>x.peso,"kg",pesoBom],["% de gordura",x=>x.gord,"%",-1],["Massa magra",x=>x.magra,"kg",1],["Cintura",x=>Body.num(x.a.v["Cintura (cm)"]),"cm",-1]];
  const h=it.map(([n,f,u,sent])=>{
    const vs=ser.map(f).filter(v=>v!=null&&isFinite(v));if(vs.length<2)return "";
    const i=vs[0],z=vs[vs.length-1],dir=Math.abs(z-i)<.05?0:Math.sign(z-i);
    return linhaSeta(n,nf1.format(i)+" → "+nf1.format(z)+" "+u,dir,dir===0?null:sent===0?null:dir===sent,i?Math.round((z-i)/i*100):0,dir>0?"aumentou":dir<0?"reduziu":"manteve");
  }).join("");
  return h?'<div class="card evo-c"><h3 class="dia-t">Corpo</h3>'+h+'</div>':"";
}
function evoSetasHtml(){
  if(!S.loaded)return '<div class="empty">Lendo os dados…</div>';
  const n=pontosNivel(S.rows),ex=evoExercicios(S.rows,90);
  const linha=e=>linhaSeta(e.nome,e.txt,e.dir,e.dir===0?null:e.dir>0,e.pct,e.dir>0?"você progrediu":e.dir<0?"teve perda":"manteve");
  return '<div class="card evo-c"><div class="ev-lv"><b>Nível '+n.nivel+'</b><span class="muted small">'+n.resto+' de 100 pontos para o próximo</span></div><div class="ev-bar"><i style="width:'+n.resto+'%"></i></div><p class="muted small" style="margin:6px 0 0">Cada treino vale 10 pontos e cada recorde, 15.</p></div>'+
    '<div class="card evo-c"><h3 class="dia-t">Últimos 3 meses</h3>'+(ex.length?ex.slice(0,8).map(linha).join("")+(ex.length>8?'<details class="others"><summary>Ver todos ('+ex.length+')</summary>'+ex.slice(8).map(linha).join("")+'</details>':""):'<p class="muted small" style="margin:0">Faça o mesmo exercício em pelo menos 2 treinos para ver a sua evolução.</p>')+'</div>'+evoCorpo();
}

/* ========== GRÁFICOS DA AVALIAÇÃO E OBJETIVO DE PESO ========== */
function graficosAval(gord,magra,gorda){
  if(!isFinite(gord)||!isFinite(magra)||!isFinite(gorda))return "";
  const C=2*Math.PI*42,fat=Math.max(0,Math.min(100,gord))/100*C,alto=Math.max(magra,gorda)||1;
  const barra=(v,cor,nome)=>'<div class="ag-b"><b>'+nf1.format(v)+' kg</b><i style="height:'+Math.max(6,Math.round(v/alto*110))+'px;background:var('+cor+')"></i><span>'+nome+'</span></div>';
  return '<div class="ag-grid"><div class="card ag-c"><h3 class="dia-t">% de gordura</h3><div class="ag-leg"><span><i style="background:var(--action)"></i>Massa magra<b>'+nf1.format(100-gord)+'%</b></span><span><i style="background:var(--warn)"></i>Gordura<b>'+nf1.format(gord)+'%</b></span></div>'+
    '<svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label="Gordura '+nf1.format(gord)+'%, massa magra '+nf1.format(100-gord)+'%"><circle cx="60" cy="60" r="42" fill="none" stroke="var(--action)" stroke-width="22"/><circle cx="60" cy="60" r="42" fill="none" stroke="var(--warn)" stroke-width="22" stroke-dasharray="'+fat.toFixed(1)+' '+(C-fat).toFixed(1)+'" transform="rotate(-90 60 60)"/></svg></div>'+
    '<div class="card ag-c"><h3 class="dia-t">Massa magra x massa gorda</h3><div class="ag-bars">'+barra(magra,"--action","Massa magra")+barra(gorda,"--warn","Massa gorda")+'</div></div></div>';
}
// Estimativa: ao emagrecer, quem treina tende a ganhar um pouco de massa magra; o limite é um % de gordura saudável.
function estimarPeso(peso,gord,alvo,sexo){
  const gordaA=peso*gord/100,magraA=peso-gordaA,piso=/^f/i.test(String(sexo||""))?18:10;
  let magraF,limite=false;
  if(alvo<peso){
    magraF=magraA+Math.min(3,Math.round((peso-alvo)*.18*2)/2);
    if((alvo-magraF)/alvo*100<piso){magraF=alvo*(1-piso/100);limite=true}
  }else magraF=magraA+(alvo-peso)*.6;
  const gordaF=alvo-magraF;
  return {gordura:gordaF-gordaA,magra:magraF-magraA,pct:gordaF/alvo*100,limite};
}
const sinalKg=v=>(v>0?"+":v<0?"−":"")+nf1.format(Math.abs(v))+" kg";
function estimativaHtml(peso,gord){
  const a=S.aluno||{},prof=S.role==="prof",alvo=Body.num(a.pesoMeta);
  if(!isFinite(peso)||!isFinite(gord)||(!prof&&!isFinite(alvo)))return "";
  return '<div class="card est-c" id="est" data-peso="'+peso+'" data-gord="'+gord+'"><h3 class="dia-t">Objetivo de peso</h3>'+
    '<div class="st-l est-l"><span>Hoje</span><b>'+nf1.format(peso)+' kg · '+nf1.format(gord)+'% de gordura</b></div>'+
    '<div class="st-l est-l"><span>Quer chegar em</span>'+(prof?'<span class="est-in"><input id="est-alvo" inputmode="decimal" value="'+esc(a.pesoMeta||"")+'" placeholder="ex.: 69" aria-label="Peso desejado em kg"> kg</span>':'<b>'+nf1.format(alvo)+' kg</b>')+'</div>'+
    '<div id="est-res"></div></div>';
}
function pintarEstimativa(){
  const c=$("#est"),r=$("#est-res");if(!c||!r)return;
  const i=$("#est-alvo"),alvo=Body.num(i?i.value:(S.aluno||{}).pesoMeta),peso=+c.dataset.peso,gord=+c.dataset.gord;
  if(!isFinite(alvo)||alvo<30||alvo>300){r.innerHTML='<p class="muted small" style="margin:8px 0 0">Digite o peso desejado para ver a estimativa.</p>';return}
  const e=estimarPeso(peso,gord,alvo,(S.aluno||{}).sexo);
  const k=(v,t)=>'<div class="kpi"><span class="v">'+v+'</span><span class="l">'+t+'</span></div>';
  r.innerHTML='<div class="calc est-k">'+k(sinalKg(e.gordura),"de gordura")+k(sinalKg(e.magra),"de massa magra")+k(nf1.format(e.pct)+"%","de gordura no fim")+'</div>'+
    (e.limite?'<p class="aux-al" style="margin:8px 0 0">Esse peso é muito baixo para este corpo: chegar nele faria perder massa magra.</p>':"")+
    '<p class="muted small" style="margin:8px 0 0">Conta aproximada, feita com esta avaliação. É uma estimativa, não uma promessa.</p>';
}
function ligarEstimativa(){
  pintarEstimativa();
  const i=$("#est-alvo");if(!i)return;
  i.addEventListener("input",pintarEstimativa);
  i.addEventListener("change",async()=>{
    try{const r=await Api.call("salvarAluno",{dados:{id:S.alunoId,pesoMeta:i.value.trim()}});S.aluno=Object.assign({},S.aluno,r.aluno);
      const x=S.alunos.find(y=>y.id===S.alunoId);if(x)x.pesoMeta=r.aluno.pesoMeta;toast("Objetivo de peso salvo")}catch(e){toast(errText(e))}
  });
}

/* ========== FINANCEIRO (professor, versão paga) ========== */
const PLANOS_FIN=[["Mensal",1],["Trimestral",3],["Semestral",6],["Anual",12],["Aula avulsa",0]];
const FORMAS_FIN=["Pix","Dinheiro","Cartão","Transferência","Boleto","Outra"];
const brl=n=>"R$ "+new Intl.NumberFormat("pt-BR",{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n);
const avulsa=p=>p.plano==="Aula avulsa";
const mesesPlano=p=>(PLANOS_FIN.find(x=>x[0]===p.plano)||[0,0])[1];
const diasAte=br=>{const d=parseDate(br);return d?Math.round((d-diaZero())/864e5):null};
function carregarFin(forca){
  if(S.role!=="prof")return;
  if(!S.fin){const c=Api.cacheGet("fin");if(c)S.fin=c}
  if(S.finLendo||(!forca&&S.finAt&&Date.now()-S.finAt<120000))return;
  S.finLendo=true;
  Api.call("finLer").then(d=>{S.fin=d;S.finAt=Date.now();Api.cacheSet("fin",d);if(["inicio","fin"].includes(S.view)&&!S.finEdit&&!S.finPag)render()}).catch(e=>{if(S.view==="fin"&&!S.fin)toast(errText(e))}).finally(()=>{S.finLendo=false});
}
function finGuardar(d){S.fin=d;S.finAt=Date.now();Api.cacheSet("fin",d)}
function finStatus(p){
  if(!p)return {k:"sem",t:"Sem plano",ordem:4};
  if(p.pausado)return {k:"pausa",t:"Pausado",ordem:5};
  if(avulsa(p)){const s=(+p.aulasTotal||0)-(+p.aulasDadas||0);return s<=0?{k:"atraso",t:"Sem aulas",ordem:0,dias:0}:s<=2?{k:"vence",t:"Restam "+s+(s===1?" aula":" aulas"),ordem:1}:{k:"ok",t:"Restam "+s+" aulas",ordem:2}}
  const d=diasAte(p.venc);
  if(d==null)return {k:"sem",t:"Sem vencimento",ordem:4};
  if(d<0)return {k:"atraso",t:-d+(d===-1?" dia de atraso":" dias de atraso"),ordem:0,dias:-d};
  if(d<=7)return {k:"vence",t:d===0?"Vence hoje":d===1?"Vence amanhã":"Vence em "+d+" dias",ordem:1,dias:d};
  return {k:"ok",t:"Em dia",ordem:2};
}
const pillFin=s=>'<span class="pill '+({ok:"good",vence:"warn",atraso:"bad"}[s.k]||"")+'">'+esc(s.t)+'</span>';
function finLista(){
  const m=new Map(((S.fin&&S.fin.planos)||[]).map(p=>[p.alunoId,p]));
  return S.alunos.filter(a=>!a.master&&(a.ativo||m.has(a.id))).map(a=>{const p=m.get(a.id)||null;return {a,p,s:finStatus(p)}})
    .sort((x,y)=>x.s.ordem-y.s.ordem||(x.s.k==="atraso"?(y.s.dias||0)-(x.s.dias||0):(x.s.dias||0)-(y.s.dias||0))||x.a.nome.localeCompare(y.a.nome,"pt-BR"));
}
function finTotais(l){
  const h=diaZero(),mes=(d,i)=>d.getFullYear()===h.getFullYear()&&d.getMonth()===h.getMonth()+i||new Date(h.getFullYear(),h.getMonth()+i,1).getTime()===new Date(d.getFullYear(),d.getMonth(),1).getTime();
  const t={ok:0,vence:0,atraso:0,receber:0,recebido:0,emAtraso:0,prox:[0,0,0]};
  l.forEach(x=>{
    if(x.s.k==="ok")t.ok++;else if(x.s.k==="vence")t.vence++;else if(x.s.k==="atraso")t.atraso++;
    if(!x.p||x.p.pausado||avulsa(x.p))return;
    const v=parseDate(x.p.venc),val=+x.p.valor||0,ms=mesesPlano(x.p);if(!v)return;
    if(x.s.k==="atraso")t.emAtraso+=val;else if(mes(v,0))t.receber+=val;
    for(let k=v,i=0;i<24&&ms;i++,k=new Date(k.getFullYear(),k.getMonth()+ms,k.getDate()))[1,2,3].forEach((o,j)=>{if(mes(k,o))t.prox[j]+=val});
  });
  ((S.fin&&S.fin.pagamentos)||[]).forEach(g=>{const d=parseDate(g.data);if(d&&mes(d,0))t.recebido+=+g.valor||0});
  return t;
}
function finTile(){
  if(!S.fin||!S.fin.ativo)return "";
  const t=finTotais(finLista());
  return '<button class="home-alunos" data-ir="fin">'+Icone("coin",28)+'<span><b>Financeiro</b>'+t.ok+' em dia'+(t.vence?' · <em class="fin-v">'+t.vence+' vence'+(t.vence===1?"":"m")+' em até 7 dias</em>':"")+(t.atraso?' · <em class="fin-a">'+t.atraso+(t.atraso===1?" atrasado":" atrasados")+'</em>':"")+'</span>'+Icone("chevron-right",22)+'</button>'+finAvisos();
}
// Quem vence em até 7 dias ou está atrasado aparece pelo nome na tela inicial.
function finAvisos(){
  const l=finLista().filter(x=>x.s.k==="atraso"||x.s.k==="vence");if(!l.length)return "";
  return '<div class="fin-av">'+l.slice(0,5).map(x=>'<button data-ir="fin" data-a="'+esc(x.a.id)+'"><span>'+esc(x.a.nome)+'</span>'+pillFin(x.s)+'</button>').join("")+(l.length>5?'<button data-ir="fin"><span class="muted small">e mais '+(l.length-5)+'</span></button>':"")+'</div>';
}
function renderFin(){
  const el=$("#v-fin");
  if(!S.fin){el.innerHTML='<div class="empty">Lendo o financeiro…</div>';carregarFin(true);return}
  if(!S.fin.ativo){el.innerHTML='<div class="empty">O Financeiro faz parte da versão paga.</div>';return}
  if(S.finAluno)return renderFinAluno(el);
  const l=finLista(),t=finTotais(l),f=S.finFiltro||"todos",h=diaZero();
  const box=(n,txt,c)=>'<div class="kpi"><span class="v '+c+'">'+n+'</span><span class="l">'+txt+'</span></div>';
  const mesN=i=>new Date(h.getFullYear(),h.getMonth()+i,1).toLocaleDateString("pt-BR",{month:"long"});
  const vis=l.filter(x=>f==="todos"||x.s.k===f);
  el.innerHTML='<div class="calc fin-k">'+box(t.ok,"em dia","fin-ok")+box(t.vence,"vencem em 7 dias","fin-v")+box(t.atraso,"atrasados","fin-a")+'</div>'+
    '<div class="card fin-c"><div class="st-l est-l"><span>A receber em '+mesN(0)+'</span><b>'+brl(t.receber)+'</b></div><div class="st-l est-l"><span>Recebido</span><b>'+brl(t.recebido)+'</b></div><div class="st-l est-l"><span>Em atraso</span><b class="fin-a">'+brl(t.emAtraso)+'</b></div>'+
    '<details class="others"><summary>Previsão dos próximos meses</summary>'+t.prox.map((v,i)=>'<div class="st-l est-l"><span>'+mesN(i+1)+'</span><b>'+brl(v)+'</b></div>').join("")+'</details></div>'+
    '<div class="chips-l" id="fin-f">'+[["todos","Todos"],["atraso","Atrasados"],["vence","Vencem logo"],["ok","Em dia"],["sem","Sem plano"]].map(x=>'<button class="chip'+(x[0]===f?" on":"")+'" data-f="'+x[0]+'">'+x[1]+'</button>').join("")+'</div>'+
    '<div class="card fin-c">'+(vis.length?vis.map(x=>'<button class="fin-l" data-a="'+esc(x.a.id)+'"><span><b>'+esc(x.a.nome)+'</b><span class="muted small">'+(x.p?esc(x.p.plano)+(avulsa(x.p)?"":" · vence "+esc(x.p.venc))+" · "+brl(+x.p.valor||0):"Toque para cadastrar")+'</span></span>'+pillFin(x.s)+'</button>').join(""):'<p class="muted small" style="margin:0">Ninguém nesta lista.</p>')+'</div>'+
    '<div class="card fin-c"><label class="fld2">Minha chave Pix (vai no lembrete do WhatsApp)<input id="fin-pix" value="'+esc(S.fin.pix||"")+'" placeholder="CPF, celular, e-mail ou chave aleatória"></label></div>';
  el.querySelectorAll("#fin-f .chip").forEach(b=>b.onclick=()=>{S.finFiltro=b.dataset.f;renderFin()});
  el.querySelectorAll(".fin-l").forEach(b=>b.onclick=()=>{S.finAluno=b.dataset.a;S.finEdit=false;S.finPag=false;window.scrollTo({top:0});render()});
  $("#fin-pix").addEventListener("change",async e=>{try{finGuardar(await Api.call("finPix",{pix:e.target.value.trim()}));toast("Chave Pix salva")}catch(x){toast(errText(x))}});
}
function waFin(a,p,s){
  const w=waConversa(a);if(!w)return "";
  const nome=primeiroNome(a),pix=S.fin.pix?" Minha chave Pix: "+S.fin.pix+".":"";
  const q=avulsa(p)?"Oi, "+nome+"! Tudo bem? "+(s.k==="atraso"?"Suas aulas do pacote acabaram":s.t+" do seu pacote")+". Quer renovar?"+pix:
    s.k==="atraso"?"Oi, "+nome+"! Tudo bem? Seu plano "+p.plano.toLowerCase()+" de "+brl(+p.valor||0)+" venceu em "+p.venc+"."+pix+" Se já pagou, é só me avisar.":
    "Oi, "+nome+"! Tudo bem? Passando para lembrar que seu plano "+p.plano.toLowerCase()+" de "+brl(+p.valor||0)+" vence em "+p.venc+"."+pix;
  return w+"?text="+encodeURIComponent(q);
}
function reciboFin(a,g){
  const m=S.alunos.find(x=>x.master),q="Recibo: recebi de "+a.nome+" o valor de "+brl(+g.valor||0)+" em "+g.data+", referente ao plano "+String(g.plano||"").toLowerCase()+", por "+String(g.forma||"").toLowerCase()+"."+(m?" "+m.nome+".":"");
  const w=waConversa(a);return w?w+"?text="+encodeURIComponent(q):"";
}
function formFin(el,a,p){
  const o=p||{plano:"Mensal",valor:"",venc:"",forma:"Pix",aulasTotal:"",obs:""};
  el.innerHTML='<div class="av-top"><div><h2>'+esc(a.nome)+'</h2><span class="muted small">'+(p?"Editar plano":"Cadastrar plano")+'</span></div></div><form class="card fin-c" id="fin-form" novalidate>'+
    '<label class="fld2">Plano<select id="ff-plano">'+PLANOS_FIN.map(x=>'<option'+(x[0]===o.plano?" selected":"")+'>'+x[0]+'</option>').join("")+'</select></label>'+
    '<label class="fld2">Valor (R$)<input id="ff-valor" inputmode="decimal" value="'+esc(String(o.valor||"").replace(".",","))+'" placeholder="ex.: 750"></label>'+
    '<label class="fld2" id="ff-v">Vencimento<input id="ff-venc" type="date" value="'+esc(brToIso(o.venc))+'"></label>'+
    '<label class="fld2" id="ff-a">Aulas no pacote<input id="ff-aulas" inputmode="numeric" value="'+esc(o.aulasTotal||"")+'" placeholder="ex.: 10"></label>'+
    '<label class="fld2">Forma de pagamento<select id="ff-forma">'+FORMAS_FIN.map(x=>'<option'+(x===o.forma?" selected":"")+'>'+x+'</option>').join("")+'</select></label>'+
    '<label class="fld2">Observação<input id="ff-obs" value="'+esc(o.obs||"")+'"></label><p class="setup-msg" id="ff-msg" role="status"></p>'+
    '<div class="row-btns"><button class="btn ghost" type="button" id="ff-c">Cancelar</button><button class="btn primary" type="submit" id="ff-ok">Salvar plano</button></div></form>';
  const troca=()=>{const av=$("#ff-plano").value==="Aula avulsa";$("#ff-v").hidden=av;$("#ff-a").hidden=!av};troca();
  $("#ff-plano").onchange=troca;
  $("#ff-c").onclick=()=>{S.finEdit=false;if(!p)S.finAluno=null;render()};
  $("#fin-form").onsubmit=async e=>{
    e.preventDefault();const m=$("#ff-msg"),b=$("#ff-ok"),pl=$("#ff-plano").value,val=Body.num($("#ff-valor").value),av=pl==="Aula avulsa";
    const erro=!(val>0)?"Informe o valor.":!av&&!$("#ff-venc").value?"Informe o vencimento.":av&&!(+$("#ff-aulas").value>0)?"Informe quantas aulas tem o pacote.":"";
    if(erro){m.textContent=erro;m.className="setup-msg bad";return}
    b.disabled=true;
    try{finGuardar(await Api.call("finSalvar",{dados:{alunoId:a.id,nome:a.nome,plano:pl,valor:val,venc:av?"":isoToBr($("#ff-venc").value),forma:$("#ff-forma").value,aulasTotal:av?+$("#ff-aulas").value:"",obs:$("#ff-obs").value.trim()}}));
      S.finEdit=false;toast("Plano salvo");render()}
    catch(x){m.textContent=errText(x);m.className="setup-msg bad";b.disabled=false}
  };
}
function formPagar(el,a,p){
  el.innerHTML='<div class="av-top"><div><h2>'+esc(a.nome)+'</h2><span class="muted small">Registrar pagamento · '+esc(p.plano)+'</span></div></div><form class="card fin-c" id="fp-form" novalidate>'+
    '<label class="fld2">Valor (R$)<input id="fp-valor" inputmode="decimal" value="'+esc(String(p.valor||"").replace(".",","))+'"></label>'+
    '<label class="fld2">Data<input id="fp-data" type="date" value="'+brToIso(fmtDate(new Date()))+'"></label>'+
    '<label class="fld2">Forma de pagamento<select id="fp-forma">'+FORMAS_FIN.map(x=>'<option'+(x===p.forma?" selected":"")+'>'+x+'</option>').join("")+'</select></label>'+
    (avulsa(p)?'<label class="fld2">Aulas compradas agora<input id="fp-aulas" inputmode="numeric" value="" placeholder="ex.: 10"></label>':"")+
    '<p class="setup-msg" id="fp-msg" role="status"></p><div class="row-btns"><button class="btn ghost" type="button" id="fp-c">Cancelar</button><button class="btn primary" type="submit" id="fp-ok">Registrar</button></div></form>';
  $("#fp-c").onclick=()=>{S.finPag=false;render()};
  $("#fp-form").onsubmit=async e=>{
    e.preventDefault();const m=$("#fp-msg"),b=$("#fp-ok"),val=Body.num($("#fp-valor").value);
    if(!(val>0)||!$("#fp-data").value){m.textContent="Informe o valor e a data.";m.className="setup-msg bad";return}
    b.disabled=true;
    try{finGuardar(await Api.call("finPagar",{alunoId:a.id,valor:val,data:isoToBr($("#fp-data").value),forma:$("#fp-forma").value,aulas:avulsa(p)?+($("#fp-aulas").value||0):0}));
      S.finPag=false;const np=S.fin.planos.find(x=>x.alunoId===a.id);toast(avulsa(p)||!np?"Pagamento registrado":"Pagamento registrado. Próximo vencimento: "+np.venc);render()}
    catch(x){m.textContent=errText(x);m.className="setup-msg bad";b.disabled=false}
  };
}
function renderFinAluno(el){
  const a=S.alunos.find(x=>x.id===S.finAluno);if(!a){S.finAluno=null;return renderFin()}
  const p=S.fin.planos.find(x=>x.alunoId===a.id)||null;
  if(!p||S.finEdit)return formFin(el,a,p);
  if(S.finPag)return formPagar(el,a,p);
  const s=finStatus(p),wa=waFin(a,p,s),hist=S.fin.pagamentos.filter(g=>g.alunoId===a.id).slice().reverse();
  const linha=(k,v)=>'<div class="st-l est-l"><span>'+k+'</span><b>'+esc(v)+'</b></div>';
  const saldo=(+p.aulasTotal||0)-(+p.aulasDadas||0),ultimo=hist[0],rec=ultimo?reciboFin(a,ultimo):"";
  el.innerHTML='<div class="av-top"><div><h2>'+esc(a.nome)+'</h2></div>'+pillFin(s)+'</div>'+
    '<div class="card fin-c">'+linha("Plano",p.plano)+linha("Valor",brl(+p.valor||0))+(avulsa(p)?linha("Aulas",p.aulasDadas+" dadas de "+p.aulasTotal+" · restam "+Math.max(0,saldo)):linha("Vencimento",p.venc))+linha("Forma",p.forma)+(p.obs?linha("Observação",p.obs):"")+'</div>'+
    '<div class="fin-btns"><button class="btn primary" id="fa-pag">Registrar pagamento</button>'+
    (avulsa(p)?'<button class="btn" id="fa-aula">Marcar aula dada</button>'+(+p.aulasDadas>0?'<button class="btn ghost" id="fa-aula2">Desfazer última aula</button>':""):"")+
    (wa?'<a class="btn" href="'+esc(wa)+'" target="_blank" rel="noopener">Lembrete no WhatsApp'+(S.fin.pix?", com Pix":"")+'</a>':'<p class="muted small" style="margin:0">Cadastre o WhatsApp do aluno para enviar lembretes.</p>')+
    (rec?'<a class="btn" href="'+esc(rec)+'" target="_blank" rel="noopener">Enviar recibo do último pagamento</a>':"")+
    '<button class="btn" id="fa-paus">'+(p.pausado?"Reativar plano":"Pausar plano")+'</button><button class="btn ghost" id="fa-edit">Editar plano</button>'+
    (s.k==="atraso"||!a.ativo?'<button class="btn ghost" id="fa-acesso">'+(a.ativo?"Pausar o acesso do aluno":"Liberar o acesso do aluno")+'</button>':"")+'</div>'+
    '<div class="card fin-c"><h3 class="dia-t">Pagamentos</h3>'+(hist.length?hist.slice(0,12).map((g,i)=>{const r=reciboFin(a,g);return '<div class="st-l est-l"><span>'+esc(g.data)+' · '+esc(g.forma)+'</span><span class="fin-h"><b>'+brl(+g.valor||0)+'</b>'+(r?'<a class="small" href="'+esc(r)+'" target="_blank" rel="noopener">Recibo</a>':"")+(i===0?'<button class="linkbtn small" id="fa-desf">Desfazer</button>':"")+'</span></div>'}).join(""):'<p class="muted small" style="margin:0">Nenhum pagamento registrado.</p>')+'</div>';
  const acao=async(nome,dados,msg)=>{try{finGuardar(await Api.call(nome,dados));toast(msg);render()}catch(x){toast(errText(x))}};
  $("#fa-pag").onclick=()=>{S.finPag=true;render();window.scrollTo({top:0})};
  $("#fa-edit").onclick=()=>{S.finEdit=true;render();window.scrollTo({top:0})};
  $("#fa-paus").onclick=()=>acao("finPausar",{alunoId:a.id,pausado:!p.pausado},p.pausado?"Plano reativado":"Plano pausado");
  const au=$("#fa-aula");if(au)au.onclick=()=>acao("finAula",{alunoId:a.id,delta:1},"Aula marcada");
  const au2=$("#fa-aula2");if(au2)au2.onclick=()=>acao("finAula",{alunoId:a.id,delta:-1},"Aula desmarcada");
  const de=$("#fa-desf");if(de)de.onclick=e=>armed(e.target,"Toque de novo para desfazer","Desfazer",()=>acao("finDesfazer",{linha:ultimo.linha},"Pagamento desfeito"));
  const ac=$("#fa-acesso");if(ac)ac.onclick=e=>armed(e.target,"Toque de novo para confirmar",ac.textContent,async()=>{
    try{const r=await Api.call("salvarAluno",{dados:{id:a.id,ativo:!a.ativo}});Object.assign(a,r.aluno);toast(a.ativo?"Acesso liberado":"Acesso pausado");render()}catch(x){toast(errText(x))}});
}

/* ========== NÍVEL DO ALUNO E COMEÇO DOS TREINOS ========== */
const NIVEIS=["Iniciante","Intermediário","Avançado"];
// Só um palpite pelos treinos registrados. Quem decide é o professor.
function sugestaoNivel(){
  const ini=new Date(Date.now()-365*864e5);const n=sessions().filter(x=>x.date>=ini&&x.rows.some(r=>r.done)).length;
  return {nivel:n<30?NIVEIS[0]:n<120?NIVEIS[1]:NIVEIS[2],n};
}
function nivelBotoes(a){return '<div class="cm-nv">'+NIVEIS.map(n=>'<button class="btn small'+(a.nivel===n?" primary":"")+'" data-nivel="'+n+'">'+n+'</button>').join("")+'</div>'}
function nivelHtml(a){
  const s=sugestaoNivel();
  return '<div class="card aux-b mp-c" id="nv-box"><h3 class="dia-t">Qual é o nível de '+esc(String(a.nome||"").split(" ")[0])+'?</h3>'+
    '<p class="muted small">'+(s.n?"Pelos "+s.n+(s.n===1?" treino registrado":" treinos registrados")+" no último ano, o app sugere <b>"+s.nivel+"</b>.":"Ainda não há treinos registrados aqui, então a decisão é sua pela avaliação.")+' Quem decide é você.</p>'+nivelBotoes(a)+'</div>';
}
function ligarNivel(root,depois){
  root.querySelectorAll("[data-nivel]").forEach(b=>b.onclick=async()=>{
    const a=S.aluno;if(!a)return;b.disabled=true;
    try{const r=await Api.call("salvarAluno",{dados:{id:a.id,nivel:b.dataset.nivel}});Object.assign(a,r.aluno);
      const i=S.alunos.findIndex(x=>x.id===a.id);if(i>=0)S.alunos[i]=Object.assign({},S.alunos[i],r.aluno);depois()}
    catch(x){toast(errText(x));b.disabled=false}});
}
function planosDoNivel(n){
  const ok=n==="Avançado"?["Intermediário","Todos"]:[n,"Todos"];
  return (window.Metodos?Metodos.planos():[]).filter(p=>ok.includes(p.nivel));
}
// Tira o treino vazio da tela e acrescenta os blocos. Só valem depois de Salvar treinos.
function acrescentarTreinos(M,novos){
  for(let i=M.length-1;i>=0;i--)if(!M[i].itens.some(x=>String(x.ex).trim()))M.splice(i,1);
  M.push(...novos);render();
}
function comecarHtml(a){
  const n=a.nivel;const outros=(S.alunos||[]).filter(x=>x.id!==S.alunoId).sort((x,y)=>(y.nivel===n)-(x.nivel===n)||String(x.nome).localeCompare(y.nome,"pt-BR"));
  const pl=n?planosDoNivel(n):[];
  return '<div class="card aux-b mp-c"><h3 class="dia-t">Começar os treinos</h3>'+
    '<p class="muted small">Escolha um caminho. Tudo cai na lista abaixo para você ajustar, e só vale para o aluno ao tocar em <b>Salvar treinos</b>.</p>'+
    '<div class="par-h">Nível do aluno</div>'+nivelBotoes(a)+
    (n?'<div class="par-h">Treinos prontos para '+esc(n)+'</div>'+(n==="Avançado"?'<p class="muted small">Ainda não há plano só para avançado. Estes servem de base, ou peça ao coach.</p>':"")+
      pl.map(p=>'<div class="mp-f"><span><b>'+esc(p.nome)+'</b><span class="muted small">'+esc(p.dias+" · "+p.local)+'</span></span><button class="btn ghost small" data-plano="'+esc(p.id)+'">Usar</button></div>').join("")
      :'<p class="muted small" style="margin-top:6px">Escolha o nível para ver os treinos prontos.</p>')+
    '<div class="par-h">Copiar de outro aluno</div><div class="mp-l"><select id="cm-de" aria-label="Copiar treinos de qual aluno"><option value="">Escolha o aluno…</option>'+outros.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.nome+(x.nivel?" ("+x.nivel+")":""))+'</option>').join("")+'</select><button class="btn" id="cm-copiar">Copiar</button></div>'+
    '<div class="par-h">Pedir ao coach</div>'+(S.cmNota?'<p class="aux-c ia">'+esc(S.cmNota)+'</p>':"")+
    '<textarea class="obs" id="cm-pedido" style="height:64px;padding:8px 10px;width:100%" placeholder="Opcional: o que você quer nesses treinos" aria-label="Pedido para o coach">'+esc(S.cmPedido||"")+'</textarea>'+
    '<button class="btn" id="cm-ia" style="width:100%;margin-top:6px">O coach monta os blocos</button></div>';
}
function ligarComecar(el,a,M){
  ligarNivel(el,render);
  el.querySelectorAll("[data-plano]").forEach(b=>b.onclick=()=>{const p=Metodos.planos().find(x=>x.id===b.dataset.plano);if(!p)return;
    acrescentarTreinos(M,p.treinos.map(t=>({nome:t.nome,itens:t.exercicios.map(([ex,series,metas])=>({ex,series,metas:String(metas),peso:""}))})));
    toast("Plano "+p.nome+" acrescentado. Ajuste e toque em Salvar treinos.")});
  $("#cm-copiar").onclick=async e=>{
    const de=$("#cm-de").value,btn=e.target;if(!de){toast("Escolha o aluno.");return}
    btn.disabled=true;btn.textContent="Copiando…";
    try{const r=await Api.call("modelosDe",{de});const por=new Map();
      (r.linhas||[]).forEach(l=>{if(!l[0]||!l[1])return;if(!por.has(l[0]))por.set(l[0],[]);por.get(l[0]).push({ex:l[1],series:l[2]||3,metas:String(l[3]||""),peso:""})});
      if(!por.size){toast("Esse aluno ainda não tem treinos.");btn.disabled=false;btn.textContent="Copiar";return}
      acrescentarTreinos(M,[...por.entries()].map(([nome,itens])=>({nome,itens})));
      toast("Copiei "+por.size+(por.size===1?" treino":" treinos")+" sem as cargas, porque cada aluno tem a sua. Ajuste e toque em Salvar treinos.");
    }catch(x){toast(errText(x));btn.disabled=false;btn.textContent="Copiar"}};
  const ped=$("#cm-pedido");ped.addEventListener("input",()=>{S.cmPedido=ped.value});
  $("#cm-ia").onclick=async e=>{
    const btn=e.target;if(!a.nivel){toast("Escolha primeiro o nível do aluno.");return}
    btn.disabled=true;btn.textContent="O coach está montando…";btn.insertAdjacentHTML("beforebegin",iaLendo("O coach está lendo o perfil do aluno e o seu jeito de trabalhar."));
    const nomes={};["Peito","Costas","Ombros","Braços","Inferiores","Abdômen"].forEach(g=>{nomes[g]=[...new Set((window.Metodos?Metodos.bibDoGrupo(g):[]).concat((S.catalogo||[]).filter(r=>r[1]===g).map(r=>r[0])))].slice(0,30)});
    try{const r=await Api.call("metTreinos",{nivel:a.nivel,objetivo:a.objetivo,dias:a.dias,obs:a.obs,pedido:S.cmPedido||"",nomes});
      if(!r.treinos||!r.treinos.length){toast(r.motivo==="limite_do_dia"?"O limite de hoje acabou. Use um treino pronto.":"O coach não conseguiu montar agora. Use um treino pronto.");btn.disabled=false;btn.textContent="O coach monta os blocos";return}
      S.cmNota=r.nota||"";acrescentarTreinos(M,r.treinos.map(t=>({nome:t.nome,itens:t.itens.map(x=>({ex:x[0],series:x[1],metas:x[2],peso:""}))})));
      toast("O coach montou "+r.treinos.length+(r.treinos.length===1?" bloco":" blocos")+". Confira e toque em Salvar treinos.");
    }catch(x){toast(errText(x));btn.disabled=false;btn.textContent="O coach monta os blocos"}};
}

/* ========== MÉTODOS PRONTOS NA MONTAGEM DE TREINOS ========== */
const PARES_BI=[{n:"Bíceps e tríceps",a:/rosca|b[ií]ceps|scott|martelo/i,b:/tr[ií]ceps|franc[eê]s|mergulho|testa/i},{n:"Peito e costas",ga:"Peito",gb:"Costas"},
  {n:"Quadríceps e posterior",a:/extensora|agach|leg press|hack|afundo|b[uú]lgaro|passada/i,b:/flexora|stiff|terra/i},{n:"Ombros e abdômen",ga:"Ombros",gb:"Abdômen"}];
const candidatosBi=(p,lado)=>{const g=lado==="a"?p.ga:p.gb,rx=p[lado];return g?Metodos.bibDoGrupo(g):Metodos.bibNomes().filter(n=>rx.test(n))};
// As fases seguem o objetivo do aluno. O exercício marcado leva o nome do método nas repetições da meta.
const SEQ_FIN=[{n:"ABC",d:"adaptação e progressão de carga",plano:"abc",marca:""},{n:"ABC com drop set",d:"drop set em alguns exercícios",plano:"abc",marca:"drop set"},{n:"AB com rest-pause",d:"mais intensidade",plano:"superior-inferior",marca:"rest pause"}];
const SEQUENCIAS={hipertrofia:SEQ_FIN,
  emagrecimento:[{n:"Corpo inteiro",d:"adaptação",plano:"full-iniciante",marca:""},{n:"Superior e inferior",d:"mais volume por semana",plano:"superior-inferior",marca:""},{n:"ABC com drop set",d:"mais intensidade",plano:"abc",marca:"drop set"}],
  forca:[{n:"Superior e inferior",d:"base de força",plano:"superior-inferior",marca:""},{n:"ABC",d:"mais volume por grupo",plano:"abc",marca:""},{n:"ABC com rest-pause",d:"mais intensidade",plano:"abc",marca:"rest pause"}],
  geral:[{n:"Corpo inteiro",d:"adaptação",plano:"full-iniciante",marca:""},{n:"Superior e inferior",d:"progressão",plano:"superior-inferior",marca:""},{n:"Empurrar, puxar e pernas",d:"mais variedade",plano:"empurrar-puxar-pernas",marca:""}]};
function seqDoAluno(a){const o=strip(a.objetivo||"");return /hipertrof|massa/.test(o)?SEQUENCIAS.hipertrofia:/emagrec/.test(o)?SEQUENCIAS.emagrecimento:/forca/.test(o)?SEQUENCIAS.forca:SEQUENCIAS.geral}
const semMarca=m=>String(m||"").replace(/\s*(drop set|rest pause)\s*$/i,"");
function faseAtual(seq,M){
  const txt=M.flatMap(t=>t.itens.map(i=>String(i.metas))).join(" ").toLowerCase();
  if(!M.some(t=>t.itens.some(i=>String(i.ex).trim())))return -1;
  for(let i=seq.length-1;i>=0;i--)if(seq[i].marca&&txt.includes(seq[i].marca))return i;
  return 0;
}
function marcarFase(treinos,marca){
  treinos.forEach(t=>{
    t.itens.forEach(i=>{i.metas=semMarca(i.metas)});
    if(!marca)return;
    const c=t.itens.filter(i=>!/abd|prancha|aquec|cardio/i.test(i.ex)).pop();if(c)c.metas=c.metas+" "+marca;
  });
  return treinos;
}
function metodosProntosHtml(a){
  const seq=seqDoAluno(a),at=faseAtual(seq,S.modEdit);
  return '<div class="card aux-b mp-c"><h3 class="dia-t">Métodos prontos</h3>'+
    '<p class="muted small">O app monta e você confere. Nada vale para o aluno antes de tocar em <b>Salvar treinos</b>.</p>'+
    '<div class="par-h">Bi-set montado sozinho</div><div class="mp-l"><select id="mp-par" aria-label="Músculos do bi-set">'+PARES_BI.map((p,i)=>'<option value="'+i+'">'+esc(p.n)+'</option>').join("")+'</select>'+
    '<select id="mp-n" aria-label="Quantos pares"><option value="2">2 pares</option><option value="3" selected>3 pares</option><option value="4">4 pares</option></select><button class="btn" id="mp-bi">Montar bi-set</button></div>'+
    '<div class="par-h">Sequência para '+esc(String(a.objetivo||"este aluno").toLowerCase())+'</div>'+
    seq.map((f,i)=>'<div class="mp-f'+(i===at?" on":"")+'"><i>'+(i+1)+'</i><span><b>'+esc(f.n)+'</b><span class="muted small">'+esc(f.d)+(i===at?" · fase atual":"")+'</span></span><button class="btn '+(i===at+1?"":"ghost ")+'small" data-fase="'+i+'">Preparar</button></div>').join("")+'</div>';
}
function ligarMetodosProntos(el,a,M){
  const bi=$("#mp-bi");if(!bi)return;
  const seq=seqDoAluno(a);
  bi.onclick=async()=>{
    const par=PARES_BI[+$("#mp-par").value],n=+$("#mp-n").value,A=candidatosBi(par,"a"),B=candidatosBi(par,"b");
    bi.disabled=true;bi.textContent="Montando…";
    let pares=null;
    try{const r=await Api.call("metMontar",{titulo:par.n,a:A.slice(0,30),b:B.slice(0,30),pares:n,objetivo:a.objetivo||""});pares=r.pares&&r.pares.length?r.pares:null}catch(x){console.warn(x)}
    const peloCoach=!!pares;
    if(!pares)pares=A.slice(0,n).map((x,i)=>[x,B[i]]).filter(p=>p[1]);
    const itens=[];pares.forEach(p=>{itens.push({ex:p[0],series:3,metas:"10 bi-set com "+p[1],peso:""});itens.push({ex:p[1],series:3,metas:"10 bi-set com "+p[0],peso:""})});
    M.push({nome:"Bi-set · "+par.n,itens});render();
    toast((peloCoach?"O coach montou":"Montei pela regra do app")+": confira no fim da lista e toque em Salvar treinos.");
  };
  el.querySelectorAll("[data-fase]").forEach(b=>b.onclick=e=>{
    const i=+b.dataset.fase,f=seq[i],ant=seq[i-1];
    armed(e.target,"Isso troca os treinos da tela. Toque de novo","Preparar",()=>{
      const mesmo=ant&&ant.plano===f.plano&&faseAtual(seq,M)>=0;
      const pl=(window.Metodos?Metodos.planos():[]).find(p=>p.id===f.plano);
      const novos=mesmo?M.map(t=>({nome:t.nome,itens:t.itens.map(x=>Object.assign({},x))})):pl?pl.treinos.map(t=>({nome:t.nome,itens:t.exercicios.map(x=>({ex:x[0],series:x[1],metas:String(x[2]),peso:""}))})):null;
      if(!novos){toast("Não encontrei esse plano. Abra o app com internet e tente de novo.");return}
      M.splice(0,M.length,...marcarFase(novos,f.marca));render();
      toast("Fase "+(i+1)+" preparada. Confira e toque em Salvar treinos.");
    });
  });
}

/* ========== CONVERSA QUE ENSINA O COACH AUXILIAR ========== */
function pintarJeito(){
  const box=$("#jt-box");if(!box)return;
  const J=S.jeito||(S.jeito={regras:null,chat:[],proposta:"",pensando:false});
  if(!J.regras&&!J.lendo){J.lendo=true;Api.call("jeitoLer").then(d=>{J.regras=d.regras;J.lendo=false;pintarJeito()}).catch(()=>{J.lendo=false;J.regras=[];pintarJeito()})}
  const rs=J.regras||[];
  box.innerHTML='<div class="card aux-b"><h3 class="dia-t">Coach Auxiliar</h3><p class="muted small">Ensine o seu jeito de trabalhar. Ele usa isso nas próximas sugestões.</p>'+
    '<div id="jt-chat">'+J.chat.map(m=>'<p class="aux-c '+m.papel+'">'+esc(m.texto)+'</p>').join("")+(J.pensando?iaLendo("O coach está lendo o que você escreveu."):"")+'</div>'+
    (J.proposta?'<div class="jt-prop"><span class="muted small">Vou guardar:</span><input id="jt-regra" value="'+esc(J.proposta)+'" aria-label="Regra que será guardada"><div class="row-btns"><button class="btn primary" id="jt-sim">Guardar</button><button class="btn ghost" id="jt-nao">Não guardar</button></div></div>':"")+
    '<textarea class="obs" id="jt-txt" style="height:64px;padding:8px 10px;width:100%" placeholder="Escreva para o coach…" aria-label="Mensagem para o coach"></textarea><button class="btn" id="jt-env" style="width:100%;margin-top:6px"'+(J.pensando?" disabled":"")+'>Enviar</button>'+
    '<details class="others"'+(J.aberto?" open":"")+'><summary>Meu jeito de trabalhar ('+rs.length+')</summary>'+(rs.length?rs.map(r=>'<div class="jt-r" data-l="'+r.linha+'"><input value="'+esc(r.regra)+'" aria-label="Regra"><button class="x" data-rm aria-label="Apagar regra">×</button></div>').join(""):'<p class="muted small">Ainda não há regras guardadas.</p>')+'</details></div>';
  const guardarRegras=d=>{J.regras=d.regras};
  $("#jt-env").onclick=async()=>{
    const q=$("#jt-txt").value.trim();if(!q)return;
    const hist=J.chat.slice(-6);J.chat.push({papel:"eu",texto:q});J.pensando=true;J.proposta="";pintarJeito();
    try{const r=await Api.call("jeitoChat",{pergunta:q,historico:hist});
      if(r.resposta){J.chat.push({papel:"ia",texto:r.resposta});J.proposta=r.regra||""}
      else{J.chat.push({papel:"ia",texto:r.motivo==="limite_do_dia"?"O limite de conversas de hoje acabou. Se quiser, guarde o que escreveu como regra.":"Não consegui responder agora. Se quiser, guarde o que escreveu como regra."});J.proposta=q.slice(0,160)}
    }catch(x){J.chat.push({papel:"ia",texto:errText(x)})}
    J.pensando=false;pintarJeito();
  };
  const sim=$("#jt-sim");if(sim)sim.onclick=async()=>{const t=$("#jt-regra").value.trim();if(!t)return;sim.disabled=true;
    try{guardarRegras(await Api.call("jeitoSalvar",{regra:t}));J.proposta="";J.aberto=true;J.chat.push({papel:"ia",texto:"Guardei. Vou seguir isso nas próximas sugestões."});pintarJeito()}catch(x){toast(errText(x));sim.disabled=false}};
  const nao=$("#jt-nao");if(nao)nao.onclick=()=>{J.proposta="";pintarJeito()};
  box.querySelector("details").addEventListener("toggle",e=>{J.aberto=e.target.open});
  box.querySelectorAll(".jt-r").forEach(l=>{
    const linha=+l.dataset.l;
    l.querySelector("input").addEventListener("change",async e=>{const t=e.target.value.trim();if(!t)return;try{guardarRegras(await Api.call("jeitoSalvar",{linha,regra:t}));toast("Regra atualizada")}catch(x){toast(errText(x))}});
    l.querySelector("[data-rm]").onclick=e=>armed(e.target,"?","×",async()=>{try{guardarRegras(await Api.call("jeitoApagar",{linha}));toast("Regra apagada");pintarJeito()}catch(x){toast(errText(x))}});
  });
}

/* ========== início ========== */
function showStart(){
  $("#start").hidden=false;setSync("err","Sem acesso");
  const go=()=>{const c=Api.parseLink($("#start-link").value.trim());
    if(!c){$("#start-msg").textContent="Esse não parece ser o link do Diário de Treino. Copie o link inteiro da mensagem.";$("#start-msg").className="setup-msg bad";return}
    Api.setConfig(c);location.hash=$("#start-link").value.trim().split("#")[1]||"";location.reload()};
  $("#start-go").onclick=go;$("#start-link").addEventListener("keydown",e=>{if(e.key==="Enter")go()});
}
function boot(){
  const {cfg,changed,conflict}=Api.fromHash();
  if(!cfg){showStart();return}
  if(conflict){
    history.replaceState(null,"",location.pathname);
    setTimeout(()=>{
      banner('<p>Você abriu o <b>link de um aluno</b> neste celular, que está com o seu <b>acesso de professor</b>. Para não perder o acesso de professor, continuei como professor.</p>'+
        '<button class="btn" id="b-keep">Ok</button><button class="btn ghost" id="b-switch">Entrar como o aluno</button>');
      $("#b-keep").onclick=()=>banner("");
      $("#b-switch").onclick=()=>{sessionStorage.setItem("dt2-trocar","1");Api.setConfig(conflict);location.reload()};
    },300);
  }
  if(changed){Object.keys(localStorage).filter(k=>k.startsWith("dt2-cache-")||k==="dt2-aluno-sel"||k==="dt2-aba").forEach(k=>{try{localStorage.removeItem(k)}catch(e){}})}
  S.role=cfg.p?"prof":"aluno";
  const ci=Api.cacheGet("inicio");
  aplicarCorBarra();
  if(ci)applyInicio(ci,false);
  setView("inicio");
  Metodos.load().then(()=>render());
  refreshInicio();
  setTimeout(installBanner,1500);
  setTimeout(checarAtualizacaoAuto,3000);
}
boot();
})();
