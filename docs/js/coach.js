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
    const txt=limpa(r.obs).replace(/^[\s·]+|[\s·]+$/g,"").replace(/(\s*·\s*){2,}/g," · ");if(!txt)return;
    temasDe(txt).forEach(id=>{cont[id]=(cont[id]||0)+1;(frases[id]=frases[id]||[]);if(frases[id].length<2&&!frases[id].includes(txt))frases[id].push(txt)});
    partesComDor(txt).forEach(p=>{partes[p]=(partes[p]||0)+1});
  });
  return {cont,frases,partes};
}
const EMO={bom:"😀",ok:"😐",ruim:"😞"},ORD={ruim:0,ok:1,bom:2};
// Ânimo marcado na chegada e na saída. A marcação antiga, de um toque só, conta como saída.
function animos(rows){
  const acha=rx=>{for(const r of rows){const m=String(r.obs||"").match(rx);if(m)return m[1].toLowerCase()}return ""};
  return {ini:acha(/\[[ÂA]nimo in[ií]cio: *(bom|ok|ruim)\]/i),fim:acha(/\[[ÂA]nimo fim: *(bom|ok|ruim)\]/i)||acha(/\[[ÂA]nimo: *(bom|ok|ruim)\]/i)};
}
// Ânimo do treino: o que foi marcado; senão, o que os comentários indicam.
function animoDe(rows){
  const a=animos(rows);if(a.fim||a.ini)return a.fim||a.ini;
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

const pesoNum=p=>{const m=String(p||"").trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*(cl|cada lado)?$/i);return m?{n:parseFloat(m[1].replace(",",".")),cl:!!m[2]}:null};
const fmtP=(n,cl)=>nf(n)+" kg"+(cl?" cada lado":"");
const incCarga=n=>n<20?1:n<60?2:5;
const volFeito=s=>{if(s.volF==null)s.volF=volumeDe(s.rows.filter(r=>r.done&&!eCardio(r)));return s.volF};
// Quanto um treino ficou acima ou abaixo da média dos últimos 4 treinos iguais.
function desvio(todas,s){
  const iguais=todas.filter(x=>x.treino===s.treino&&x.date<s.date).slice(-4);
  const m=iguais.length?iguais.reduce((a,x)=>a+volFeito(x),0)/iguais.length:0;
  return m?pct(volFeito(s),m):null;
}
// Treino difícil: ânimo baixo ou volume bem abaixo da média.
function eDificil(todas,s){const d=desvio(todas,s);return animoDe(s.rows)==="ruim"||(d!=null&&d<=-15)}
// Sequência: 8 ou mais treinos difíceis entre os últimos 10.
function sequenciaDificil(todas,ses){
  const ate=todas.filter(s=>s.date<=ses.date&&s.rows.some(r=>r.done)).slice(-10);
  if(ate.length<8)return null;
  const n=ate.filter(s=>eDificil(todas,s)).length;
  return n>=8?{dificeis:n,total:ate.length}:null;
}
/* Compara o ânimo com os outros dias parecidos, para comemorar ou ser compreensivo. */
function analisarAnimo(todas,ses,dv){
  const {ini,fim}=animos(ses.rows);if(!ini&&!fim)return null;
  const humor=ini||fim;const v=[];
  const outras=todas.filter(s=>s.date<ses.date&&animoDe(s.rows)===humor).map(s=>desvio(todas,s)).filter(x=>x!=null);
  const melhorou=ini&&fim&&ORD[fim]>ORD[ini],piorou=ini&&fim&&ORD[fim]<ORD[ini];
  if(melhorou)v.push("Você saiu melhor do que chegou: o treino ajudou.");
  if(humor==="ruim"){
    if(dv==null)v.push("Dia difícil, e você treinou mesmo assim. Isso conta.");
    else if(outras.length>=2){
      const m=Math.round(outras.reduce((a,b)=>a+b,0)/outras.length);
      v.push("Nos outros "+outras.length+" dias de ânimo baixo, seu volume ficou em média "+(m===0?"igual ao normal":Math.abs(m)+"% "+(m<0?"abaixo":"acima")+" do normal")+".");
      v.push(dv>m?"Hoje foi melhor que isso. Treinar em dias ruins está valendo a pena.":"Hoje ficou parecido, o que é normal nesses dias. Sem cobrança.");
    }else if(dv>=-5)v.push("Mesmo com ânimo baixo, você manteve o nível.");
    else v.push("Em dia difícil, render menos é normal. O importante foi aparecer.");
  }else if(humor==="bom"){
    if(dv!=null&&dv<=-15)v.push("Você chegou animado, mas o volume ficou abaixo. Vale olhar carga, descanso ou tempo de treino.");
    else if(!melhorou)v.push("Bom ânimo, e o treino acompanhou.");
  }else if(!melhorou&&!piorou)v.push("Dia normal, treino feito.");
  if(piorou)v.push("Você saiu mais desanimado do que chegou. Se isso se repetir, vale conversar com o professor sobre o treino.");
  return {ini,fim,texto:v.join(" ")};
}

