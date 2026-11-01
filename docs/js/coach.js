/* Coach de bolso: análise por regras, sem IA externa e sem custo.
   Lê as linhas do histórico (já tratadas pelo app) e os comentários do aluno.
   Tudo é calculado no próprio aparelho. */
window.Coach=(function(){
"use strict";
const strip=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\bdoreita\b/g,"direita").replace(/\s+/g," ").trim();
const SEM_LADO=/\s+(?:lado\s+)?(e|d|esquerd[oa]|direit[oa])\s*$/;
const base=n=>strip(n).replace(SEM_LADO,"").trim();
const semLadoNome=n=>String(n||"").trim().replace(/\s+(?:lado\s+)?(e|d|esquerd[oa]|direit[oa]|doreita)\s*$/i,"").trim();
const sem=(a,f)=>a.reduce((x,r)=>x+(f(r)||0),0);
const nf=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(n);
const pct=(a,b)=>b?Math.round((a-b)/b*100):null;

/* ---------- comentários ---------- */
const TEMAS=[
  {id:"sono",nome:"Sono ruim",rx:/dormi mal|dormi pouco|mal dormid|nao dormi|sem dormir|insonia|acordei (cedo|as|\d)|com sono/},
  {id:"cansaco",nome:"Cansaço",rx:/cansad|exaust|esgotad|sem energia|sem forca|morto|acabado|moido|indispost/},
  {id:"animo",nome:"Pouco ânimo",rx:/preguica|desanim|sem vibe|sem vontade|sem animo|sem saco|desmotiv/},
  {id:"dor",nome:"Dor ou incômodo",rx:/\bdor\b|\bdores\b|doi\b|doeu|doendo|dolorid|incomod|pincamento|fisgad|travou|travad|lesao|lesion|machuc|inflam/},
  {id:"comida",nome:"Alimentação",rx:/nao comi|sem comer|comi mal|comi pouco|de jejum|em jejum|com fome|estou com fome|mal alimentad/},
  {id:"tempo",nome:"Pouco tempo",rx:/sem tempo|com pressa|correndo|atrasad|cheguei tarde|muito tarde/},
  {id:"academia",nome:"Academia ruim ou cheia",rx:/academia ruim|academia sem|lotad|muito cheia|esperar liberar|horario de pico|\be pico\b|maquina ruim|ruim demais|era o maximo que tinha|era o que tinha/},
  {id:"bem",nome:"Treino bom",rx:/otimo|excelente|rendeu|muito bom|muito boa|me senti bem|forte hoje|fluiu|animad|bombou|show\b|perfeito/}
];
const CORPO=[["joelho",/joelho/],["ombro",/ombro/],["lombar",/lombar/],["cotovelo",/cotovelo/],["punho",/punho/],["pescoço",/pescoco/],["quadril",/quadril/],["costas",/\bcostas\b/],["peito",/\bpeito\b/],["tornozelo",/tornozelo/],["bíceps",/biceps/]];
const limpa=s=>String(s||"").replace(/\[(Ânimo|Animo|Duração|Duracao|Método|Metodo)[^\]]*\]/gi," ").replace(/\[(Treino|Exercício|Exercicio)\]/gi," ");
function temasDe(texto){
  const t=strip(limpa(texto));if(!t)return [];
  return TEMAS.filter(x=>{const m=t.match(x.rx);if(!m)return false;
    if(x.id==="sono"||x.id==="comida")return true;
    const antes=t.slice(Math.max(0,m.index-5),m.index);return !/(nao|sem) $/.test(antes)}).map(x=>x.id);
}
function partesComDor(texto){
  const t=strip(limpa(texto));if(!TEMAS[3].rx.test(t))return [];
  return CORPO.filter(c=>{const m=t.match(c[1]);if(!m)return false;
    return TEMAS[3].rx.test(t.slice(Math.max(0,m.index-30),m.index+40))}).map(c=>c[0]);
}
function analisarComentarios(rows){
  const cont={},frases={},partes={};
  rows.forEach(r=>{
    const txt=limpa(r.obs).replace(/^[s·]+|[s·]+$/g,"").replace(/(s*·s*){2,}/g," · ");if(!txt)return;
    temasDe(txt).forEach(id=>{cont[id]=(cont[id]||0)+1;(frases[id]=frases[id]||[]);if(frases[id].length<2&&!frases[id].includes(txt))frases[id].push(txt)});
    partesComDor(txt).forEach(p=>{partes[p]=(partes[p]||0)+1});
  });
  return {cont,frases,partes};
}
// Ânimo do treino: o toque 😀😐😞 quando existe; senão, o que os comentários indicam.
function animoDe(rows){
  const tag=rows.map(r=>String(r.obs||"").match(/\[[ÂA]nimo: *(bom|ok|ruim)\]/i)).find(Boolean);
  if(tag)return tag[1].toLowerCase();
  const c=analisarComentarios(rows).cont;
  if(c.animo||c.cansaco||c.sono)return "ruim";
  return c.bem?"bom":"";
}
function duracaoDe(rows){
  const tag=rows.map(r=>String(r.obs||"").match(/\[Duração: *(\d+) *min\]/i)).find(Boolean);
  if(tag)return +tag[1];
  const hs=rows.map(r=>String(r.hora||"").match(/^(\d{1,2}):(\d{2})/)).filter(Boolean).map(m=>+m[1]*60+ +m[2]);
  if(hs.length<2)return null;
  const d=Math.max(...hs)-Math.min(...hs);
  return d>0&&d<300?d:null;
}

