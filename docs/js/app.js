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
const RX=[["Abdômen",/abs|abdom|prancha/],["Ombros",/elevacao lateral|elevacao frontal|desenvolvimento|face ?pull|posterior de ombro|voador reverso|ombro/],
  ["Peito",/supino|voador peito|peito|cross|crucifixo|peck|fly|mergulho|paralela/],["Costas",/pulley|puxada|remada|pull ?down|barra fixa|serrote|costas|lombar/],
  ["Braços",/rosca|triceps|biceps|barra w|scott|martelo|frances|antebraco/],
  ["Inferiores",/extensora|flexora|leg|agach|hack|stiff|panturrilha|pantu|[cs]imeri[ao][nm] 45|vto[mn] 45|adutor|abdutor|glute|afundo|bulgaro|cadeira|mesa|perna|terra|pelvica/]];
function guessGroup(name){const k=strip(name);for(const [g,rx] of RX)if(rx.test(k))return g;return "Sem grupo"}

/* ---------- estado ---------- */
const S={role:null,alunos:[],alunoId:null,aluno:null,rows:[],exMap:new Map(),models:new Map(),avals:[],
  loaded:false,loadedAt:null,error:null,view:"lancar",period:12,groups:new Set(GROUPS.map(g=>g.k)),
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
    out.push({i,date:d,dateS:r[0],dia:r[1]||"",treino:String(r[2]||"").trim(),hora:hor,grupo:r[4]||guessGroup(r[5]),ex:String(r[5]||"").trim(),
      serie:r[6]||"",meta:r[7]||"",feitas:r[8]||"",peso:r[9]||"",int:r[10]||"",rir:r[11]==null?"":String(r[11]),obs:r[12]||"",
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
  ingest(d.historico);
  S.exMap=new Map();(d.exercicios||[]).forEach(r=>{if(r[0])S.exMap.set(strip(r[0]),r[1]||"")});
  S.exList=(d.exercicios||[]).map(r=>String(r[0]||"").trim()).filter(Boolean);
  ingestModels(d.modelos);
  ingestAvals(d.avaliacoes);
  if(d.aluno)S.aluno=d.aluno;
}

/* ---------- conexão ---------- */
function setSync(kind,text){$("#sync").innerHTML='<span class="dot '+kind+'"></span><span>'+esc(text)+'</span>'}
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
    const sel=store("dt2-aluno-sel");
    if(!S.alunoId&&sel&&S.alunos.some(a=>a.id===sel))selectAluno(sel,true);
    else if(S.alunoId){const a=S.alunos.find(x=>x.id===S.alunoId);if(a)S.aluno=Object.assign({},S.aluno,a)}
    if(!S.alunoId&&S.view!=="alunos")setView("alunos");
    if(d.catalogo)S.catalogo=d.catalogo;
    if(fresh)profNotice();
  }else if(d.aluno){
    const first=!S.alunoId;S.aluno=d.aluno;S.alunoId=d.aluno.id;
    if(first){S.draft=store(DRAFT_KEY());S.pending=store(PENDING_KEY());loadDados()}
    if(d.aluno.cadastroPendente)showCadastro();
  }
  updateWho();
  if(fresh&&!S.alunoId)setSync("ok","Conectado");
  render();
}
function selectAluno(id,quiet){
  if(S.alunoId===id&&S.loaded){if(!quiet)setView("lancar");return}
  S.alunoId=id;store("dt2-aluno-sel",id);
  S.aluno=S.alunos.find(a=>a.id===id)||null;
  S.rows=[];S.loaded=false;S.avals=[];S.models=new Map();S.exMap=new Map();S.error=null;
  S.draft=store(DRAFT_KEY());S.pending=store(PENDING_KEY());S.confirm=false;S.picker=false;S.avSel=null;S.avEdit=null;S.forcaEx=null;S.medida=null;S.modEdit=null;
  updateWho();
  loadDados();
  if(!quiet)setView("lancar");
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
function updateWho(){
  const w=$("#who");
  if(S.role==="prof"){w.hidden=false;w.classList.remove("static");w.textContent=S.aluno?S.aluno.nome:"Escolher aluno";w.title="Trocar de aluno"}
  else if(S.aluno){w.hidden=false;w.classList.add("static");w.textContent=S.aluno.nome}
  else w.hidden=true;
}
$("#who").onclick=()=>{if(S.role==="prof")setView("alunos")};

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
      if(!cur||cur.name!==r.ex){cur={id:newId(),name:r.ex,grupo:r.grupo,sets:[],obs:""};blocks.push(cur)}
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
const setDone=s=>!!String(s.reps).trim()||s.skip;
function doneSets(){if(!S.draft)return 0;let n=0;S.draft.blocks.forEach(b=>b.sets.forEach(s=>{if(String(s.reps).trim())n++}));return n}
function savableSets(){if(!S.draft)return 0;let n=0;S.draft.blocks.forEach(b=>b.sets.forEach(s=>{if(setDone(s))n++}));return n}

function needAluno(el){
  if(S.alunoId)return false;
  el.innerHTML='<div class="empty">'+(S.role==="prof"?'Escolha um aluno na aba <b>Alunos</b>.':'Carregando seus dados…')+'</div>';
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
      const days=t.last?Math.round((today-t.last.date)/864e5):0;
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
    el.innerHTML='<div class="session-head"><div><h2>Qual treino hoje?</h2><div class="muted small">'+DIAS[today.getDay()]+", "+fmtDate(today)+' · '+
      (S.models.size?'o app mostra o que foi feito da última vez':'o app copia o último treino igual para só preencher')+'</div></div>'+
      (prof?'<button class="btn" id="b-montar-t">✎ Montar treinos</button>':"")+'</div>'+
      metodoAviso(today)+
      (vazio?'<div class="notice"><p>'+(prof?'Este aluno ainda não tem treinos. Toque em <b>Montar treinos</b> para criar.':'Seu professor está montando o seu treino. Assim que ficar pronto, ele aparece aqui. Enquanto isso, você pode usar o <b>Treino livre</b>.')+'</p></div>':"")+
      '<div class="pick">'+(S.draft?'<button data-cont="1" class="cont"><span class="tag">Em andamento, ainda não salvo</span><b>Continuar: '+esc(S.draft.treino)+'</b><span class="muted small">'+doneSets()+' séries feitas hoje</span></button>':"")+
      main.map(card).join("")+'<button data-t=""><b>Treino livre</b><span class="muted small">Começar em branco e adicionar exercícios</span></button></div>'+
      (others.length?'<details class="others"><summary>Outros treinos do histórico ('+others.length+')</summary><div class="pick">'+others.map(card).join("")+'</div></details>':"");
    const bm=$("#b-montar-t");if(bm)bm.onclick=()=>openModelEditor(null);
    el.querySelectorAll(".pick button").forEach(b=>b.onclick=()=>{
      if(b.dataset.cont){S.picker=false;render();window.scrollTo({top:0});return}
      const name=b.dataset.t;
      if(S.draft&&savableSets()>0&&!b.dataset.armed){
        b.dataset.armed="1";const w=document.createElement("span");w.className="badge down";w.textContent="Toque de novo para trocar: "+savableSets()+" séries não salvas serão perdidas";b.prepend(w);return;
      }
      S.draft=name?buildDraft(name):{date:fmtDate(new Date()),treino:"Treino livre",blocks:[],started:Date.now(),inicio:hhmm(new Date()),lastTick:null,obs:""};
      S.picker=false;S.confirm=false;saveDraft();render();window.scrollTo({top:0});
    });
    return;
  }
  const d=S.draft;
  $("#savebar").hidden=false;
  const seen=new Set();const exNames=S.rows.map(r=>r.ex).concat(S.exList||[]).filter(n=>{const k=strip(n);if(!k||seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  el.innerHTML='<div class="session-head"><div><h2>'+esc(d.treino)+'</h2><div class="meta"><span>'+esc(d.date)+'</span><label class="inicio">Início <input type="time" id="inicio" value="'+esc(d.inicio||hhmm(new Date(d.started)))+'" aria-label="Horário de início do treino"></label><span id="clock"></span></div></div>'+
    '<div class="row-btns"><button class="btn ghost" id="b-stop" title="Marca as séries que faltam como não feitas">Parei aqui</button><button class="btn ghost" id="b-discard">Descartar</button></div></div>'+
    '<div class="treino-obs"><textarea id="treino-obs" placeholder="Observação do treino (opcional): como foi, se precisou parar, dor, cansaço…" aria-label="Observação do treino">'+esc(d.obs||"")+'</textarea></div>'+
    (d.metodo?metodoTopo(d):"")+
    (d.blocks.length?"":'<div class="empty">Nenhum exercício ainda. Adicione abaixo.</div>')+
    d.blocks.map((b,bi)=>parHeader(d,b)+exCard(b,bi)).join("")+
    '<div class="add-ex"><input id="new-ex" list="ex-list" placeholder="Adicionar exercício (busque pelo nome)" aria-label="Nome do exercício"><button class="btn" id="b-add">Adicionar</button></div>'+
    '<datalist id="ex-list">'+exNames.map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>';
  bindLancar();
  updateBar();
}
/* ---- Método: topo do treino, cabeçalho de cada par, avisos de progressão ---- */
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
    '<button class="chk" data-act="check" aria-label="Marcar cardio como feito">✓</button></div></div>'+
    '<div class="ex-f"><button class="btn ghost" data-act="add-set" hidden></button></div></div>';
}
function exCard(b,bi){
  if(b.cardio)return cardioCard(b,bi);
  const gv=GROUP_VAR[b.grupo]||"--g-abd";
  return '<div class="ex" data-b="'+bi+'"><div class="ex-h"><span class="stripe" style="background:var('+gv+')"></span><h3>'+(b.par?'<span class="parlbl">'+b.par+b.lado+'</span> ':"")+esc(b.name)+
    (b.orig?'<br><span class="swapped">no lugar de: '+esc(b.orig)+'</span>':"")+'</h3><span class="tag">'+esc(b.grupo)+'</span>'+
    '<button class="sw" data-act="swap" aria-label="Trocar exercício (máquina ocupada ou sem equipamento)" title="Trocar exercício">⇄</button>'+
    '<button class="x" data-act="rm-ex" aria-label="Remover exercício">×</button></div>'+
    (b.swapping?'<div class="swap"><input data-f="swapto" list="ex-list" placeholder="Trocar por qual exercício?" aria-label="Novo exercício"><button class="btn small" data-act="swap-ok">Trocar</button><button class="btn ghost small" data-act="swap-cancel">Cancelar</button></div>'+swapSugestoes(b):"")+
    avisosProgresso(S.draft,b)+
    b.sets.map((s,si)=>setRow(s,bi,si)).join("")+
    '<div class="ex-f"><button class="btn" data-act="add-set">+ Série</button>'+(b.sets.length?'<button class="btn ghost" data-act="rm-set">− Última série</button>':"")+
    '<button class="btn ghost" data-act="ex-note">'+(b.obs?"✎ Obs.":"✎ Obs. do exercício")+'</button></div>'+
    (b.noteOpen||b.obs?'<div class="ex-obs"><input class="obs" data-f="exobs" value="'+esc(b.obs||"")+'" placeholder="Observação do exercício (ex.: máquina diferente, ajuste de banco)" aria-label="Observação do exercício"></div>':"")+
    '</div>';
}
// Trocas sugeridas pelo método: mesmo músculo, para manter o par.
function swapSugestoes(b){
  const m=metodoDoDraft(S.draft);if(!m||!b.exKey)return "";
  const alts=Metodos.alternativas(m,b.origKey||b.exKey).filter(x=>x.key!==b.exKey);
  if(b.origKey&&b.origKey!==b.exKey)alts.unshift({key:b.origKey,ex:m.exercicios[b.origKey]});
  return alts.length?'<div class="swap-sug"><span class="small muted">Mesmo músculo ('+esc((m.musculos[b.musculo]||{}).nome||"")+'):</span>'+alts.map(x=>'<button class="chip" data-alt="'+esc(x.key)+'">'+esc(x.ex.nome)+'</button>').join("")+'</div>':"";
}
function lastText(s){
  if(!s.last)return '<span>primeira vez</span>';
  if(s.last.skipped)return '<span>última: não feita</span>';
  return '<span>última <b>'+esc(s.last.feitas||"–")+'</b> × '+esc(s.last.peso||"–")+'</span>';
}
function cmpBadge(s){
  if(!s.last||!s.last.vol||!String(s.reps).trim())return "";
  const reps=parseReps(s.reps,s.meta),peso=parsePeso(s.peso);const v=setVolume(reps,peso);
  if(!v)return "";
  const diff=v-s.last.vol;if(Math.abs(diff)<0.5)return '<span class="badge">igual</span>';
  return diff>0?'<span class="badge up">▲ superou</span>':'<span class="badge down">▼ abaixo</span>';
}
function setRow(s,bi,si){
  const done=!!String(s.reps).trim();
  return '<div class="set'+(done?" done":"")+(s.skip?" skip":"")+'" data-s="'+si+'"><div class="set-info"><b>Série '+s.n+'</b>'+(s.meta?'<span>meta <b>'+esc(s.meta)+'</b></span>':"")+(s.rirMeta?'<span>sobrar <b>'+esc(s.rirMeta)+'</b></span>':"")+lastText(s)+'<span class="cmp">'+cmpBadge(s)+'</span>'+(s.skip?'<span class="badge down">não feita</span>':"")+'<label class="tm-lbl">horário <input type="time" class="tm" data-f="time" value="'+esc(s.time||"")+'" aria-label="Horário da série '+s.n+'"></label></div>'+
    '<div class="set-in">'+
      '<div class="fld"><label for="r'+bi+'_'+si+'">Reps</label><input id="r'+bi+'_'+si+'" data-f="reps" inputmode="numeric" autocomplete="off" value="'+esc(s.reps)+'" placeholder="'+esc(String(s.meta).replace(/[^\d+\-–]/g,"")||"–")+'"></div>'+
      '<div class="fld"><label for="p'+bi+'_'+si+'">Peso</label><input id="p'+bi+'_'+si+'" data-f="peso" autocomplete="off" value="'+esc(s.peso)+'" placeholder="kg"></div>'+
      '<div class="fld"><label for="i'+bi+'_'+si+'">Sobrou</label><select id="i'+bi+'_'+si+'" data-f="rir"><option value="">–</option>'+[0,1,2,3,4,5].map(v=>'<option'+(String(s.rir)===String(v)?" selected":"")+'>'+v+'</option>').join("")+'</select></div>'+
      '<button class="chk" data-act="check" aria-label="Marcar série '+s.n+' como feita na meta">✓</button>'+
      '<button class="note-btn'+(s.obs||s.skip?" on":"")+'" data-act="note" aria-label="Observação ou não fiz">✎</button>'+
    '</div>'+(s.note||s.obs||s.skip?'<div class="note-row"><input class="obs" data-f="obs" value="'+esc(s.obs)+'" placeholder="Observação (como foi a série)" aria-label="Observação da série '+s.n+'"><button class="skipbtn" data-act="skip">'+(s.skip?"✓ Não fiz":"Não fiz")+'</button></div>':"")+'</div>';
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
    card.querySelectorAll("[data-alt]").forEach(c=>c.onclick=()=>{swapToKey(b,c.dataset.alt);b.swapping=false;saveDraft();rerenderCard(bi)});
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
          }
          if(f==="time")s.time=inp.value||null;
          if(f==="reps"||f==="peso")row.querySelector(".cmp").innerHTML=cmpBadge(s);
          saveDraft();updateBar();
        });
      });
      row.querySelector('[data-act="check"]').onclick=()=>{
        if(!String(s.reps).trim()){
          const m=String(s.meta).match(/\d+/);s.reps=m?m[0]:(s.last&&s.last.feitas&&/^\d+$/.test(s.last.feitas)?s.last.feitas:"");
          if(!s.reps){row.querySelector('[data-f="reps"]').focus();return}
          s.time=hhmm(new Date());S.draft.lastTick=Date.now();s.skip=false;startRest(bi,si);
        }else{s.reps="";s.time=null}
        saveDraft();rerenderCard(bi);updateBar();
      };
      row.querySelector('[data-act="note"]').onclick=()=>{s.note=!s.note;saveDraft();rerenderCard(bi);const o=$('.ex[data-b="'+bi+'"] .set[data-s="'+si+'"] .obs');if(o)o.focus()};
      const sk=row.querySelector('[data-act="skip"]');
      if(sk)sk.onclick=()=>{s.skip=!s.skip;if(s.skip){s.reps="";s.time=s.time||hhmm(new Date())}s.note=true;saveDraft();rerenderCard(bi);updateBar();
        const o=$('.ex[data-b="'+bi+'"] .set[data-s="'+si+'"] .obs');if(o&&s.skip&&!s.obs){o.placeholder="Por que não fez? (ex.: máquina ocupada, dor)";o.focus()}};
    });
    const exo=card.querySelector('[data-f="exobs"]');if(exo)exo.addEventListener("input",()=>{b.obs=exo.value;saveDraft()});
    card.querySelector('[data-act="ex-note"]').onclick=()=>{b.noteOpen=!b.noteOpen;saveDraft();rerenderCard(bi);const o=$('.ex[data-b="'+bi+'"] [data-f="exobs"]');if(o)o.focus()};
    card.querySelector('[data-act="swap"]').onclick=()=>{b.swapping=!b.swapping;rerenderCard(bi);const i=$('.ex[data-b="'+bi+'"] [data-f="swapto"]');if(i)i.focus()};
    const so=card.querySelector('[data-act="swap-ok"]');
    if(so){
      const inp=card.querySelector('[data-f="swapto"]');
      const go=()=>{const name=inp.value.trim();if(!name)return;
        const g=guessGroup(name);if(b.musculo&&g!=="Sem grupo"&&g!==b.grupo)toast("Atenção: o par pede "+b.grupo+". Prefira um exercício do mesmo músculo.");
        swapExercise(b,name);b.swapping=false;saveDraft();rerenderCard(bi)};
      so.onclick=go;inp.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
      card.querySelector('[data-act="swap-cancel"]').onclick=()=>{b.swapping=false;rerenderCard(bi)};
    }
    card.querySelector('[data-act="rm-ex"]').onclick=()=>{S.draft.blocks.splice(bi,1);saveDraft();renderLancar()};
    card.querySelector('[data-act="add-set"]').onclick=()=>{const prev=b.sets[b.sets.length-1];const ns=makeSet(b.sets.length+1,null);if(prev){ns.meta=prev.meta;ns.peso=prev.peso}b.sets.push(ns);saveDraft();rerenderCard(bi)};
    const rm=card.querySelector('[data-act="rm-set"]');if(rm)rm.onclick=()=>{b.sets.pop();saveDraft();rerenderCard(bi);updateBar()};
  });
  const ini=$("#inicio");if(ini)ini.addEventListener("input",()=>{S.draft.inicio=ini.value;saveDraft()});
  const tob=$("#treino-obs");if(tob)tob.addEventListener("input",()=>{S.draft.obs=tob.value;saveDraft()});
  $("#b-add").onclick=addExercise;
  $("#new-ex").addEventListener("keydown",e=>{if(e.key==="Enter")addExercise()});
  $("#b-discard").onclick=()=>armed($("#b-discard"),"Toque de novo para descartar","Descartar",()=>{S.draft=null;saveDraft();S.confirm=false;render()});
  $("#b-stop").onclick=()=>armed($("#b-stop"),"Toque de novo: marcar o que falta como não feito","Parei aqui",()=>{
    let n=0;S.draft.blocks.forEach(b=>b.sets.forEach(s=>{if(!String(s.reps).trim()&&!s.skip){s.skip=true;n++}}));
    saveDraft();renderLancar();toast(n?n+" séries marcadas como não feitas. Escreva o motivo na observação do treino e salve.":"Nada a marcar.");
    const t=$("#treino-obs");if(t){t.focus();t.scrollIntoView({block:"center"})}
  });
}
function armed(b,armText,txt,fn){
  if(b.dataset.armed){fn();return}
  b.dataset.armed="1";b.textContent=armText;b.classList.remove("ghost");
  setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent=txt;b.classList.add("ghost")}},4000);
}
function swapExercise(b,name){
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
function addExercise(){
  const inp=$("#new-ex");const name=inp.value.trim();if(!name)return;
  const prev=lastFor(name);
  const grupo=(prev&&prev[0]&&prev[0].grupo)||S.exMap.get(strip(name))||guessGroup(name);
  const b={id:newId(),name:prev&&prev[0]?prev[0].ex:name,grupo,sets:[],obs:""};
  if(prev&&prev.length)prev.forEach((r,i)=>b.sets.push(makeSet(i+1,r)));else for(let i=0;i<3;i++)b.sets.push(makeSet(i+1,null));
  S.draft.blocks.push(b);saveDraft();renderLancar();
  const last=document.querySelector(".ex:last-of-type");if(last)last.scrollIntoView({block:"center"});
}
function updateBar(){
  const n=savableSets(),feitas=doneSets();
  $("#sb-count").textContent=feitas+(feitas===1?" série feita":" séries feitas")+(n>feitas?" · "+(n-feitas)+" não feita"+(n-feitas>1?"s":""):"");
  const save=$("#sb-save"),cancel=$("#sb-cancel");
  const off=!navigator.onLine;
  if(S.pending){
    save.disabled=S.checking||off;cancel.hidden=true;
    save.textContent=S.checking?"Conferindo a planilha…":off?"Sem internet":"Conferir a planilha";
    return;
  }
  save.disabled=n===0||S.saving||off||!S.alunoId;
  if(S.saving){save.textContent="Salvando…"}
  else if(off){save.textContent="Sem internet";cancel.hidden=true}
  else if(S.confirm){save.textContent="Confirmar: gravar "+n+" séries";cancel.hidden=false}
  else{save.textContent="Salvar na planilha";cancel.hidden=true}
}
setInterval(()=>{
  if(!S.draft||S.view!=="lancar")return;
  const c=$("#clock");if(c){const m=Math.floor((Date.now()-S.draft.started)/60000);c.textContent="treino há "+(m<60?m+" min":Math.floor(m/60)+"h"+pad(m%60))}
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
  else r.textContent="toque ✓ ao terminar cada série";
},1000);

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
  if(!S.confirm){S.confirm=true;updateBar();return}
  const d=S.draft;const day=parseDate(d.date);const dia=DIAS[day.getDay()];
  const rows=[];const newEx=[];
  let firstOfTreino=true;
  d.blocks.forEach(b=>{
    let grupo=b.grupo;const known=S.exMap.get(strip(b.name));if(known)grupo=known;
    if(!known&&!newEx.some(x=>strip(x[0])===strip(b.name)))newEx.push([b.name,grupo]);
    let firstOfEx=true;
    b.sets.forEach(s=>{
      if(!setDone(s))return;
      const tagM=firstOfTreino&&d.metodo?"["+((metodoDoDraft(d)||{}).nome||"Método")+" · semana "+d.metodo.semana+" · "+d.metodo.fase+"]":"";
      const obs=[tagM,s.obs,firstOfEx&&b.orig?"No lugar de: "+b.orig:"",firstOfEx&&b.obs?"[Exercício] "+b.obs:"",firstOfTreino&&d.obs?"[Treino] "+d.obs:""].map(x=>String(x||"").trim()).filter(Boolean).join(" · ");
      firstOfEx=false;firstOfTreino=false;
      rows.push([d.date,dia,d.treino,s.time||d.inicio||"",grupo,b.name,s.n,textCell(s.meta),s.skip?"'não fiz":textCell(s.reps),textCell(s.peso),s.skip?"":intensityFromRir(s.rir),s.skip||s.rir===""?"":Number(s.rir),textCell(obs)]);
    });
  });
  if(!rows.length)return;
  const saveId=hashRows([d.started,rows,newEx]);d.saveId=saveId;saveDraft();
  const base=baseCounts(rows);
  S.saving=true;updateBar();setSync("busy","Gravando na planilha…");
  try{
    const res=await callA("gravar",{rows,exercicios:newEx,saveId});
    S.draft=null;saveDraft();S.confirm=false;S.saving=false;
    const w=(res&&res.written)||rows.length;
    toast(res&&res.duplicate?"Essas séries já estavam salvas na planilha":"Treino salvo: "+w+(w===1?" série":" séries")+" na planilha");
    banner("");fetchDados();render();
  }catch(e){
    S.saving=false;S.confirm=false;
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
$("#sb-save").onclick=save;
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
  $("#f-period").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.p===S.period)));
  $("#f-groups").innerHTML=GROUPS.map(g=>'<button class="chip" data-g="'+esc(g.k)+'" aria-pressed="'+S.groups.has(g.k)+'"><i style="background:var('+g.v+')"></i>'+esc(g.k)+'</button>').join("");
  $("#f-groups").querySelectorAll(".chip").forEach(c=>c.onclick=()=>{const g=c.dataset.g;if(S.groups.has(g)){if(S.groups.size>1)S.groups.delete(g)}else S.groups.add(g);renderEvo()});
  if(!S.alunoId||!S.loaded){
    $("#kpis").innerHTML='<div class="empty" style="grid-column:1/-1">'+(!S.alunoId&&S.role==="prof"?"Escolha um aluno na aba Alunos.":S.error?"Sem dados da planilha. Veja o aviso acima.":"Lendo a planilha…")+'</div>';
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
  const ss=sessions().filter(s=>s.rows.some(r=>r.done)).slice(-8).reverse();
  $("#last").innerHTML='<thead><tr><th>Data</th><th>Treino</th><th>Grupos</th><th class="n">Séries</th><th class="n">Volume</th><th>Início</th></tr></thead><tbody>'+
    ss.map(s=>{const dn=s.rows.filter(r=>r.done);const grs=[...new Set(dn.map(r=>r.grupo))].filter(g=>GROUP_VAR[g]);const first=s.rows.find(r=>/^\d{1,2}:\d{2}/.test(r.hora));
      return '<tr><td>'+fmtShort(s.date)+' <span class="muted small">'+esc((s.rows[0].dia||"").slice(0,3))+'</span></td><td>'+esc(s.treino)+'</td><td>'+grs.map(g=>'<span class="tag"><i style="background:var('+GROUP_VAR[g]+')"></i>'+esc(g)+'</span>').join(" ")+'</td><td class="n">'+dn.length+'</td><td class="n">'+nf1.format(dn.reduce((a,r)=>a+r.vol,0)/1000)+' t</td><td>'+(first?esc(first.hora):"–")+'</td></tr>'}).join("")+'</tbody>';
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
      '<div class="empty">'+(prof?"Nenhuma avaliação ainda. Toque em <b>Nova avaliação</b> para lançar peso, medidas e dobras.":"Seu professor ainda não lançou nenhuma avaliação física. Quando lançar, ela aparece aqui com a sua evolução.")+'</div>';
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
  const kpi=(l,k,u)=>{const v=get(cur,c,k);return isFinite(v)?'<div class="kpi"><span class="l">'+l+'</span><span class="v">'+(k==="RCQ"?nf2:nf1).format(v)+(u?'<small>'+u+'</small>':"")+'</span>'+delta(k,menos.has(k))+'</div>':""};
  el.innerHTML='<div class="av-top"><div><h2>Avaliação física</h2><span class="muted small">'+list.length+(list.length===1?" avaliação":" avaliações")+(prev?" · comparando com "+prev.dataS:"")+'</span></div>'+
    '<div class="row-btns"><select id="av-sel" aria-label="Escolher avaliação">'+list.map((a,i)=>'<option value="'+i+'"'+(i===S.avSel?" selected":"")+'>'+esc(a.dataS)+'</option>').join("")+'</select>'+
    (prof?'<button class="btn" id="av-edit">Editar</button><button class="btn primary" id="av-new">+ Nova</button>':"")+'</div></div>'+
    '<div class="calc" style="margin-bottom:14px">'+kpi("Peso","Peso (kg)","kg")+kpi("IMC","IMC","")+kpi("% Gordura","% Gordura","%")+kpi("Massa magra","Massa magra (kg)","kg")+kpi("Massa gorda","Massa gorda (kg)","kg")+kpi("Cintura/quadril","RCQ","")+'</div>'+
    '<div class="av-grid"><div class="card body-card"><div class="body-wrap" id="body">'+Body.svg(cur.v,S.avPt)+'</div>'+
    '<div class="body-legend"><span><i style="background:var(--good)"></i>medido</span><span><i style="background:var(--action)"></i>medida (fita)</span><span><i style="background:#eda100"></i>dobra</span></div></div>'+
    '<div>'+sec("Geral",Body.GERAL)+sec("Bioimpedância",Body.BIO)+sec("Perímetros (fita)",Body.PER)+sec("Dobras cutâneas",Body.DOB)+
    (cur.v[Body.OBS]?'<div class="av-sec"><h3>Observações</h3><p>'+esc(cur.v[Body.OBS])+'</p></div>':"")+
    (c._protocolo?'<p class="note">% de gordura calculado por '+esc(c._protocolo)+'.</p>':"")+'</div></div>';
  $("#av-sel").onchange=e=>{S.avSel=+e.target.value;S.avPt=null;renderAval()};
  const n=$("#av-new");if(n)n.onclick=()=>startAvEdit(null);
  const ed=$("#av-edit");if(ed)ed.onclick=()=>startAvEdit(cur);
  bindBody(false);
}
function bindBody(edit){
  $("#body").querySelectorAll(".pt").forEach(g=>{
    const go=()=>{
      const p=Body.POINTS.find(x=>x.id===g.dataset.pt);S.avPt=p.id;
      $("#body").innerHTML=Body.svg(edit?S.avEdit.v:S.avals[S.avSel].v,S.avPt);bindBody(edit);
      document.querySelectorAll(".mfield.sel").forEach(m=>m.classList.remove("sel"));
      let first=null;p.keys.forEach(k=>{const m=document.querySelector('.mfield[data-k="'+CSS.escape(k)+'"]');if(m){m.classList.add("sel");first=first||m}});
      if(first){first.scrollIntoView({block:"center",behavior:"smooth"});const i=first.querySelector("input");if(i)setTimeout(()=>i.focus({preventScroll:true}),250)}
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
  const faltaPerfil=Body.calc({},S.aluno||{})._faltaPerfil;
  el.innerHTML='<div class="av-top"><div><h2>'+(E.linha?"Editar avaliação":"Nova avaliação")+'</h2><span class="muted small">Toque num ponto do corpo para ir direto à medida. Deixe em branco o que não mediu.</span></div>'+
    '<div class="row-btns"><button class="btn ghost" id="av-cancel">Cancelar</button><button class="btn primary" id="av-save">Salvar avaliação</button></div></div>'+
    '<p class="setup-msg" id="av-msg" role="status"></p>'+
    '<div class="av-grid"><div class="card body-card"><div class="body-wrap" id="body">'+Body.svg(v,S.avPt)+'</div>'+
    '<div class="body-legend"><span><i style="background:var(--good)"></i>preenchido</span><span><i style="background:var(--action)"></i>medida (fita)</span><span><i style="background:#eda100"></i>dobra</span></div></div>'+
    '<div><div class="av-sec"><h3>Data</h3><div class="mgrid"><div class="mfield"><label for="av-data">Data da avaliação</label><input id="av-data" type="date" value="'+esc(brToIso(v["Data"]))+'"></div></div></div>'+
    sec("Geral",Body.GERAL)+'<div class="calc" id="av-calc" style="margin-bottom:14px"></div>'+
    sec("Bioimpedância (opcional)",Body.BIO,"Se usar balança ou aparelho de bioimpedância, digite o que ele mostrar.")+
    sec("Perímetros (fita, cm)",Body.PER)+
    sec("Dobras cutâneas (opcional, adipômetro, mm)",Body.DOB,"Com as 7 dobras o app calcula o % de gordura (Jackson & Pollock). Com 3 dobras também funciona."+(faltaPerfil?" <b>Para o cálculo, preencha data de nascimento e sexo no Perfil do aluno.</b>":""))+
    '<div class="av-sec"><h3>Observações</h3><textarea class="obs" id="av-obs" style="height:80px;padding:8px 10px;width:100%" placeholder="Postura, lesões, objetivos para o próximo bimestre…">'+esc(v[Body.OBS]||"")+'</textarea></div>'+
    '</div></div>';
  const upCalc=()=>{const d=parseDate(v["Data"])||new Date();const c=Body.calc(v,S.aluno||{},d);
    const k=(l,key,u)=>isFinite(c[key])?'<div class="kpi"><span class="l">'+l+'</span><span class="v">'+(key==="RCQ"?nf2:nf1).format(c[key])+(u?'<small>'+u+'</small>':"")+'</span></div>':"";
    $("#av-calc").innerHTML=k("IMC","IMC","")+k("% Gordura","% Gordura","%")+k("Massa magra","Massa magra (kg)","kg")+k("Massa gorda","Massa gorda (kg)","kg")+k("Cintura/quadril","RCQ","");};
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
    S.avEdit=null;S.avPt=null;S.avSel=null;toast("Avaliação salva na planilha do aluno");
    await fetchDados();render();
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
function renderAlunos(){
  const el=$("#v-alunos");
  if(S.alunoForm)return renderAlunoForm(el);
  const q=strip(S.busca);
  const list=S.alunos.filter(a=>!q||strip(a.nome).includes(q)).sort((a,b)=>(b.ativo-a.ativo)||a.nome.localeCompare(b.nome,"pt-BR"));
  el.innerHTML='<div class="session-head"><div><h2>Alunos</h2><div class="muted small">'+S.alunos.length+' cadastrados · cada um tem a própria planilha na pasta "Diário de Treino — Alunos" do seu Drive</div></div>'+
    '<button class="btn primary" id="a-new">+ Novo aluno</button></div>'+
    (S.shareFor?shareBox(S.shareFor):"")+
    (S.alunos.length>6?'<input class="search" id="a-busca" type="search" placeholder="Buscar aluno" value="'+esc(S.busca)+'">':"")+
    (list.length?'<div class="alist">'+list.map(a=>{const id=idade(a);return '<button class="acard'+(a.id===S.alunoId?" sel":"")+(a.ativo?"":" off")+'" data-id="'+esc(a.id)+'"><b>'+esc(a.nome)+'</b>'+
      '<span class="muted small">'+[id!=null?id+" anos":"",a.objetivo].filter(Boolean).map(esc).join(" · ")+'</span>'+
      '<span>'+(a.ativo?"":'<span class="pill bad">acesso pausado</span> ')+statusPill(a)+(a.id===S.alunoId?' <span class="pill good">aberto agora</span>':"")+'</span></button>'}).join("")+'</div>'
      :'<div class="empty">'+(S.alunos.length?"Nenhum aluno com esse nome.":"Nenhum aluno ainda. Toque em <b>Novo aluno</b>. Dica: cadastre você mesmo primeiro, usando a sua planilha atual.")+'</div>');
  $("#a-new").onclick=()=>{S.alunoForm={};S.shareFor=null;renderAlunos()};
  const bs=$("#a-busca");if(bs)bs.addEventListener("input",()=>{S.busca=bs.value;const p=bs.selectionStart;renderAlunos();const n=$("#a-busca");n.focus();n.setSelectionRange(p,p)});
  el.querySelectorAll(".acard").forEach(b=>b.onclick=()=>{S.shareFor=null;const a=S.alunos.find(x=>x.id===b.dataset.id);
    if(a&&a.status==="montar treino")openModelEditor(a.id);else selectAluno(b.dataset.id)});
  bindCopy(el);
}
function renderAlunoForm(el){
  const f=S.alunoForm;const novo=!f.id;
  const i=(k,l,type,extra)=>'<label class="fld2">'+l+'<input data-k="'+k+'" type="'+(type||"text")+'" value="'+esc(type==="date"?brToIso(f[k]):f[k]||"")+'" '+(extra||"")+'></label>';
  el.innerHTML='<div class="session-head"><div><h2>'+(novo?"Novo aluno":"Editar "+esc(f.nome))+'</h2>'+(novo?'<div class="muted small">O app cria uma planilha só deste aluno no seu Drive e gera o link de acesso dele.</div>':"")+'</div></div>'+
    '<div class="card"><div class="form-grid">'+i("nome","Nome completo *","text",'autocomplete="off"')+i("telefone","WhatsApp (com DDD)","tel",'placeholder="11 99999-9999"')+'</div>'+
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
  const tab=document.querySelector('#tabs [data-v="alunos"]');
  tab.textContent="Alunos"+(pend.length?" ("+pend.length+")":"");
  if(!pend.length||$("#banner").innerHTML)return;
  banner('<p><b>'+pend.map(a=>esc(String(a.nome).split(" ")[0])).join(", ")+'</b> '+(pend.length>1?"completaram":"completou")+' o cadastro. Falta montar o treino.</p><button class="btn" id="b-montar">Montar agora</button>');
  $("#b-montar").onclick=()=>{banner("");openModelEditor(pend[0].id)};
}

/* ========== MONTAR TREINOS (professor) ========== */
function openModelEditor(alunoId){
  if(alunoId&&alunoId!==S.alunoId)selectAluno(alunoId,true);
  S.modEdit="carregando";setView("lancar");
  const go=()=>{S.modEdit=[...S.models.entries()].map(([nome,itens])=>({nome,itens:itens.map(it=>({ex:it.ex,series:it.series,metas:it.metas.filter(Boolean).join("; "),peso:it.pesos.filter(Boolean).join("; ")}))}));
    if(!S.modEdit.length&&!(S.aluno&&S.aluno.metodo))S.modEdit=[{nome:"Treino A",itens:[novoItem()]}];render()};
  if(S.loaded)go();else{const t=setInterval(()=>{if(S.loaded){clearInterval(t);go()}},300);setTimeout(()=>clearInterval(t),30000)}
}
const novoItem=()=>({ex:"",series:3,metas:"12",peso:""});
function renderModelEditor(el){
  if(S.modEdit==="carregando"){el.innerHTML='<div class="empty">Lendo a planilha do aluno…</div>';return}
  const M=S.modEdit;const a=S.aluno||{};
  const seen=new Set();const names=(S.catalogo||[]).map(r=>r[0]).concat(S.exList||[],S.rows.map(r=>r.ex)).filter(n=>{const k=strip(n);if(!k||seen.has(k))return false;seen.add(k);return true}).sort((x,y)=>x.localeCompare(y,"pt-BR"));
  el.innerHTML='<div class="session-head"><div><h2>Treinos de '+esc(String(a.nome||"").split(" ")[0])+'</h2><div class="muted small">'+
    [a.objetivo,a.dias?a.dias+"x por semana":"",a.obs?"Restrições: "+a.obs:""].filter(Boolean).map(esc).join(" · ")+'</div></div>'+
    '<div class="row-btns"><button class="btn ghost" id="mt-cancel">Cancelar</button><button class="btn primary" id="mt-save">Salvar treinos</button></div></div>'+
    '<p class="setup-msg" id="mt-msg" role="status"></p>'+
    metodoCard(a)+
    '<div class="par-h">Treinos próprios (aba Modelos)</div>'+
    M.map((t,ti)=>'<div class="mt" data-t="'+ti+'"><div class="mt-h"><input data-f="nome" value="'+esc(t.nome)+'" placeholder="Nome do treino (ex.: Treino A — Pernas)" aria-label="Nome do treino">'+
      '<button class="btn ghost small" data-act="rm-t">Remover</button></div>'+
      t.itens.map((it,ii)=>'<div class="mt-row" data-i="'+ii+'"><div class="ex-in"><input data-f="ex" list="mt-list" value="'+esc(it.ex)+'" placeholder="Exercício (busque pelo nome)" aria-label="Exercício">'+
        '<div class="mt-acts"><button data-act="up" aria-label="Subir">↑</button><button data-act="down" aria-label="Descer">↓</button><button data-act="rm" aria-label="Remover exercício">✕</button></div></div>'+
        '<div class="mt-nums"><label>Séries<input data-f="series" inputmode="numeric" value="'+esc(it.series)+'"></label>'+
        '<label>Reps meta<input data-f="metas" value="'+esc(it.metas)+'" placeholder="12 ou 15; 12; 10"></label>'+
        '<label>Peso inicial<input data-f="peso" value="'+esc(it.peso)+'" placeholder="ex.: 10 kg"></label></div></div>').join("")+
      '<div class="mt-f"><button class="btn" data-act="add">+ Exercício</button></div></div>').join("")+
    '<div class="row-btns" style="margin-bottom:12px"><button class="btn" id="mt-addt">+ Novo treino</button></div>'+
    '<p class="note">Reps meta diferentes por série: separe com ponto e vírgula (15; 12; 10). Peso inicial vale até o aluno fazer o exercício a primeira vez; depois o app sugere o último peso usado.</p>'+
    '<datalist id="mt-list">'+names.map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>';
  el.querySelectorAll(".mt").forEach(card=>{
    const ti=+card.dataset.t;const t=M[ti];
    card.querySelector('[data-f="nome"]').addEventListener("input",e=>{t.nome=e.target.value});
    card.querySelector('[data-act="rm-t"]').onclick=e=>armed(e.target,"Toque de novo para remover","Remover",()=>{M.splice(ti,1);render()});
    card.querySelector('[data-act="add"]').onclick=()=>{t.itens.push(novoItem());render();const r=$('.mt[data-t="'+ti+'"] .mt-row:last-of-type [data-f="ex"]');if(r)r.focus()};
    card.querySelectorAll(".mt-row").forEach(row=>{
      const ii=+row.dataset.i;const it=t.itens[ii];
      row.querySelectorAll("[data-f]").forEach(inp=>inp.addEventListener("input",()=>{it[inp.dataset.f]=inp.value}));
      row.querySelector('[data-act="rm"]').onclick=()=>{t.itens.splice(ii,1);render()};
      row.querySelector('[data-act="up"]').onclick=()=>{if(ii>0){t.itens.splice(ii-1,0,t.itens.splice(ii,1)[0]);render()}};
      row.querySelector('[data-act="down"]').onclick=()=>{if(ii<t.itens.length-1){t.itens.splice(ii+1,0,t.itens.splice(ii,1)[0]);render()}};
    });
  });
  bindMetodoCard();
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
  const novos=[];linhas.forEach(r=>{const k=strip(r[1]);if(!known.has(k)){known.add(k);novos.push([r[1],guessGroup(r[1])])}});
  if(!navigator.onLine)return bad("Sem internet. Os treinos continuam aqui; salve quando a conexão voltar.");
  btn.disabled=true;msg.className="setup-msg";msg.textContent="Salvando na planilha do aluno…";
  try{
    await callA("salvarModelos",{linhas,exerciciosNovos:novos});
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
    html+='<div class="card" style="margin-bottom:14px"><div class="card-h"><h2>'+esc(a.nome)+'</h2>'+(prof&&a.ativo===false?'<span class="pill bad">acesso pausado</span>':"")+'</div><dl class="kv">'+
      [["Idade",id!=null?id+" anos":""],["Nascimento",a.nasc],["Sexo",a.sexo],["Altura",a.altura?a.altura+" cm":""],["Peso",a.peso?a.peso+" kg":""],["Objetivo",a.objetivo],["Dias por semana",a.dias],["Restrições",a.obs],
       ["Método",(()=>{const mt=metodoAluno();return mt?mt.m.nome+" · "+faseTexto(mt.F):""})()],
       ...(prof?[["WhatsApp",a.telefone],["E-mail",a.email],["Desde",a.criado]]:[])].filter(x=>x[1]).map(x=>'<dt>'+x[0]+'</dt><dd>'+esc(x[1])+'</dd>').join("")+'</dl>'+
      (prof?'<div class="row-btns" style="margin-top:14px"><button class="btn" id="p-edit">Editar dados</button>'+(a.planilhaUrl?'<a class="btn" href="'+esc(a.planilhaUrl)+'" target="_blank" rel="noopener">Abrir planilha</a>':"")+'</div>':"")+
      '</div>';
    if(prof)html+=shareBox(a)+'<div class="card" style="margin-bottom:14px"><h3>Segurança</h3><p class="muted small">Se o link vazar ou o aluno trocar de celular, gere um novo. O link antigo para de funcionar.</p><div class="row-btns"><button class="btn" id="p-newlink">Gerar novo link</button></div></div>';
    if(prof)html+='<div class="card" style="margin-bottom:14px"><h3>Treinos deste aluno</h3><p class="muted small">'+statusPill(a)+' Monte e edite os treinos aqui pelo app (ficam na aba Modelos da planilha do aluno).</p><div class="row-btns"><button class="btn primary" id="p-montar">✎ Montar treinos</button></div></div>';
  }else if(prof){
    html+='<div class="empty" style="margin-bottom:14px">Escolha um aluno na aba <b>Alunos</b> para ver o perfil.</div>';
  }
  html+='<div class="card" style="margin-bottom:14px"><h3>Instalar o app</h3>'+installHtml()+'</div>';
  html+='<div class="card"><h3>Este aparelho</h3><p class="muted small">'+(prof?"Você está entrando como <b>professor</b>.":"Você está entrando como aluno.")+' Para trocar de conta, saia e abra outro link.</p><div class="row-btns"><button class="btn ghost" id="p-out">Sair deste aparelho</button></div></div>'+
    '<p class="note" style="text-align:center"><a href="privacidade.html">Privacidade</a> · <a href="termos.html">Termos</a></p>';
  el.innerHTML=html;
  const pi=$("#p-install");if(pi)pi.onclick=doInstall;
  const pm=$("#p-montar");if(pm)pm.onclick=()=>openModelEditor(null);
  const pe=$("#p-edit");if(pe)pe.onclick=()=>{S.alunoForm=Object.assign({},S.aluno);setView("alunos")};
  const pn=$("#p-newlink");if(pn)pn.onclick=()=>armed(pn,"Toque de novo: o link antigo vai parar","Gerar novo link",async()=>{
    try{const r=await callA("novoCodigo");S.aluno=Object.assign({},S.aluno,r.aluno);const i=S.alunos.findIndex(x=>x.id===r.aluno.id);if(i>=0)S.alunos[i]=r.aluno;toast("Novo link gerado. Envie para o aluno.");renderPerfil()}
    catch(e){toast(errText(e))}});
  $("#p-out").onclick=()=>armed($("#p-out"),"Toque de novo para sair","Sair deste aparelho",()=>{Api.logout();location.hash="";location.reload()});
  bindCopy(el);
}

/* ========== navegação ========== */
const VIEWS=["alunos","lancar","evo","aval","perfil"];
function setView(v){
  if(!VIEWS.includes(v))v="lancar";
  if(v==="alunos"&&S.role!=="prof")v="lancar";
  S.view=v;
  document.querySelectorAll("#tabs .tab").forEach(t=>t.setAttribute("aria-selected",String(t.dataset.v===v)));
  VIEWS.forEach(x=>{$("#v-"+x).hidden=x!==v});
  store("dt2-aba",v);
  render();
}
document.querySelectorAll("#tabs .tab").forEach(t=>t.onclick=()=>{if(t.dataset.v==="alunos")S.alunoForm=null;setView(t.dataset.v)});
$("#home").onclick=()=>{S.picker=true;S.confirm=false;setView("lancar");window.scrollTo({top:0})};
function render(){
  $("#savebar").hidden=S.view!=="lancar"||!S.draft||S.picker||!S.alunoId;
  if(S.view==="alunos")renderAlunos();
  else if(S.view==="lancar")renderLancar();
  else if(S.view==="evo")renderEvo();
  else if(S.view==="aval")renderAval();
  else renderPerfil();
}
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(S.view==="evo")renderEvo()})}catch(e){}
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.view==="evo")renderEvo()},200)});

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
  document.querySelector('#tabs [data-v="alunos"]').hidden=S.role!=="prof";
  const savedView=store("dt2-aba");
  S.view=VIEWS.includes(savedView)?savedView:(S.role==="prof"?"alunos":"lancar");
  const ci=Api.cacheGet("inicio");
  if(ci)applyInicio(ci,false);
  setView(S.view);
  Metodos.load().then(()=>render());
  refreshInicio();
  setTimeout(installBanner,1500);
}
boot();
})();