/* Soma a semana e o mês até o treino avaliado, para saber se o que faltou hoje já foi feito. */
function contexto(rows,ses){
  const dt=n=>new Date(ses.date.getFullYear(),ses.date.getMonth(),ses.date.getDate()-n);
  const per=(a,b)=>rows.filter(r=>r.done&&!eCardio(r)&&r.date>=dt(a)&&r.date<=dt(b));
  const nS=rs=>new Set(rs.map(r=>r.dateS+"|"+r.treino)).size;
  const conta=rs=>{const m={};rs.forEach(r=>{const g=r.grupo||"Sem grupo";m[g]=(m[g]||0)+1});return m};
  const sem=per(6,0),ant=per(34,7),mes=per(29,0),mesAnt=per(59,30);
  const cs=conta(sem),ca=conta(ant),cm=conta(mes),cma=conta(mesAnt);
  const grupos=[...new Set(Object.keys(cs).concat(Object.keys(ca)))].map(g=>{const media=Math.round((ca[g]||0)/4),series=cs[g]||0;
    return {grupo:g,series,mediaSemanal:media,situacao:!media||series>=media*.9?"em dia":"abaixo"}});
  return {semana:{treinos:nS(sem),grupos},
    mes:{treinos:nS(mes),treinosMesAnterior:nS(mesAnt),volumeT:Math.round(volumeDe(mes)/100)/10,volumeMesAnteriorT:Math.round(volumeDe(mesAnt)/100)/10,
      grupos:[...new Set(Object.keys(cm).concat(Object.keys(cma)))].map(g=>({grupo:g,series:cm[g]||0,seriesMesAnterior:cma[g]||0}))}};
}