/* ---------- sessões ---------- */
function sessoes(rows){
  const m=new Map();
  rows.forEach(r=>{const k=r.dateS+"|"+r.treino;if(!m.has(k))m.set(k,{key:k,date:r.date,dateS:r.dateS,treino:r.treino,rows:[]});m.get(k).rows.push(r)});
  return [...m.values()].sort((a,b)=>a.date-b.date);
}
const volumeDe=rs=>sem(rs,r=>r.vol);
const repsDe=rs=>sem(rs,r=>r.reps?r.reps.reduce((a,b)=>a+b,0):0);
const academiaDe=rs=>{const r=rs.find(x=>x.academia);return r?r.academia:""};
function porExercicio(rs){
  const m=new Map();
  rs.forEach(r=>{if(!r.ex)return;const k=base(r.ex);if(!m.has(k))m.set(k,{k,nome:semLadoNome(r.ex),rows:[]});m.get(k).rows.push(r)});
  return [...m.values()];
}
const eCardio=r=>/^cardio$/i.test(r.grupo||"");
function topoMeta(m){const n=String(m||"").match(/\d+/g);if(!n||/completar|round|cada|min|falha/i.test(m))return null;return Math.max(...n.map(Number))}

/* ---------- avaliação de um treino ---------- */
function treino(rows,key){
  const todas=sessoes(rows);const ses=todas.find(s=>s.key===key);if(!ses)return null;
  const gym=academiaDe(ses.rows);
  const antes=rows.filter(r=>r.date<ses.date);
  const out={key,dateS:ses.dateS,treino:ses.treino,academia:gym,duracao:duracaoDe(ses.rows),animo:animoDe(ses.rows),bem:[],abaixo:[],comentarios:[],proximo:[],titulo:"",resumo:""};
  const feitas=ses.rows.filter(r=>r.done&&!eCardio(r));
  const naoFeitas=ses.rows.filter(r=>!r.done&&/n[aã]o fiz/i.test(String(r.feitas)+" "+String(r.hora)));
  const subir=[],manter=[];
  porExercicio(ses.rows.filter(r=>!eCardio(r))).forEach(ex=>{
    const dn=ex.rows.filter(r=>r.done);if(!dn.length)return;
    const anteriores=antes.filter(r=>base(r.ex)===ex.k&&r.done);
    if(!anteriores.length){if(!antes.some(r=>base(r.ex)===ex.k))out.bem.push("Novo no seu histórico: <b>"+esc(ex.nome)+"</b>. Agora ele é a sua referência.");return}
    const mesmaGym=gym?anteriores.filter(r=>strip(r.academia)===strip(gym)):[];
    const ref=mesmaGym.length?mesmaGym:anteriores;
    const ultData=ref[ref.length-1].dateS;const prev=ref.filter(r=>r.dateS===ultData);
    const curV=volumeDe(dn)||repsDe(dn),prevV=volumeDe(prev)||repsDe(prev);
    const d=pct(curV,prevV);
    const bestE=Math.max(0,...dn.map(r=>r.e1||0)),recE=Math.max(0,...ref.map(r=>r.e1||0));
    if(bestE&&recE&&bestE>recE+0.5)out.bem.push("🏆 Recorde em <b>"+esc(ex.nome)+"</b>: força estimada de "+nf(bestE)+" kg (antes "+nf(recE)+" kg).");
    else if(d!=null&&d>=3)out.bem.push("<b>"+esc(ex.nome)+"</b>: +"+d+"% de volume sobre "+esc(ultData.slice(0,5))+".");
    if(d!=null&&d<=-10){out.abaixo.push("<b>"+esc(ex.nome)+"</b>: "+d+"% de volume sobre "+esc(ultData.slice(0,5))+".");manter.push(ex.nome)}
    // meta batida em todas as séries, sem ter ido ao limite em todas
    const comMeta=dn.map(r=>({r,t:topoMeta(r.meta)})).filter(x=>x.t!=null);
    if(comMeta.length&&comMeta.length===dn.length&&comMeta.every(x=>x.r.reps&&x.r.reps[0]>=x.t)){
      const rirs=dn.map(r=>r.rir).filter(x=>x!=="");
      if(!rirs.length||rirs.some(x=>+x>=1))subir.push(ex.nome);
    }
  });
  if(naoFeitas.length){
    const nomes=[...new Set(naoFeitas.map(r=>semLadoNome(r.ex)))];
    out.abaixo.push(naoFeitas.length+(naoFeitas.length===1?" série não feita":" séries não feitas")+": "+nomes.slice(0,4).map(esc).join(", ")+".");
  }
  // comentários do treino entram na conclusão
  const C=analisarComentarios(ses.rows);const tem=id=>!!C.cont[id];
  TEMAS.forEach(t=>{if(C.cont[t.id])out.comentarios.push("<b>"+t.nome+":</b> “"+esc(C.frases[t.id][0].slice(0,110))+"”")});
  const justifica=[tem("sono")&&"sono",tem("cansaco")&&"cansaço",tem("animo")&&"pouco ânimo",tem("comida")&&"alimentação",tem("academia")&&"a academia"].filter(Boolean);
  if(out.abaixo.length&&justifica.length)out.abaixo.push("Faz sentido com o que você comentou ("+justifica.join(", ")+"). Não é perda de força: leve isso em conta.");
  // treino comparado com a média dos anteriores iguais
  const iguais=todas.filter(s=>s.treino===ses.treino&&s.date<ses.date).slice(-4);
  const volHoje=volumeDe(feitas);
  const media=iguais.length?iguais.reduce((a,s)=>a+volumeDe(s.rows.filter(r=>r.done&&!eCardio(r))),0)/iguais.length:0;
  const dv=media?pct(volHoje,media):null;
  out.volume=volHoje;out.series=feitas.length;out.volumeDif=dv;
  if(dv==null){out.titulo="Treino registrado";out.resumo=feitas.length+(feitas.length===1?" série feita":" séries feitas")+". Primeira referência deste treino."}
  else if(dv>=5){out.titulo="Treino forte 💪";out.resumo="Volume "+dv+"% acima da sua média neste treino."}
  else if(dv<=-15){out.titulo="Treino abaixo do normal";out.resumo="Volume "+Math.abs(dv)+"% abaixo da sua média neste treino."+(justifica.length?" Você comentou: "+justifica.join(", ")+".":"")}
  else{out.titulo="Treino dentro do normal";out.resumo="Volume parecido com a sua média neste treino."}
  // próximo treino
  subir.slice(0,4).forEach(n=>out.proximo.push("⬆ Suba um pouco a carga em <b>"+esc(n)+"</b>: você bateu a meta em todas as séries."));
  manter.slice(0,3).forEach(n=>out.proximo.push("➡ Mantenha a carga em <b>"+esc(n)+"</b> e tente voltar ao que fez antes."));
  Object.keys(C.partes).slice(0,3).forEach(p=>out.proximo.push("⚠ Atenção ao <b>"+esc(p)+"</b>: reduza a carga se doer e avise o professor se continuar."));
  if(tem("dor")&&!Object.keys(C.partes).length)out.proximo.push("⚠ Você comentou dor ou incômodo. Vá com calma e avise o professor se continuar.");
  if(tem("sono"))out.proximo.push("😴 Tente dormir melhor antes do próximo treino.");
  if(tem("comida"))out.proximo.push("🍽 Coma bem antes do próximo treino.");
  if(naoFeitas.length)out.proximo.push("🔁 Retome as séries que ficaram para trás, se der.");
  if(!out.proximo.length)out.proximo.push("✅ Repita o treino buscando pelo menos 1 repetição a mais nas séries principais.");
  if(!out.bem.length)out.bem.push("Você apareceu e treinou. Constância é o que mais conta.");
  return out;
}