/* ---------- avaliação de um treino ---------- */
function treino(rows,key){
  const todas=sessoes(rows);const ses=todas.find(s=>s.key===key);if(!ses)return null;
  const gym=academiaDe(ses.rows);
  const antes=rows.filter(r=>r.date<ses.date);
  const out={key,dateS:ses.dateS,treino:ses.treino,academia:gym,duracao:duracaoDe(ses.rows),animo:animoDe(ses.rows),bem:[],abaixo:[],comentarios:[],proximo:[],titulo:"",resumo:""};
  const feitas=ses.rows.filter(r=>r.done&&!eCardio(r));
  const naoFeitas=ses.rows.filter(r=>!r.done&&/n[aã]o fiz/i.test(String(r.feitas)+" "+String(r.hora)));
  const subir=[],manter=[],difs=[],mais=[];out.metasEx={};out.quedas=[];
  const ctxTempo=contexto(rows,ses);out.contexto=ctxTempo;
  const inicioSem=new Date(ses.date.getFullYear(),ses.date.getMonth(),ses.date.getDate()-6);
  const sessoesSem=todas.filter(s=>s!==ses&&s.date>=inicioSem&&s.date<=ses.date);
  porExercicio(ses.rows.filter(r=>!eCardio(r))).forEach(ex=>{
    const dn=ex.rows.filter(r=>r.done);if(!dn.length)return;
    const anteriores=antes.filter(r=>base(r.ex)===ex.k&&r.done);
    const top=dn.slice().sort((a,b)=>(b.e1||0)-(a.e1||0))[0];const P=pesoNum(top.peso);const R=top.reps?top.reps[0]:null;
    const aSubir=()=>{if(!P)return ["subir um pouco a carga","suba um pouco a carga"];const nv=fmtP(P.n+incCarga(P.n),P.cl);return ["subir para "+nv+" (hoje "+fmtP(P.n,P.cl)+(R?" × "+R:"")+")",nv]};
    const aMais=()=>!R?null:P?[fmtP(P.n,P.cl)+" × "+(R+1)+" (1 repetição a mais)",fmtP(P.n,P.cl)+" × "+(R+1)]:[(R+1)+" repetições (1 a mais)",(R+1)+" repetições"];
    if(!anteriores.length){if(!antes.some(r=>base(r.ex)===ex.k))out.bem.push("Novo no seu histórico: <b>"+esc(ex.nome)+"</b>. Agora ele é a sua referência.");
      const pr=aMais();if(pr){mais.push({nome:ex.nome,txt:pr[0],curto:pr[1]});out.metasEx[ex.k]=pr[1]}return}
    const mesmaGym=gym?anteriores.filter(r=>strip(r.academia)===strip(gym)):[];
    const ref=mesmaGym.length?mesmaGym:anteriores;
    const ultData=ref[ref.length-1].dateS;const prev=ref.filter(r=>r.dateS===ultData);
    const curV=volumeDe(dn)||repsDe(dn),prevV=volumeDe(prev)||repsDe(prev);
    const d=pct(curV,prevV);
    const bestE=Math.max(0,...dn.map(r=>r.e1||0)),recE=Math.max(0,...ref.map(r=>r.e1||0));
    if(bestE&&recE&&bestE>recE+0.5)out.bem.push("🏆 Recorde em <b>"+esc(ex.nome)+"</b>: força estimada de "+nf(bestE)+" kg (antes "+nf(recE)+" kg).");
    else if(d!=null&&d>=3)out.bem.push("<b>"+esc(ex.nome)+"</b>: +"+d+"% de volume sobre "+esc(ultData.slice(0,5))+".");
    const aquec=/aquec/.test(ex.k);
    if(d!=null&&!aquec)difs.push({nome:ex.nome,d});
    if(d!=null&&d<=-10&&!aquec){
      const outra=sessoesSem.find(s=>s.rows.some(r=>r.done&&base(r.ex)===ex.k));
      const gr=dn[0].grupo||"Sem grupo";const sg=(ctxTempo.semana.grupos.find(x=>x.grupo===gr)||{}).situacao||"em dia";
      const ok=!!outra||sg==="em dia";
      const doGrupo=[...new Set(sessoesSem.filter(s=>s.rows.some(r=>r.done&&r.grupo===gr)).map(s=>s.treino))];
      out.quedas.push({exercicio:ex.nome,quedaPct:d,feitoTambemEm:outra?outra.treino:null,grupoTambemEm:doGrupo,grupo:gr,grupoNaSemana:sg,veredito:ok?"ok":"faltou"});
      out.abaixo.push("<b>"+esc(ex.nome)+"</b>: "+d+"% de volume sobre "+esc(ultData.slice(0,5))+"."+(outra?" Você já fez esse exercício em "+esc(outra.treino)+" nesta semana, então está tudo bem.":sg==="em dia"?(doGrupo.length?" Você já treinou "+esc(gr)+" em "+esc(doGrupo[0])+" nesta semana, então está tudo bem.":" "+esc(gr)+" está em dia na semana, então não falta nada."):" Vale completar "+esc(gr)+" ainda nesta semana."));
    }
    // meta batida em todas as séries, sem ter ido ao limite em todas
    let vaiSubir=false;
    const comMeta=dn.map(r=>({r,t:topoMeta(r.meta)})).filter(x=>x.t!=null);
    if(comMeta.length&&comMeta.length===dn.length&&comMeta.every(x=>x.r.reps&&x.r.reps[0]>=x.t)){
      const rirs=dn.map(r=>r.rir).filter(x=>x!=="");
      if(!rirs.length||rirs.some(x=>+x>=1))vaiSubir=true;
    }
    if(vaiSubir){const m=aSubir();subir.push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}
    else if(d!=null&&d<=-10){const prevR=Math.max(0,...prev.map(r=>r.reps?r.reps[0]:0));
      const m=P&&prevR?["manter "+fmtP(P.n,P.cl)+" e voltar às "+prevR+" repetições",fmtP(P.n,P.cl)+" × "+prevR]:["voltar ao que fez em "+ultData.slice(0,5),"voltar ao que fez em "+ultData.slice(0,5)];
      manter.push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}
    else{const m=aMais();if(m){mais.push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}}
  });
  if(naoFeitas.length){
    const nomes=[...new Set(naoFeitas.map(r=>semLadoNome(r.ex)))];
    out.abaixo.push(naoFeitas.length+(naoFeitas.length===1?" série não feita":" séries não feitas")+": "+nomes.slice(0,4).map(esc).join(", ")+".");
  }
  // comentários do treino entram na conclusão
  const C=analisarComentarios(ses.rows);const tem=id=>!!C.cont[id];
  TEMAS.forEach(t=>{if(C.cont[t.id])out.comentarios.push("<b>"+t.nome+":</b> “"+esc(C.frases[t.id][0].slice(0,110))+"”")});
  const justifica=[tem("sono")&&"sono",tem("cansaco")&&"cansaço",tem("animo")&&"pouco ânimo",tem("comida")&&"alimentação",tem("academia")&&"a academia"].filter(Boolean);
  const animoIni=animos(ses.rows).ini;
  const dificil=animoIni==="ruim"||justifica.length>0;
  if(out.abaixo.length&&justifica.length)out.abaixo.push("Faz sentido com o que você comentou ("+justifica.join(", ")+"). Não é perda de força: leve isso em conta.");
  // treino comparado com a média dos anteriores iguais
  const iguais=todas.filter(s=>s.treino===ses.treino&&s.date<ses.date).slice(-4);
  const volHoje=volumeDe(feitas);
  const media=iguais.length?iguais.reduce((a,s)=>a+volumeDe(s.rows.filter(r=>r.done&&!eCardio(r))),0)/iguais.length:0;
  const dv=media?pct(volHoje,media):null;
  out.volume=volHoje;out.series=feitas.length;out.volumeDif=dv;
  // comparação com os últimos treinos iguais
  const mediaDe=f=>{const a=iguais.map(f).filter(x=>x!=null&&x>0);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
  const mSeries=mediaDe(s=>s.rows.filter(r=>r.done&&!eCardio(r)).length),mTempo=mediaDe(s=>duracaoDe(s.rows));
  out.comp=iguais.length?{n:iguais.length,vol:volHoje/1000,volDif:dv,series:feitas.length,seriesDif:mSeries!=null?feitas.length-Math.round(mSeries):null,tempo:out.duracao,tempoDif:mTempo!=null&&out.duracao?out.duracao-Math.round(mTempo):null}:null;
  // o texto do parecer: o que aconteceu e o porquê
  const refA=iguais.length===1?"o último "+ses.treino:"a média dos últimos "+iguais.length+" treinos iguais";
  const refDe=iguais.length===1?"do último "+ses.treino:"da média dos últimos "+iguais.length+" treinos iguais";
  const motivo=justifica.length?"Você registrou "+justifica.join(", ")+". ":animoIni==="ruim"?"Você chegou com pouco ânimo. ":"";
  const ordenado=difs.slice().sort((a,b)=>b.d-a.d);const maior=ordenado[0],menor=ordenado[ordenado.length-1];
  const avanco=maior&&maior.d>=3?" O maior avanço foi em "+maior.nome+" (+"+maior.d+"%).":"";
  if(dv==null){out.titulo="Treino registrado";out.frase="foi a sua primeira vez nele";
    out.texto=motivo+feitas.length+(feitas.length===1?" série feita":" séries feitas")+". Este treino agora é a sua referência. No próximo, quero ver você passar dela."}
  else if(dv>=5){out.titulo=dificil?"Treino forte, mesmo em um dia difícil":"Treino forte";
    out.frase=(dificil?"mesmo em um dia difícil, ":"")+"você subiu "+dv+"% no volume";
    out.texto=motivo+(dificil?"Mesmo assim, você fez ":"Você fez ")+dv+"% a mais que "+refA+"."+avanco+" É esse nível que eu quero ver de novo."}
  else if(dv<=-15){const emDia=out.quedas.length>0&&out.quedas.every(q=>q.veredito==="ok");
    out.titulo=emDia?"Volume menor hoje, semana em dia":dificil?"Dia difícil, e você compareceu":"Hoje ficou abaixo do seu normal";
    out.frase=dificil?"foi um dia difícil e o volume ficou "+Math.abs(dv)+"% abaixo, sem problema":"o volume ficou "+Math.abs(dv)+"% abaixo";
    out.texto=motivo+"O volume ficou "+Math.abs(dv)+"% abaixo "+refDe+"."+(menor&&menor.d<0?" A maior queda foi em "+menor.nome+" ("+menor.d+"%).":"")+(emDia?" Mas a sua semana está em dia, então está tudo bem. Descanse e vamos para o próximo.":(dificil?" Faz sentido para um dia assim. Descanse, quero você bem no próximo.":" Já te vi fazendo melhor, quero ver de novo no próximo treino.")+" Se estiver com dificuldade, fale com o professor.")}
  else{out.titulo=dificil?"Dia difícil, e você manteve o nível":"Treino dentro da sua média";
    out.frase=(dificil?"mesmo em um dia difícil, ":"")+"você ficou na sua média";
    out.texto=motivo+"Você ficou perto "+refDe+"."+avanco+" No próximo, quero ver um pouco mais."}
  // frase final: o que o coach quer ver no próximo treino
  const emDiaFim=out.quedas.length>0&&out.quedas.every(q=>q.veredito==="ok");
  out.fecho=dv!=null&&dv>=5?"É esse nível que eu quero ver de novo no próximo treino.":emDiaFim?"Hoje já foi, amanhã é outro dia. Descanse, quero você voando no próximo treino.":dificil?"Descanse e cuide do corpo. Quero você bem no próximo treino.":dv!=null&&dv<=-15?"Já te vi fazendo melhor, quero ver de novo no próximo treino.":"No próximo treino, quero ver um pouco mais.";
  out.resumo=out.texto;
  out.animoInfo=analisarAnimo(todas,ses,dv);
  const sq=sequenciaDificil(todas,ses);
  if(sq){out.sequencia=sq;out.sequenciaTexto=sq.dificeis+" dos seus últimos "+sq.total+" treinos foram difíceis. Eu vi que você continuou vindo, e isso conta. Agora preciso que você busque o que te motiva: relembre o seu objetivo, teste outro horário ou fale com o professor."}
  // próximo treino
  // aquecimento não vira meta
  Object.keys(out.metasEx).forEach(k=>{if(/aquec/.test(k))delete out.metasEx[k]});
  out.metasLista=subir.concat(manter,mais).filter(m=>!/aquec/i.test(m.nome)).slice(0,4);
  out.metasLista.forEach(m=>out.proximo.push("<b>"+esc(m.nome)+":</b> "+esc(m.txt)));
  Object.keys(C.partes).slice(0,3).forEach(p=>out.proximo.push("⚠ Atenção ao <b>"+esc(p)+"</b>: reduza a carga se doer e avise o professor se continuar."));
  if(tem("dor")&&!Object.keys(C.partes).length)out.proximo.push("⚠ Você comentou dor ou incômodo. Vá com calma e avise o professor se continuar.");
  if(tem("sono"))out.proximo.push("<b>Sono:</b> tente dormir melhor na véspera.");
  if(tem("comida"))out.proximo.push("<b>Alimentação:</b> coma bem antes do treino.");
  if(naoFeitas.length)out.proximo.push("<b>Séries que faltaram:</b> retome, se der.");
  if(!out.proximo.length)out.proximo.push("Repita o treino buscando pelo menos 1 repetição a mais nas séries principais.");
  if(!out.bem.length)out.bem.push("Você compareceu e fez o treino.");
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
    grupos:[],recordes:[],evolucoes:[],comentarios:[],partes:[],animo:{bom:0,ok:0,ruim:0},animoMudou:{melhorou:0,igual:0,piorou:0},duracao:null,foco:[]};
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
    const an=animoDe(s.rows);if(an)out.animo[an]++;
    const am=animos(s.rows);if(am.ini&&am.fim){const d=ORD[am.fim]-ORD[am.ini];out.animoMudou[d>0?"melhorou":d<0?"piorou":"igual"]++}});
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
/* ---------- recado do coach, antes e durante o treino ---------- */
function recado(rows,nome,memoria){
  const ses=sessoes(rows).filter(s=>s.treino===nome&&s.rows.some(r=>r.done));
  if(!ses.length)return {html:"Primeira vez neste treino: hoje é dia de criar referência. Escolha cargas confortáveis e anote tudo.",metas:{}};
  const last=ses[ses.length-1];const A=treino(rows,last.key);if(!A)return {html:"",metas:{}};
  const hoje=(A.metasLista||[]).slice(0,2);
  const mem=memoria&&memoria.get(last.key);
  const seq=A.sequencia?" Nos últimos treinos tem sido mais difícil: busque hoje algo que renove a sua motivação.":"";
  return {html:(mem&&mem.recado?esc(mem.recado):"No último "+esc(nome)+" ("+esc(last.dateS.slice(0,5))+"), "+esc(A.frase)+".")+seq+" <b>Hoje espere:</b> "+
    (hoje.length?hoje.map(m=>esc(m.nome)+" com "+esc(m.curto)).join(" e "):"pelo menos 1 repetição a mais nas séries principais")+".",metas:A.metasEx||{}};
}
function recadoPicker(rows,sug){
  const ses=sessoes(rows).filter(s=>s.rows.some(r=>r.done));if(!ses.length)return "";
  const last=ses[ses.length-1];const hoje=new Date();const dias=Math.round((new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate())-last.date)/864e5);
  const A=treino(rows,last.key);
  return (dias<=0?"Você já treinou hoje.":dias===1?"Você treinou ontem.":"Faz "+dias+" dias do seu último treino.")+(A?" Último parecer: "+esc(A.titulo.toLowerCase())+".":"")+(sug?" A sugestão de hoje é <b>"+esc(sug)+"</b>.":"");
}
// O que vai para a IA escrever o parecer: números e comentários, sem nome nem contato.
function fatosIA(A){
  const tira=s=>String(s).replace(/<[^>]+>/g,"");
  const ai=A.animoInfo||{};
  return {treino:A.treino,data:A.dateS,avaliacaoPorRegras:A.titulo+". "+A.texto,fecho:A.fecho,quedas:A.quedas,semana:A.contexto.semana,mes:A.contexto.mes,
    animo:{chegou:ai.ini||"",saiu:ai.fim||"",analise:ai.texto||""},comparacao:A.comp||null,
    destaques:A.bem.slice(0,4).map(tira),atencao:A.abaixo.slice(0,4).map(tira),comentarios:A.comentarios.map(tira),
    metas:A.proximo.map(tira),sequenciaDificil:A.sequencia||null};
}
// Resposta ao marcar como está chegando.
function chegada(rows,ini){
  if(ini==="bom")return "Boa! Dia bom para buscar as metas.";
  if(ini==="ok")return "No seu ritmo. Foque em manter a técnica.";
  if(ini!=="ruim")return "";
  const dias=sessoes(rows).map(s=>animos(s.rows)).filter(a=>a.ini==="ruim"&&a.fim);
  const melhor=dias.filter(a=>ORD[a.fim]>0).length;
  return "Dia difícil, eu entendo. Hoje o objetivo é cumprir o treino."+(dias.length>=2?" Das outras "+dias.length+" vezes que chegou assim, você saiu melhor em "+melhor+".":"");
}
// Resposta ao marcar como está saindo.
function saida(ini,fim){
  if(!fim)return "";
  if(!ini)return fim==="ruim"?"Dia pesado, e você fez mesmo assim.":"Treino feito!";
  const txt="Chegou "+EMO[ini]+" e saiu "+EMO[fim]+". ";
  if(ORD[fim]>ORD[ini])return txt+"O treino levantou o seu ânimo!";
  if(ORD[fim]<ORD[ini])return txt+"Normal em treino puxado. Vamos ver como fica no próximo.";
  return txt+(fim==="ruim"?"Dia pesado, e você fez mesmo assim.":fim==="bom"?"Manteve o ânimo lá em cima.":"Treino feito, ânimo estável.");
}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

return {treino,mes,periodo,meses,nomeMes,academias,sessoes,temasDe,partesComDor,animoDe,animos,duracaoDe,recado,recadoPicker,chegada,saida,base,fatosIA,EMO};
})();