/* ---------- resumo do mês ---------- */
const chaveMes=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
const NOMES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const nomeMes=k=>{const [a,m]=k.split("-");return NOMES[+m-1]+" de "+a};
function meses(rows){return [...new Set(rows.map(r=>chaveMes(r.date)))].sort().reverse()}
function mes(rows,k){
  const [a,m]=k.split("-").map(Number);
  return periodo(rows,new Date(a,m-1,1),new Date(a,m,1),new Date(a,m-2,1),nomeMes(k),"mês anterior");
}
// Resumo de qualquer período [ini, fim). iniAnt: início do período anterior, para comparar.
function periodo(rows,ini,fim,iniAnt,nome,rotAnt){
  const cur=rows.filter(r=>r.date>=ini&&r.date<fim),ant=iniAnt?rows.filter(r=>r.date>=iniAnt&&r.date<ini):[];
  const nS=rs=>new Set(rs.map(r=>r.dateS+"|"+r.treino)).size;
  const fe=rs=>rs.filter(r=>r.done&&!eCardio(r));
  const out={nome,rotAnt:rotAnt||"período anterior",linhas:cur,treinos:nS(cur),treinosAnt:nS(ant),series:fe(cur).length,seriesAnt:fe(ant).length,volume:volumeDe(fe(cur))/1000,volumeAnt:volumeDe(fe(ant))/1000,
    grupos:[],recordes:[],evolucoes:[],comentarios:[],partes:[],animo:{bom:0,ok:0,ruim:0},duracao:null,foco:[]};
  const antes=rows.filter(r=>r.date<ini);
  const gs=[...new Set(fe(cur).map(r=>r.grupo))];
  out.grupos=gs.map(g=>{const v=volumeDe(fe(cur).filter(r=>r.grupo===g))/1000,va=volumeDe(fe(ant).filter(r=>r.grupo===g))/1000;return {g,v,dif:va?pct(v,va):null}}).filter(x=>x.v>0).sort((x,y)=>y.v-x.v);
  // recordes e evolução por exercício
  porExercicio(fe(cur)).forEach(ex=>{
    const best=Math.max(0,...ex.rows.map(r=>r.e1||0));if(!best)return;
    const hist=antes.filter(r=>base(r.ex)===ex.k&&r.e1).map(r=>r.e1);if(!hist.length)return;
    const rec=Math.max(...hist);if(best>rec+0.5)out.recordes.push({nome:ex.nome,de:rec,para:best});
    const pa=ant.filter(r=>base(r.ex)===ex.k&&r.e1).map(r=>r.e1);
    if(pa.length){const p=Math.max(...pa);const d=pct(best,p);if(d)out.evolucoes.push({nome:ex.nome,d})}
  });
  out.recordes.sort((x,y)=>(y.para-y.de)-(x.para-x.de));out.evolucoes.sort((x,y)=>y.d-x.d);
  const porSes=sessoes(cur);
  const durs=porSes.map(s=>duracaoDe(s.rows)).filter(Boolean);if(durs.length)out.duracao=Math.round(durs.reduce((x,y)=>x+y,0)/durs.length);
  // comentários: quantos treinos do mês tocaram em cada tema
  const temas={},partes={};
  porSes.forEach(s=>{const C=analisarComentarios(s.rows);Object.keys(C.cont).forEach(t=>temas[t]=(temas[t]||0)+1);Object.keys(C.partes).forEach(p=>partes[p]=(partes[p]||0)+1);
    const an=animoDe(s.rows);if(an)out.animo[an]++});
  out.comentarios=TEMAS.filter(t=>temas[t.id]).map(t=>({nome:t.nome,id:t.id,n:temas[t.id]})).sort((x,y)=>y.n-x.n);
  out.partes=Object.entries(partes).map(([p,n])=>({p,n})).sort((x,y)=>y.n-x.n);
  // foco do próximo mês
  const F=out.foco;
  if(out.treinosAnt&&out.treinos<out.treinosAnt)F.push("Frequência caiu de "+out.treinosAnt+" para "+out.treinos+" treinos. Priorize voltar à rotina.");
  else if(out.treinosAnt&&out.treinos>out.treinosAnt)F.push("Frequência subiu de "+out.treinosAnt+" para "+out.treinos+" treinos. Mantenha.");
  const quedas=out.grupos.filter(x=>x.dif!=null&&x.dif<=-15).slice(0,2);
  if(quedas.length)F.push("Volume caiu em "+quedas.map(x=>x.g+" ("+x.dif+"%)").join(" e ")+". Dê mais atenção.");
  out.partes.filter(x=>x.n>=2).slice(0,2).forEach(x=>F.push("Dor ou incômodo no "+x.p+" apareceu em "+x.n+" treinos. Vale ajustar exercícios e conversar com o professor."));
  const c=id=>temas[id]||0;
  if(c("sono")>=2)F.push("Sono ruim apareceu em "+c("sono")+" treinos. Melhorar o sono deve render mais que qualquer ajuste.");
  if(c("cansaco")>=3)F.push("Cansaço apareceu em "+c("cansaco")+" treinos. Avalie descanso e alimentação.");
  if(c("animo")>=2)F.push("Pouco ânimo apareceu em "+c("animo")+" treinos. Vale mudar horário, academia ou variar exercícios.");
  if(out.recordes.length)F.push("Bateu "+out.recordes.length+(out.recordes.length===1?" recorde":" recordes")+". O caminho está certo: siga progredindo a carga aos poucos.");
  if(!F.length)F.push("Mês estável. Busque aumentar repetições ou carga nos exercícios principais.");
  return out;
}

/* ---------- academias ---------- */
function academias(rows){
  const m=new Map();
  sessoes(rows).forEach(s=>{const g=academiaDe(s.rows);if(!g)return;const k=strip(g);
    if(!m.has(k))m.set(k,{nome:g,treinos:0,vol:0,bom:0,ok:0,ruim:0,durs:[],ultima:"",cargas:new Map()});
    const o=m.get(k);o.nome=g;o.treinos++;o.ultima=s.dateS;
    const fe=s.rows.filter(r=>r.done&&!eCardio(r));o.vol+=volumeDe(fe);
    const an=animoDe(s.rows);if(an)o[an]++;
    const d=duracaoDe(s.rows);if(d)o.durs.push(d);
    fe.forEach(r=>{if(r.peso&&r.e1)o.cargas.set(base(r.ex),{ex:semLadoNome(r.ex),peso:r.peso,reps:r.feitas,data:s.dateS,n:((o.cargas.get(base(r.ex))||{}).n||0)+1})});
  });
  return [...m.values()].map(o=>({nome:o.nome,treinos:o.treinos,ultima:o.ultima,volMedio:o.treinos?o.vol/o.treinos/1000:0,bom:o.bom,ok:o.ok,ruim:o.ruim,
    duracao:o.durs.length?Math.round(o.durs.reduce((a,b)=>a+b,0)/o.durs.length):null,
    cargas:[...o.cargas.values()].sort((a,b)=>b.n-a.n).slice(0,8)})).sort((a,b)=>b.treinos-a.treinos);
}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

return {treino,mes,periodo,meses,nomeMes,academias,sessoes,temasDe,partesComDor,animoDe,duracaoDe};
})();
