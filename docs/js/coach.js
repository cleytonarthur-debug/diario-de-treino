/* Coach de bolso: análise por regras, sem IA externa e sem custo.
   Lê as linhas do histórico (já tratadas pelo app) e os comentários do aluno.
   Tudo é calculado no próprio aparelho. */
window.Coach=(function(){
"use strict";
const strip=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\bdoreita\b/g,"direita").replace(/\s+/g," ").trim();
const SEM_LADO=/\s+(?:lado\s+)?(e|d|esquerd[oa]|direit[oa])\s*$/;
const base=n=>strip(n).replace(SEM_LADO,"").replace(/\s+(cl|cada lado|ambas?|ambos)\s*$/,"").trim();
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
  {id:"academia",nome:"Academia ruim ou cheia",rx:/academia ruim|academia sem|lotad|muito cheia|esperar liberar|horario de pico|\be pico\b|maquina ruim|maquina ocupada|ruim demais|era o maximo que tinha|era o que tinha/},
  {id:"bem",nome:"Treino bom",rx:/otimo|excelente|rendeu|muito bom|muito boa|me senti bem|forte hoje|fluiu|animad|bombou|show\b|perfeito/},
  {id:"fraqueza",nome:"Fraqueza ou mal-estar",rx:/fraquez|\bfrac[oa]\b|tontur|letargi|passei mal|mal estar|mal-estar|enjoo/},
  {id:"sonobom",nome:"Sono bom",rx:/dormi bem|dormi muito bem|bem dormid|sono bom|descansad/},
  {id:"comidaboa",nome:"Boa alimentação",rx:/comi bem|bem alimentad|carbad|alimentacao boa|comi direito/},
  {id:"academiaboa",nome:"Academia boa",rx:/academia boa|academia otima|academia vazia|academia tranquila/}
];
const CORPO=[["joelho",/joelho/],["ombro",/ombro/],["lombar",/lombar/],["cotovelo",/cotovelo/],["punho",/punho/],["pescoço",/pescoco/],["quadril",/quadril/],["costas",/\bcostas\b/],["peito",/\bpeito\b/],["tornozelo",/tornozelo/],["bíceps",/biceps/]];
const limpa=s=>String(s||"").replace(/\[(Ânimo|Animo|Duração|Duracao|Método|Metodo|Meta coach)[^\]]*\]/gi," ").replace(/\[(Treino|Exercício|Exercicio)\]/gi," ");
function temasDe(texto){
  const t=strip(limpa(texto));if(!t)return [];
  return TEMAS.filter(x=>{const m=t.match(x.rx);if(!m)return false;
    if(x.id==="sono"||x.id==="comida")return true;
    const antes=t.slice(Math.max(0,m.index-14),m.index);return !/(nao|sem|nem)( senti| tive| passei| fiquei| estou| to)? $/.test(antes)}).map(x=>x.id);
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
/* Cada comentário com o exercício a que ele se refere. O do fim do treino vale para o exercício que ele citar. */
const NOME_GENERICO=/^(maquina|barra|polia|halter|sentado|deitado|ambas|ambos|direita|esquerda|aquecimento|exercicio)$/;
function comentariosDe(rows){
  const v=[],vistos=new Set();
  const nomes=[...new Map(rows.filter(r=>r.ex).map(r=>[base(r.ex),semLadoNome(r.ex)])).entries()];
  rows.forEach(r=>{
    String(r.obs||"").split(/\s+·\s+/).forEach(p=>{
      if(/^\s*no lugar de:/i.test(p))return;
      const doTreino=/^\s*\[Treino\]/i.test(p);const txt=limpa(p).trim();if(!txt)return;
      const k=doTreino?"":base(r.ex);const chave=k+"|"+strip(txt).slice(0,40);if(vistos.has(chave))return;vistos.add(chave);
      const t=strip(txt);
      const citados=doTreino?nomes.filter(([n])=>n.split(" ").some(w=>w.length>=5&&!NOME_GENERICO.test(w)&&new RegExp("\\b"+w+"\\b").test(t))).map(([n])=>n):[k];
      v.push({doTreino,k,nome:doTreino?"":semLadoNome(r.ex),texto:txt,citados});
    });
  });
  return v;
}
const RX_PESADO=/massacr|muito pesad|bem pesad|pesad[oa] demais|muito dificil|dificil de|nao aguent|acabou comigo|destruiu|exagerad|\b(mas|\d+ ?(kg)?) e muito\b(?! (bom|boa|melhor|legal|facil))/;
const RX_LEVE=/muito leve|bem leve|leve demais|facil demais|muito facil|podia mais|dava para mais|da para subir/;
const RX_PEDIDO=/\b(revise|revisar|verifique|verificar|confira|conferir|troque|trocar|tirar|tire|mude|corrija|corrigir|errad[oa]|tem de ser|tem que ser|deveria|nao pode ser|entenda)\b/;
const RX_MAQ=/outra maquina|maquina diferente|maquinas diferentes|outro aparelho|aparelho diferente|aparelhos diferentes|nao e a mesma maquina|maquina nao e a mesma/;
const RX_OUTRA_ACAD=/outra academia|academia diferente|maquinas diferentes|aparelhos diferentes/;
const numKg=s=>parseFloat(String(s).replace(",","."));
// "Não tem 22 kg, ou é 20 ou 25": carga que não existe naquela academia e a opção logo abaixo dela.
function faltasDe(rows){
  const m=new Map();
  rows.forEach(r=>{const t=strip(limpa(r.obs));
    for(const x of t.matchAll(/nao tem (\d+(?:[.,]\d+)?)/g)){const kg=numKg(x[1]);
      const abaixo=(t.match(/\d+(?:[.,]\d+)?/g)||[]).map(numKg).filter(n=>n<kg&&n>=kg*.5);
      m.set(kg,abaixo.length?Math.max(...abaixo):(m.get(kg)||null))}
  });
  return m;
}
// Dor em uma parte do corpo só vira meta no treino que usa essa parte.
const REGIAO={joelho:"inf",quadril:"inf",tornozelo:"inf",ombro:"sup",cotovelo:"sup",punho:"sup","pescoço":"sup",peito:"sup","bíceps":"sup",costas:"sup",lombar:"ambos"};
function parteCabe(p,rows){
  const g=new Set(rows.filter(r=>r.done).map(r=>r.grupo));
  const inf=g.has("Inferiores"),sup=["Peito","Costas","Ombros","Braços"].some(x=>g.has(x));
  if(!inf&&!sup&&[...g].some(x=>x!=="Abdômen"&&x!=="Cardio"))return true;
  const z=REGIAO[p];return z==="inf"?inf:z==="sup"?sup:inf||g.has("Costas");
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
// Nomes diferentes para o mesmo lugar viram um só. Só troca quando a pessoa escreve exatamente o apelido.
function nomeAcademia(n){
  const t=String(n||"").trim();const k=strip(t);
  if(/^(rex|rex ?fit|ct|rex ?ct|rex ?fit ?ct|ct rex|ct rex ?fit)$/.test(k))return "REX FIT CT";
  if(/^smart ?fit$/.test(k))return "Smartfit Batel";
  return t;
}
const academiaDe=rs=>{const r=rs.find(x=>x.academia);return r?nomeAcademia(r.academia):""};
function porExercicio(rs){
  const m=new Map();
  rs.forEach(r=>{if(!r.ex)return;const k=base(r.ex);if(!m.has(k))m.set(k,{k,nome:semLadoNome(r.ex),rows:[]});m.get(k).rows.push(r)});
  return [...m.values()];
}
const eCardio=r=>/^cardio$/i.test(r.grupo||"");
function topoMeta(m){m=String(m||"").replace(/\s*(bi-set|drop set|rest pause).*$/i,"");const n=m.match(/\d+/g);if(!n||/completar|round|cada|min|falha/i.test(m))return null;return Math.max(...n.map(Number))}

const pesoNum=p=>{const m=String(p||"").trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*(cl|cada lado)?$/i);return m?{n:parseFloat(m[1].replace(",",".")),cl:!!m[2]}:null};
const fmtP=(n,cl)=>nf(n)+" kg"+(cl?" cada lado":"");
// Salto de carga: de quantos em quantos kg a máquina sobe. Sem ele, um passo padrão pelo tamanho da carga.
const incCarga=(n,salto)=>salto>0?salto:n<20?1:n<60?2:5;
// Próxima carga que a máquina permite: com salto de 5 kg, depois de 57 vem 60, e depois de 60 vem 65.
const proxCarga=(n,salto)=>salto>0?Math.round((Math.floor(n/salto+1e-9)+1)*salto*100)/100:n+incCarga(n);
const saltoDe=rs=>{for(let i=rs.length-1;i>=0;i--){const v=parseFloat(String(rs[i].salto||"").replace(",","."));if(v>0)return v}return 0};
const maqDe=rs=>{for(let i=rs.length-1;i>=0;i--)if(rs[i].maq)return rs[i].maq;return ""};
// Mesma máquina, ou sem marca anotada em uma das duas (aí não dá para saber e compara).
const mesmaMaq=(a,b)=>!a||!b||strip(a)===strip(b);
const volFeito=s=>{if(s.volF==null)s.volF=volumeDe(s.rows.filter(r=>r.done&&!eCardio(r)));return s.volF};
// Quanto um treino ficou acima ou abaixo da média dos últimos 4 treinos iguais.
function desvio(todas,s){
  const iguais=todas.filter(x=>x.treino===s.treino&&x.date<s.date).slice(-4);
  const m=iguais.length?iguais.reduce((a,x)=>a+volFeito(x),0)/iguais.length:0;
  return m?pct(volFeito(s),m):null;
}
/* Treino fora da academia de sempre, sem outro treino igual feito lá: os pesos não dão para comparar. */
function acadDif(todas,s){
  if(s.rows.some(r=>RX_OUTRA_ACAD.test(strip(limpa(r.obs)))))return true;
  const gym=strip(academiaDe(s.rows));if(!gym)return false;
  const ini=new Date(+s.date-120*864e5),conta={};
  todas.filter(x=>x.date>=ini&&x.date<s.date).forEach(x=>{const g=strip(academiaDe(x.rows));if(g)conta[g]=(conta[g]||0)+1});
  const hab=Object.entries(conta).sort((a,b)=>b[1]-a[1])[0];if(!hab||hab[0]===gym)return false;
  return !todas.some(x=>x.date<s.date&&x.treino===s.treino&&strip(academiaDe(x.rows))===gym);
}
// Treino difícil: ânimo baixo ou volume bem abaixo da média, a não ser que a academia explique.
function eDificil(todas,s){const d=desvio(todas,s);return animoDe(s.rows)==="ruim"||(d!=null&&d<=-15&&!acadDif(todas,s))}
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
  const totalSem=sem.length,mediaTotal=Math.round(ant.length/4);
  const avaliacao=!mediaTotal?"sem referência":totalSem>=mediaTotal*1.2?"alto":totalSem>=mediaTotal*.9?"bom":"abaixo";
  return {semana:{treinos:nS(sem),seriesTotal:totalSem,mediaSemanalTotal:mediaTotal,avaliacaoVolume:avaliacao,grupos},
    mes:{treinos:nS(mes),treinosMesAnterior:nS(mesAnt),volumeT:Math.round(volumeDe(mes)/100)/10,volumeMesAnteriorT:Math.round(volumeDe(mesAnt)/100)/10,
      grupos:[...new Set(Object.keys(cm).concat(Object.keys(cma)))].map(g=>({grupo:g,series:cm[g]||0,seriesMesAnterior:cma[g]||0}))}};
}

/* Compara as academias pelo rendimento nos últimos 120 dias. Só opina com 3 treinos ou mais em cada uma. */
function melhorAcademia(todas,ses){
  const ini=new Date(+ses.date-120*864e5);
  const m=new Map();
  todas.filter(s=>s.date>=ini&&s.date<=ses.date&&s.rows.some(r=>r.done)).forEach(s=>{
    const g=academiaDe(s.rows);if(!g)return;const k=strip(g);const d=desvio(todas,s);if(d==null)return;
    if(!m.has(k))m.set(k,{nome:g,difs:[]});m.get(k).difs.push(d);
  });
  const lista=[...m.entries()].filter(([,o])=>o.difs.length>=3).map(([k,o])=>({k,nome:o.nome,treinos:o.difs.length,rendimento:Math.round(o.difs.reduce((a,b)=>a+b,0)/o.difs.length)})).sort((a,b)=>b.rendimento-a.rendimento);
  if(lista.length<2)return null;
  const gym=strip(academiaDe(ses.rows));const atual=lista.find(x=>x.k===gym);
  const base=atual?atual.rendimento:lista[lista.length-1].rendimento;
  const melhores=lista.filter(x=>x.k!==gym&&x.rendimento>=base+5).slice(0,2);
  return {comparacao:lista,melhores:melhores.map(x=>x.nome),atual:atual?atual.nome:""};
}

let MODELOS=null;
function setModelos(m){MODELOS=m}
/* Metas de longo prazo: primeiro o que a pessoa comentou nas últimas semanas, depois a tendência do mês.
   Cada meta traz uma pergunta para o aluno responder. */
function metasLongo(todas,ses,ctxTempo,inicial){
  const ini=new Date(+ses.date-30*864e5);const temas={},partes={};
  todas.filter(s=>s.date>=ini&&s.date<=ses.date).forEach(s=>{const C=analisarComentarios(s.rows);
    Object.keys(C.cont).forEach(t=>temas[t]=(temas[t]||0)+1);Object.keys(C.partes).forEach(p=>partes[p]=(partes[p]||0)+1)});
  const vz=n=>n+(n===1?" vez":" vezes");const art={lombar:"da lombar",costas:"das costas"};const v=[];
  const meta=(id,txt,perg)=>v.push({id,txt,perg});
  Object.entries(partes).filter(([p])=>parteCabe(p,ses.rows)).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([p,n])=>meta("parte-"+p,"<b>Cuidar "+(art[p]||"do "+p)+" nas próximas semanas:</b> você comentou "+vz(n)+". Vamos com carga controlada e, se continuar, fale com o professor.","Como está "+(art[p]?art[p].replace(/^da /,"a ").replace(/^das /,"as "):"o "+p)+" agora? Dói em algum exercício?"));
  if((temas.sono||0)>=2)meta("sono","<b>Melhorar o sono:</b> você comentou "+vz(temas.sono)+" no último mês, e isso pesa no seu rendimento.","Quantas horas você tem dormido? O que está atrapalhando?");
  if((temas.cansaco||0)+(temas.fraqueza||0)>=2)meta("recuperacao","<b>Cuidar da recuperação:</b> o cansaço ou a fraqueza apareceram "+vz((temas.cansaco||0)+(temas.fraqueza||0))+" no último mês. Vale olhar descanso e alimentação.","Como estão o seu descanso e a sua alimentação nesta semana?");
  if((temas.animo||0)>=2)meta("animo","<b>Achar o que te motiva:</b> o pouco ânimo apareceu "+vz(temas.animo)+". Vale testar outro horário ou outra academia.","O que tem tirado a sua vontade de treinar?");
  if(temas.comida)meta("comida","<b>Acertar a alimentação antes do treino:</b> você comentou "+vz(temas.comida)+" no último mês.","O que você costuma comer antes de treinar, e quanto tempo antes?");
  if((temas.tempo||0)>=2)meta("tempo","<b>Organizar o tempo de treino:</b> a correria apareceu "+vz(temas.tempo)+" no último mês.","Qual horário ou dia fica mais tranquilo para você treinar?");
  if((temas.academia||0)>=2)meta("academia","<b>Buscar horário ou academia mais tranquilos:</b> você comentou sobre isso "+vz(temas.academia)+".","O que mais atrapalha na academia: lotação, aparelho ou horário?");
  if(inicial)meta("inicio","<b>Nas primeiras semanas:</b> o foco é pegar a técnica e a rotina. A carga sobe depois, no tempo certo.","Como está sendo o começo? Algum exercício ficou difícil de fazer?");
  else{const cai=(ctxTempo.mes.grupos||[]).filter(g=>g.seriesMesAnterior>=8&&g.series<g.seriesMesAnterior*.7).sort((a,b)=>a.series/a.seriesMesAnterior-b.series/b.seriesMesAnterior)[0];
    if(cai)meta("grupo-"+strip(cai.grupo),"<b>Recuperar "+esc(cai.grupo)+" ao longo do mês:</b> o volume desse grupo caiu em relação ao mês anterior.","O que fez "+esc(cai.grupo)+" cair neste mês?");}
  if(!v.length)meta("regular","<b>Manter a regularidade:</b> seguir assim no próximo mês e subir as cargas aos poucos.","O que está te ajudando a manter o ritmo?");
  return v.slice(0,3);
}

/* ---------- relação entre o que a pessoa relatou e o treino ---------- */
const FATORES=[["sono","Sono ruim",-1],["fraqueza","Fraqueza ou mal-estar",-1],["cansaco","Cansaço",-1],["comida","Alimentação ruim",-1],["academia","Academia ruim",-1],["sonobom","Sono bom",1],["comidaboa","Boa alimentação",1],["academiaboa","Academia boa",1]];
const sinalPct=x=>x===0?"igual ao normal":Math.abs(x)+"% "+(x>0?"acima":"abaixo")+" do normal";
// Compara o volume nos treinos com e sem cada coisa relatada. Mostra relação, não prova a causa.
function nexo(todas,ate){
  const ini=new Date(+ate-90*864e5);
  const base=todas.filter(s=>s.date>=ini&&s.date<=ate&&s.rows.some(r=>r.done)).filter(s=>!acadDif(todas,s)).map(s=>({d:desvio(todas,s),c:analisarComentarios(s.rows).cont})).filter(x=>x.d!=null);
  const media=l=>l.length?Math.round(l.reduce((a,x)=>a+x.d,0)/l.length):null;
  return FATORES.map(([id,nome,sinal])=>{
    const com=base.filter(x=>x.c[id]),sem=base.filter(x=>!x.c[id]);if(!com.length)return null;
    const mc=media(com),ms=media(sem),dif=ms==null?null:mc-ms;
    const efeito=com.length<2||dif==null?"pouca base":sinal<0?(dif<=-5?"pesou":"nao derrubou"):(dif>=5?"ajudou":"nao apareceu");
    return {id,nome,sinal,n:com.length,media:mc,outros:ms,efeito,texto:"<b>"+nome+":</b> "+com.length+(com.length===1?" treino":" treinos")+", volume "+sinalPct(mc)+(ms!=null?" (nos outros, "+sinalPct(ms)+")":"")+". "+({"pouca base":"Ainda é pouca base.",pesou:"Parece ter pesado.","nao derrubou":"Não derrubou o rendimento.",ajudou:"Parece ter ajudado.","nao apareceu":"O ganho esperado não apareceu."})[efeito]};
  }).filter(Boolean).sort((a,b)=>b.n-a.n);
}
// O que o relato explica neste treino. Comer e dormir bem pedem um treino que responda.
function nexoDoTreino(todas,ses){
  const d=desvio(todas,ses);if(d==null||acadDif(todas,ses))return "";
  const c=analisarComentarios(ses.rows).cont;const nomes=ids=>ids.filter(i=>c[i]).map(i=>FATORES.find(f=>f[0]===i)[1].toLowerCase());
  const ruins=nomes(["sono","fraqueza","cansaco","comida","academia"]),bons=nomes(["sonobom","comidaboa","academiaboa"]);
  const lista=l=>l.join(" e ");
  if(ruins.length&&d<=-5)return "Treino "+sinalPct(d)+" com "+lista(ruins)+" relatado: o relato ajuda a explicar a queda.";
  if(ruins.length&&d>=5)return "Mesmo com "+lista(ruins)+" relatado, o treino ficou "+sinalPct(d)+".";
  if(ruins.length)return "Com "+lista(ruins)+" relatado, o treino ficou "+sinalPct(d)+": o rendimento se manteve.";
  if(bons.length&&d>=0)return "Com "+lista(bons)+", o treino respondeu como esperado: "+sinalPct(d)+".";
  if(bons.length&&d<=-10)return "Com "+lista(bons)+", o esperado era o treino responder, mas ele ficou "+sinalPct(d)+". Vale olhar carga, técnica e recuperação.";
  return "";
}
function metaBatidaEm(ses){
  return ses.rows.some(r=>{const m=String(r.obs||"").match(/\[Meta coach: *([^\]]+)\]/i);return m&&r.done&&bateuAlvo(alvoDe(m[1]),r.reps&&r.reps[0],r.pesoN,r.meta)});
}
/* Parecer prévio para o professor: as últimas 4 semanas contra as 4 anteriores, com o que a pessoa relatou. */
function relatorio(rows){
  const hoje=new Date();const todas=sessoes(rows);const feitas=todas.filter(s=>s.rows.some(r=>r.done));
  const de=n=>new Date(+hoje-n*864e5);
  const rec=feitas.filter(s=>s.date>=de(28)),ant=feitas.filter(s=>s.date>=de(56)&&s.date<de(28));
  const vol=l=>l.reduce((a,s)=>a+volFeito(s),0);const vr=vol(rec),va=vol(ant),volDif=va?pct(vr,va):null;
  const recordes=[];new Set(rec.flatMap(s=>s.rows.filter(r=>r.done&&!eCardio(r)&&!/aquec/i.test(r.ex)).map(r=>base(r.ex)))).forEach(k=>{
    const e=l=>Math.max(0,...l.flatMap(s=>s.rows.filter(r=>r.done&&base(r.ex)===k).map(r=>r.e1||0)));
    const antes=feitas.filter(s=>s.date<de(28));const a=e(antes),n=e(rec);if(a&&n>a+.5)recordes.push(k)});
  const metas=rec.filter(metaBatidaEm).length;
  let veredito,tom;
  if(!rec.length){veredito="Sem treino nas últimas 4 semanas";tom="bad"}
  else if(!ant.length){veredito="Ainda criando referência";tom="flat"}
  else if(rec.length<=ant.length*.6){veredito="Frequência em queda";tom="bad"}
  else if(volDif!=null&&volDif<=-10){veredito=recordes.length?"Volume em queda, com recordes":"Volume em queda";tom="bad"}
  else if((volDif!=null&&volDif>=5)||recordes.length>=2){veredito="Evoluindo";tom="good"}
  else{veredito="Estável";tom="flat"}
  const ultima=feitas[feitas.length-1];
  const coms=rec.flatMap(s=>comentariosDe(s.rows).filter(x=>RX_PEDIDO.test(strip(x.texto))).map(x=>({data:s.dateS.slice(0,5),exercicio:x.nome||"treino todo",texto:x.texto.slice(0,200)})));
  const partes={};rec.forEach(s=>Object.keys(analisarComentarios(s.rows).partes).forEach(p=>partes[p]=(partes[p]||0)+1));
  return {veredito,tom,treinos:rec.length,treinosAntes:ant.length,volumeT:Math.round(vr/100)/10,volumeDif:volDif,recordes:recordes.length,metasBatidas:metas,
    fatores:nexo(todas,hoje),ultimoTreino:ultima?ultima.dateS.slice(0,5)+" · "+ultima.treino:"",nexoUltimo:ultima?nexoDoTreino(todas,ultima):"",pedidos:coms.slice(-5),dores:Object.entries(partes).map(([p,n])=>({parte:p,treinos:n}))};
}

/* ---------- avaliação de um treino ---------- */
/* Meta do coach na série: fica verde, fica dourada quando cumpre e depois é firmada por 3 treinos. */
const FIRMAR=3;
function alvoDe(txt){
  const t=String(txt||"");const p=t.match(/(\d+(?:[.,]\d+)?)\s*kg/i),rp=t.match(/×\s*(\d+)/)||t.match(/(\d+)\s*repeti/i);
  const peso=p?parseFloat(p[1].replace(",",".")):null,reps=rp?+rp[1]:null;
  return peso==null&&reps==null?null:{peso,pesoT:peso!=null&&/cada lado/i.test(t)?peso*2:peso,reps,texto:t};
}
function bateuAlvo(alvo,reps,peso,meta){
  if(!alvo||!reps)return false;
  const feito=Array.isArray(peso)?Math.max(...peso):peso; // no histórico, cada lado já vem somado
  if(alvo.pesoT!=null&&!(feito>=alvo.pesoT))return false;
  const m=String(meta||"").match(/\d+/);
  return reps>=(alvo.reps!=null?alvo.reps:m?+m[0]:1);
}
// Refaz o caminho do exercício pelo histórico: quando bateu, quantos treinos firmou e quando consolidou.
function estadoMeta(rows,k,ate){
  const dias=new Map();
  rows.forEach(r=>{if(r.done&&base(r.ex)===k&&(!ate||r.date<=ate)){if(!dias.has(r.dateS))dias.set(r.dateS,[]);dias.get(r.dateS).push(r)}});
  const st={alvo:null,n:0,ev:null,evAlvo:null};
  [...dias.values()].forEach(rs=>{
    st.ev=null;
    const bate=a=>rs.some(r=>bateuAlvo(a,r.reps&&r.reps[0],r.pesoN,r.meta));
    const faltas=faltasDe(rs);const gymDia=strip(rs[0].academia);const maqDia=maqDe(rs);
    if(st.alvo&&faltas.has(st.alvo.peso)){st.alvo=null;st.n=0;return}
    if(st.alvo&&((st.gym&&gymDia&&gymDia!==st.gym)||!mesmaMaq(st.maq,maqDia)||rs.some(r=>RX_MAQ.test(strip(limpa(r.obs))))))return;
    if(st.alvo){
      st.n=bate(st.alvo)?st.n+1:0;st.ev=st.n?"firmou":"falhou";st.evAlvo=st.alvo;
      if(st.n>=FIRMAR){st.ev="consolidou";st.alvo=null;st.n=0}
      return;
    }
    const tag=rs.map(r=>String(r.obs||"").match(/\[Meta coach: *([^\]]+)\]/i)).find(Boolean);
    const a=tag&&alvoDe(tag[1]);
    if(a&&!faltas.has(a.peso)&&bate(a)){st.alvo=a;st.n=0;st.ev="bateu";st.evAlvo=a;st.gym=gymDia;st.maq=maqDia}
  });
  return st;
}
let metaMemo=null;
// A meta que vai para a série do treino de hoje, ou null. Manter a carga não vira meta na série.
function metaDaSerie(rows,nomeTreino,nomeEx){
  const k=base(nomeEx);if(/aquec/.test(k))return null;
  const est=estadoMeta(rows,k);
  if(est.alvo)return Object.assign({},est.alvo,{modo:"firmar",n:est.n});
  const ck=rows.length+"|"+nomeTreino;if(!metaMemo||metaMemo.k!==ck)metaMemo={k:ck,r:recado(rows,nomeTreino)};
  const r=metaMemo.r;
  const a=(r.metasTipo||{})[k]==="sobe"?alvoDe((r.metas||{})[k]):null;
  return a?Object.assign(a,{modo:"meta",n:0}):null;
}

function treino(rows,key){
  const todas=sessoes(rows);const ses=todas.find(s=>s.key===key);if(!ses)return null;
  const gym=academiaDe(ses.rows);
  const antes=rows.filter(r=>r.date<ses.date);
  const out={key,dateS:ses.dateS,treino:ses.treino,academia:gym,duracao:duracaoDe(ses.rows),animo:animoDe(ses.rows),bem:[],abaixo:[],comentarios:[],proximo:[],titulo:"",resumo:""};
  const feitas=ses.rows.filter(r=>r.done&&!eCardio(r));
  const naoFeitas=ses.rows.filter(r=>!r.done&&/n[aã]o fiz/i.test(String(r.feitas)+" "+String(r.hora)));
  const subir=[],manter=[],difs=[],mais=[];out.metasEx={};out.quedas=[];out.maquinasInfo=[];
  const ctxTempo=contexto(rows,ses);out.contexto=ctxTempo;
  const volSem=ctxTempo.semana.avaliacaoVolume;const segue=[],primeiros=[];
  // os 3 primeiros treinos da pessoa têm texto próprio, mais animado
  const nSes=todas.filter(s=>s.rows.some(r=>r.done)).indexOf(ses)+1;const inicial=nSes>=1&&nSes<=3;
  const inicioSem=new Date(ses.date.getFullYear(),ses.date.getMonth(),ses.date.getDate()-6);
  const sessoesSem=todas.filter(s=>s!==ses&&s.date>=inicioSem&&s.date<=ses.date);
  const outraAcad=acadDif(todas,ses);const comsCedo=comentariosDe(ses.rows);const maquinas=[];
  const contaHoje=analisarComentarios(ses.rows).cont;const cansado=!!(contaHoje.cansaco||contaHoje.sono);
  porExercicio(ses.rows.filter(r=>!eCardio(r))).forEach(ex=>{
    const dn=ex.rows.filter(r=>r.done);if(!dn.length)return;
    const anteriores=antes.filter(r=>base(r.ex)===ex.k&&r.done);
    let quedaOk=false;
    // Máquina: carga só compara dentro da mesma marca. Máquina nova vira referência.
    const maqHoje=maqDe(dn),comMaq=maqHoje?anteriores.filter(r=>r.maq):[],naMesma=maqHoje?anteriores.filter(r=>strip(r.maq)===strip(maqHoje)):[];
    const maqNova=!!maqHoje&&comMaq.length>0&&!naMesma.length;const salto=saltoDe(naMesma.concat(dn));
    if(maqHoje)out.maquinasInfo.push({exercicio:ex.nome,maquinaHoje:maqHoje,maquinaAnterior:maqDe(comMaq),saltoDeCargaKg:salto||null,primeiraVezNestaMaquina:maqNova});
    const top=dn.slice().sort((a,b)=>(b.e1||0)-(a.e1||0))[0];const P=pesoNum(top.peso);const R=top.reps?top.reps[0]:null;
    const aSubir=()=>{if(!P)return ["subir um pouco a carga","suba um pouco a carga"];let c=proxCarga(P.n,salto);const fl=faltasDe(ex.rows.concat(gym?anteriores.filter(r=>strip(r.academia)===strip(gym)):[]));while(fl.has(c))c=proxCarga(c,salto);const nv=fmtP(c,P.cl);return ["subir para "+nv+" (hoje "+fmtP(P.n,P.cl)+(R?" × "+R:"")+(salto?", a máquina sobe de "+nf(salto)+" em "+nf(salto)+" kg":"")+")",nv]};
    const aManter=()=>!R?null:P?["manter "+fmtP(P.n,P.cl)+" × "+R,fmtP(P.n,P.cl)+" × "+R]:["manter "+R+" repetições",R+" repetições"];
    const aMais=()=>!R?null:P?[fmtP(P.n,P.cl)+" × "+(R+1)+" (1 repetição a mais)",fmtP(P.n,P.cl)+" × "+(R+1)]:[(R+1)+" repetições (1 a mais)",(R+1)+" repetições"];
    if(!anteriores.length){
      if(inicial){if(!/aquec/.test(ex.k))primeiros.push({nome:ex.nome,e1:top.e1||0,carga:P?fmtP(P.n,P.cl)+(R?" × "+R:""):R?R+" repetições":""})}
      else if(!antes.some(r=>base(r.ex)===ex.k))out.bem.push("<b>"+esc(ex.nome)+":</b> primeiro recorde"+(P?", "+fmtP(P.n,P.cl)+(R?" × "+R:""):"")+". Agora ele é a sua referência.");
      const pr=inicial||cansado?aManter():aMais();if(pr){(inicial?segue:mais).push({nome:ex.nome,txt:pr[0],curto:pr[1]});out.metasEx[ex.k]=pr[1]}return}
    const mesmaGym=gym?anteriores.filter(r=>strip(r.academia)===strip(gym)):[];
    // Academia ou máquina diferente: os pesos não comparam. Registra como referência e confirma no próximo.
    const maqDif=comsCedo.some(c=>c.citados.includes(ex.k)&&RX_MAQ.test(strip(c.texto)));
    if((outraAcad&&!mesmaGym.length)||maqDif||maqNova){
      if((maqDif||maqNova)&&!outraAcad)maquinas.push(ex.nome+(maqNova?" ("+maqHoje+", antes "+maqDe(comMaq)+")":""));
      const mr=aManter();if(mr&&!/aquec/.test(ex.k)){segue.push({nome:ex.nome,txt:"repetir "+mr[1]+" para criar referência aqui",curto:mr[1]});out.metasEx[ex.k]=mr[1]}
      return}
    const ref=naMesma.length?naMesma:mesmaGym.length?mesmaGym:anteriores;
    const ultData=ref[ref.length-1].dateS;const prev=ref.filter(r=>r.dateS===ultData);
    const curV=volumeDe(dn)||repsDe(dn),prevV=volumeDe(prev)||repsDe(prev);
    const d=pct(curV,prevV);
    const bestE=Math.max(0,...dn.map(r=>r.e1||0)),recE=Math.max(0,...ref.map(r=>r.e1||0));
    if(bestE&&recE&&bestE>recE+0.5)out.bem.push("🏆 Recorde em <b>"+esc(ex.nome)+"</b>: força estimada de "+nf(bestE)+" kg (antes "+nf(recE)+" kg).");
    else if(d!=null&&d>=3)out.bem.push("<b>"+esc(ex.nome)+"</b>: +"+d+"% de volume sobre "+esc(ultData.slice(0,5))+".");
    const aquec=/aquec/.test(ex.k);
    if(d!=null&&!aquec)difs.push({nome:ex.nome,d});
    if(d!=null&&d<=-10&&!aquec&&!inicial){
      const outra=sessoesSem.find(s=>s.rows.some(r=>r.done&&base(r.ex)===ex.k));
      const gr=dn[0].grupo||"Sem grupo";const sg=(ctxTempo.semana.grupos.find(x=>x.grupo===gr)||{}).situacao||"em dia";
      const ok=!!outra||sg==="em dia";quedaOk=ok;
      const doGrupo=[...new Set(sessoesSem.filter(s=>s.rows.some(r=>r.done&&r.grupo===gr)).map(s=>s.treino))];
      out.quedas.push({exercicio:ex.nome,quedaPct:d,feitoTambemEm:outra?outra.treino:null,grupoTambemEm:doGrupo,grupo:gr,grupoNaSemana:sg,veredito:ok?"ok":"faltou"});
      out.abaixo.push("<b>"+esc(ex.nome)+"</b>: "+d+"% de volume sobre "+esc(ultData.slice(0,5))+"."+(outra?" Você já fez esse exercício em "+esc(outra.treino)+" nesta semana, então está tudo bem.":sg==="em dia"?(doGrupo.length?" Você já treinou "+esc(gr)+" em "+esc(doGrupo[0])+" nesta semana, então está tudo bem.":" "+esc(gr)+" está em dia na semana, então não falta nada."):(cansado?" Recupere primeiro e só complete "+esc(gr)+" nesta semana se estiver descansado.":" Vale completar "+esc(gr)+" ainda nesta semana.")));
    }
    // meta batida em todas as séries, sem ter ido ao limite em todas
    let vaiSubir=false;
    const comMeta=dn.map(r=>({r,t:topoMeta(r.meta)})).filter(x=>x.t!=null);
    if(comMeta.length&&comMeta.length===dn.length&&comMeta.every(x=>x.r.reps&&x.r.reps[0]>=x.t)){
      const rirs=dn.map(r=>r.rir).filter(x=>x!=="");
      if(!rirs.length||rirs.some(x=>+x>=1))vaiSubir=true;
    }
    if(vaiSubir&&!inicial){const m=aSubir();subir.push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}
    else if(d!=null&&d<=-10&&(inicial||quedaOk&&volSem!=="abaixo")){const m=aManter();if(m){segue.push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}}
    else if(d!=null&&d<=-10){const prevR=Math.max(0,...prev.map(r=>r.reps?r.reps[0]:0));
      const m=P&&prevR?["manter "+fmtP(P.n,P.cl)+" e voltar às "+prevR+" repetições",fmtP(P.n,P.cl)+" × "+prevR]:["voltar ao que fez em "+ultData.slice(0,5),"voltar ao que fez em "+ultData.slice(0,5)];
      manter.push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}
    else{const gr=dn[0].grupo||"Sem grupo";const sg=(ctxTempo.semana.grupos.find(x=>x.grupo===gr)||{}).situacao;
      const pedeMais=!inicial&&!cansado&&!outraAcad&&volSem==="abaixo"&&sg==="abaixo";const m=pedeMais?aMais():aManter();
      if(m){(pedeMais?mais:segue).push({nome:ex.nome,txt:m[0],curto:m[1]});out.metasEx[ex.k]=m[1]}}
  });
  if(naoFeitas.length){
    const nomes=[...new Set(naoFeitas.map(r=>semLadoNome(r.ex)))];
    out.abaixo.push(naoFeitas.length+(naoFeitas.length===1?" série não feita":" séries não feitas")+": "+nomes.slice(0,4).map(esc).join(", ")+".");
  }
  // comentários do treino entram na conclusão
  const C=analisarComentarios(ses.rows);const tem=id=>!!C.cont[id];
  out.gruposTreino=[...new Set(feitas.map(r=>r.grupo))];
  const coms=comentariosDe(ses.rows);out.comentariosTreino=coms.map(c=>({exercicio:c.nome||"treino todo",texto:c.texto.slice(0,240)}));
  coms.slice(0,6).forEach(c=>out.comentarios.push("<b>"+esc(c.nome||"Treino")+":</b> “"+esc(c.texto.slice(0,140))+"”"));
  out.pedidos=coms.filter(c=>RX_PEDIDO.test(strip(c.texto))).map(c=>({exercicio:c.nome||"treino todo",texto:c.texto.slice(0,240)}));
  const justifica=[tem("sono")&&"sono",tem("cansaco")&&"cansaço",tem("animo")&&"pouco ânimo",tem("comida")&&"alimentação",tem("academia")&&"a academia"].filter(Boolean);
  const animoIni=animos(ses.rows).ini;
  const dificil=animoIni==="ruim"||justifica.length>0;
  if(out.abaixo.length&&justifica.length)out.abaixo.push("Faz sentido com o que você comentou ("+justifica.join(", ")+"). Não é perda de força: leve isso em conta.");
  // treino comparado com a média dos anteriores iguais
  const iguaisTodos=todas.filter(s=>s.treino===ses.treino&&s.date<ses.date),iguaisGym=gym?iguaisTodos.filter(s=>strip(academiaDe(s.rows))===strip(gym)):[];
  const iguais=(iguaisGym.length?iguaisGym:iguaisTodos).slice(-4);
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
    out.texto=motivo+feitas.length+(feitas.length===1?" série feita":" séries feitas")+". Este treino agora é a sua referência."}
  else if(dv>=5){out.titulo=dificil?"Treino forte, mesmo em um dia difícil":"Treino forte";
    out.frase=(dificil?"mesmo em um dia difícil, ":"")+"você subiu "+dv+"% no volume";
    out.texto=motivo+(dificil?"Mesmo assim, você fez ":"Você fez ")+dv+"% a mais que "+refA+"."+avanco+" É esse nível que eu quero ver de novo."}
  else if(dv<=-15){const emDia=volSem!=="abaixo"&&out.quedas.length>0&&out.quedas.every(q=>q.veredito==="ok");
    out.titulo=emDia?"Volume menor hoje, semana em dia":dificil?"Dia difícil, e você compareceu":"Hoje ficou abaixo do seu normal";
    out.frase=dificil?"foi um dia difícil e o volume ficou "+Math.abs(dv)+"% abaixo, sem problema":"o volume ficou "+Math.abs(dv)+"% abaixo";
    out.texto=motivo+"O volume ficou "+Math.abs(dv)+"% abaixo "+refDe+"."+(menor&&menor.d<0?" A maior queda foi em "+menor.nome+" ("+menor.d+"%).":"")+(emDia?" Mas a sua semana está em dia, então está tudo bem. Descanse e vamos para o próximo.":(dificil?" Faz sentido para um dia assim. Descanse, quero você bem no próximo.":" Já te vi fazendo melhor, quero ver de novo no próximo treino.")+" Se estiver com dificuldade, fale com o professor.")}
  else{out.titulo=dificil?"Dia difícil, e você manteve o nível":"Treino dentro da sua média";
    out.frase=(dificil?"mesmo em um dia difícil, ":"")+"você ficou na sua média";
    out.texto=motivo+"Você ficou perto "+refDe+"."+avanco+" "+(volSem==="abaixo"?"No próximo, quero ver um pouco mais.":volSem==="alto"?"A sua semana já está puxada, então recupere bem.":"O seu volume está ótimo, é só manter.")}
  // frase final: o que o coach quer ver no próximo treino
  const emDiaFim=volSem!=="abaixo"&&out.quedas.length>0&&out.quedas.every(q=>q.veredito==="ok");
  out.fecho=dv!=null&&dv>=5?"É esse nível que eu quero ver de novo no próximo treino.":emDiaFim?"Hoje já foi, amanhã é outro dia. Descanse, quero você voando no próximo treino.":dificil?"Descanse e cuide do corpo. Quero você bem no próximo treino.":dv!=null&&dv<=-15?"Já te vi fazendo melhor, quero ver de novo no próximo treino.":volSem==="abaixo"?"No próximo treino, quero ver um pouco mais.":volSem==="alto"?"A sua semana já está puxada. Recupere bem antes do próximo treino.":"O seu volume está ótimo. No próximo treino, é só manter.";
  // sugestão de academia, só quando o treino não foi forte e existe uma opção que rende mais
  const acad=melhorAcademia(todas,ses);out.academias=acad;
  if(acad&&acad.melhores.length&&(dv==null||dv<5))out.academiaDica="Na semana que vem, tente ir "+(acad.melhores.length>1?"na "+acad.melhores[0]+" ou na "+acad.melhores[1]:"na "+acad.melhores[0])+": lá você costuma render mais.";
  if(maquinas.length)out.maquinaDif=maquinas.map(n=>"Em "+n+", percebi que a máquina é diferente, então não comparo a carga.");
  if(maquinas.length&&!outraAcad&&!inicial&&dv!=null&&dv<5){out.titulo="Treino com máquina diferente";out.frase="a máquina mudou, então a carga não dá para comparar";out.texto=motivo+"Percebi que a máquina mudou em "+maquinas.join(", ")+", então não conto a carga como queda. No próximo treino eu confirmo.";out.fecho="No próximo treino eu confirmo.";out.comp=null;out.volumeDif=null}
  if(outraAcad&&!inicial){
    out.academiaDif="Percebi que os pesos mudaram. Provavelmente é a academia"+(gym?" ("+gym+")":"")+". No próximo treino eu confirmo.";
    out.titulo="Treino em outra academia";out.frase="os pesos mudaram, provavelmente pela academia";
    out.texto=motivo+out.academiaDif+" Não conto isso como queda.";out.fecho="No próximo treino eu confirmo.";out.academiaDica="";out.comp=null;out.volumeDif=null;
  }
  out.numeroTreino=nSes;out.metasQ=metasLongo(todas,ses,ctxTempo,inicial);out.metasLongo=out.metasQ.map(m=>m.txt);out.nexoTreino=nexoDoTreino(todas,ses);
  if(inicial){
    const ordem=["primeiro","segundo","terceiro"][nSes-1];
    const doModelo=MODELOS&&MODELOS.get&&MODELOS.get(ses.treino)?MODELOS.get(ses.treino).reduce((a,it)=>a+(+it.series||0),0):0;
    const pedidas=Math.max(feitas.length+naoFeitas.length,doModelo);const pctF=pedidas?Math.min(100,Math.round(feitas.length/pedidas*100)):100;
    out.inicial={numero:nSes,seriesFeitas:feitas.length,seriesPedidas:pedidas,pctEntregue:pctF};
    out.titulo=nSes===1?"Primeiro treino feito, parabéns!":nSes===2?"Segundo treino feito, é assim!":"Terceiro treino, já pegando o ritmo!";
    out.frase="foi o seu "+ordem+" treino e você entregou "+pctF+"% do que foi pedido";
    out.texto=motivo+"Esse foi o seu "+ordem+" treino e você conseguiu "+feitas.length+(feitas.length===1?" série":" séries")+". "+(pctF>=60?"Parabéns, entregou "+pctF+"% do que foi pedido.":"Você entregou "+pctF+"% do que foi pedido, e no começo isso é normal.")+
      (nSes===1?" Esse início é para você se acostumar com a minha metodologia, mas estou vendo que vamos longe. Nos próximos treinos, teremos parâmetros legais para trabalhar.":nSes===2?" Já estou começando a conhecer o seu ritmo. Continue assim, porque vamos longe.":" Agora já temos uma boa base. A partir daqui, começo a acompanhar a sua evolução de perto.");
    out.fecho="";out.academiaDica="";
    out.bem=primeiros.sort((a,b)=>b.e1-a.e1).slice(0,4).map((x,i)=>"<b>"+esc(x.nome)+":</b> primeiro recorde"+(x.carga?", "+esc(x.carga):"")+". Boa carga."+(i===0?" No próximo treino, tente manter, porque aumentar agora não é a ideia.":"")).concat(out.bem);
  }
  out.resumo=out.texto;
  out.animoInfo=analisarAnimo(todas,ses,outraAcad?null:dv);
  const sq=sequenciaDificil(todas,ses);
  if(sq){out.sequencia=sq;out.sequenciaTexto=sq.dificeis+" dos seus últimos "+sq.total+" treinos foram difíceis. Eu vi que você continuou vindo, e isso conta. Agora preciso que você busque o que te motiva: relembre o seu objetivo, teste outro horário ou fale com o professor."}
  // próximo treino
  // aquecimento não vira meta
  Object.keys(out.metasEx).forEach(k=>{if(/aquec/.test(k))delete out.metasEx[k]});
  out.metasTipo={};subir.concat(mais).forEach(m=>{out.metasTipo[base(m.nome)]="sobe"});
  const firmando=[];
  porExercicio(ses.rows.filter(r=>!eCardio(r))).forEach(ex=>{
    const est=estadoMeta(rows,ex.k,ses.date);
    if(est.alvo){out.metasEx[ex.k]=est.alvo.texto;delete out.metasTipo[ex.k];
      firmando.push({k:ex.k,nome:ex.nome,txt:"firmar "+est.alvo.texto+" (treino "+(est.n+1)+" de "+FIRMAR+")",curto:est.alvo.texto})}
    const t=est.evAlvo&&est.evAlvo.texto;
    // No 4º treino a carga é o padrão: a próxima meta só vem depois dele.
    if(est.ev==="consolidou"){out.metasEx[ex.k]=t;delete out.metasTipo[ex.k];firmando.push({k:ex.k,nome:ex.nome,txt:"manter "+t+" (o seu novo padrão)",curto:t})}
    if(est.ev==="bateu")out.bem.unshift("🥇 <b>Parabéns!</b> Você bateu a meta do coach em <b>"+esc(ex.nome)+"</b>: "+esc(t)+". Agora vamos firmar essa carga nos próximos "+FIRMAR+" treinos.");
    else if(est.ev==="firmou")out.bem.unshift("<b>"+esc(ex.nome)+"</b>: firmando "+esc(t)+", treino "+est.n+" de "+FIRMAR+".");
    else if(est.ev==="consolidou")out.bem.unshift("🏅 <b>"+esc(ex.nome)+"</b>: "+esc(t)+" consolidados. Essa carga agora é o seu padrão.");
  });
  // O que a pessoa escreveu muda a meta: carga que não existe sai, o que pesou não sobe e o que ficou leve pode subir.
  const comentadas=[];
  porExercicio(ses.rows.filter(r=>!eCardio(r)&&r.done)).forEach(ex=>{
    if(/aquec/.test(ex.k))return;
    const seus=coms.filter(c=>c.citados.includes(ex.k)).map(c=>strip(c.texto));if(!seus.length)return;
    const top=ex.rows.slice().sort((a,b)=>(b.e1||0)-(a.e1||0))[0];const P=pesoNum(top.peso);
    const faltas=faltasDe(ex.rows);const pesou=seus.some(t=>RX_PESADO.test(t)),leve=seus.some(t=>RX_LEVE.test(t));
    const fixa=firmando.find(m=>m.k===ex.k);let nova=null;
    if(P&&faltas.has(P.n)){const op=faltas.get(P.n);
      nova=op?{txt:"não há "+nf(P.n)+" kg aí, então use "+fmtP(op,P.cl)+(pesou?", porque a carga acima ficou demais":""),curto:fmtP(op,P.cl)}:{txt:"não há "+nf(P.n)+" kg aí, então use a carga mais próxima em que você mantém a técnica",curto:"a carga mais próxima que você controla"}}
    else if(pesou)nova=fixa?{txt:fixa.txt+", sem subir: você comentou que pesou",curto:fixa.curto}:{txt:"sem subir: você comentou que pesou. Use a carga em que controla a técnica",curto:"a carga que você controla bem"};
    else if(!fixa&&coms.some(c=>!c.doTreino&&c.k===ex.k&&RX_PEDIDO.test(strip(c.texto))))nova={txt:"repetir o que fez hoje, sem subir, enquanto essa sequência é revista",curto:"o que você fez hoje"};
    else if(leve&&!fixa&&P){const sl=saltoDe(ex.rows);let c=proxCarga(P.n,sl);while(faltas.has(c))c=proxCarga(c,sl);nova={txt:"subir para "+fmtP(c,P.cl)+": você comentou que ficou leve",curto:fmtP(c,P.cl),sobe:true}}
    if(!nova)return;
    [firmando,subir,manter,mais,segue].forEach(l=>{for(let i=l.length-1;i>=0;i--)if(base(l[i].nome)===ex.k)l.splice(i,1)});
    comentadas.push({k:ex.k,nome:ex.nome,txt:nova.txt,curto:nova.curto});
    out.metasEx[ex.k]=nova.curto;if(nova.sobe)out.metasTipo[ex.k]="sobe";else delete out.metasTipo[ex.k];
  });
  const fixos=new Set(firmando.map(m=>m.k));
  out.metasLista=comentadas.concat(firmando,subir.slice(0,2),manter,mais,segue).filter(m=>!/aquec/i.test(m.nome)&&(m.k||!fixos.has(base(m.nome)))).slice(0,5);
  out.metasLista.forEach(m=>out.proximo.push("<b>"+esc(m.nome)+":</b> "+esc(m.txt)));
  Object.keys(C.partes).filter(p=>parteCabe(p,ses.rows)).slice(0,3).forEach(p=>out.proximo.push("⚠ Atenção ao <b>"+esc(p)+"</b>: reduza a carga se doer e avise o professor se continuar."));
  if(tem("dor")&&!Object.keys(C.partes).length)out.proximo.push("⚠ Você comentou dor ou incômodo. Vá com calma e avise o professor se continuar.");
  if(tem("sono"))out.proximo.push("<b>Sono:</b> tente dormir melhor na véspera.");
  if(tem("comida"))out.proximo.push("<b>Alimentação:</b> coma bem antes do treino.");
  if(naoFeitas.length)out.proximo.push("<b>Séries que faltaram:</b> retome, se der.");
  if(!out.proximo.length)out.proximo.push("Repita o treino no mesmo nível.");
  if(!out.bem.length)out.bem.push("Você compareceu e fez o treino.");
  return out;
}

/* ---------- previsão de evolução ---------- */
// Tendência da força estimada nos exercícios mais feitos das últimas 12 semanas. É estimativa simples, não promessa.
function projecao(rows){
  const hoje=new Date(),ini=new Date(+hoje-84*864e5),sem=864e5*7;
  const por=new Map();
  rows.forEach(r=>{if(!r.done||!r.e1||eCardio(r)||/aquec/i.test(r.ex)||r.date<ini)return;const k=base(r.ex)+"|"+strip(r.maq);
    if(!por.has(k))por.set(k,{nome:semLadoNome(r.ex)+(r.maq?" ("+r.maq+")":""),dias:new Map()});const o=por.get(k);const d=o.dias.get(r.dateS);if(!d||r.e1>d.e)o.dias.set(r.dateS,{t:+r.date,e:r.e1})});
  return [...por.values()].filter(o=>o.dias.size>=4).sort((a,b)=>b.dias.size-a.dias.size).slice(0,3).map(o=>{
    const p=[...o.dias.values()].sort((a,b)=>a.t-b.t),n=p.length,xs=p.map(q=>(q.t-+ini)/sem),ys=p.map(q=>q.e);
    const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
    const inc=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/(xs.reduce((a,x)=>a+(x-mx)*(x-mx),0)||1);
    const hojeE=Math.round((ys[n-1]+ys[n-2])/2*10)/10,lim=hojeE*1.2;
    const em=w=>Math.round(Math.min(lim,hojeE+Math.max(0,inc)*w)*10)/10;
    return {nome:o.nome,hoje:hojeE,em4:em(4),em12:em(12),tendencia:inc>0.1?"sobe":inc<-0.1?"cai":"estavel"};
  });
}
/* A cada 4 semanas de treino, um aviso de que está no caminho certo, só quando os dados mostram isso. */
function caminhoCerto(rows){
  const ses=sessoes(rows).filter(s=>s.rows.some(r=>r.done));if(!ses.length)return null;
  const hoje=new Date(),semanas=Math.floor((+hoje-+ses[0].date)/(7*864e5)),marco=Math.floor(semanas/4);if(marco<1)return null;
  const de=n=>new Date(+hoje-n*864e5),rec=ses.filter(s=>s.date>=de(28)),ant=ses.filter(s=>s.date>=de(56)&&s.date<de(28));
  const vol=l=>l.reduce((a,s)=>a+volFeito(s),0);const motivos=[];
  if(rec.length>=6)motivos.push(rec.length+" treinos nas últimas 4 semanas");
  if(ant.length&&vol(rec)>vol(ant))motivos.push("volume maior que no mês anterior");
  const metas=rec.filter(metaBatidaEm).length;if(metas)motivos.push(metas+(metas===1?" meta do coach batida":" metas do coach batidas"));
  if(!motivos.length)return null;
  return {marco,texto:"Você está no caminho certo: "+motivos.join(", ")+". São "+semanas+" semanas de treino, e é assim que se evolui."};
}
/* Desafios da semana: um de frequência e outros dois que mudam a cada semana. Contam sozinhos pelo que é registrado. */
function desafios(rows){
  const hoje=new Date(),seg=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()-((hoje.getDay()+6)%7));
  const todas=sessoes(rows).filter(s=>s.rows.some(r=>r.done)),sem=todas.filter(s=>s.date>=seg);
  const ant=todas.filter(s=>s.date<seg&&s.date>=new Date(+seg-28*864e5));
  const alvo=Math.min(6,Math.max(2,Math.round(ant.length/4)||3));
  const tag=(s,rx)=>s.rows.some(r=>rx.test(String(r.obs||"")));
  const agua=sem.reduce((a,s)=>{const m=s.rows.map(r=>String(r.obs||"").match(/\[Água: bebeu (\d+) de (\d+)\]/)).find(Boolean);return m?{b:a.b+ +m[1],t:a.t+ +m[2]}:a},{b:0,t:0});
  const melhor={};const km=r=>base(r.ex)+"|"+strip(r.maq);
  todas.filter(s=>s.date<seg).forEach(s=>s.rows.forEach(r=>{if(r.done&&r.e1){const k=km(r);if(!melhor[k]||r.e1>melhor[k])melhor[k]=r.e1}}));
  const recordes=sem.filter(s=>s.rows.some(r=>r.done&&r.e1&&melhor[km(r)]&&r.e1>melhor[km(r)]+0.5)).length;
  const lista=[
    {id:"meta",titulo:"Bater 1 meta do coach",feito:sem.filter(metaBatidaEm).length,alvo:1},
    {id:"animo",titulo:"Marcar o ânimo em 3 treinos",feito:sem.filter(s=>tag(s,/\[[ÂA]nimo/)).length,alvo:3},
    {id:"comentario",titulo:"Comentar como foi em 2 treinos",feito:sem.filter(s=>tag(s,/\[Treino\]|\[Exerc[ií]cio\]/)).length,alvo:2},
    {id:"agua",titulo:"Beber água em 4 lembretes",feito:agua.b,alvo:4},
    {id:"recorde",titulo:"Bater 1 recorde",feito:recordes,alvo:1}];
  const n=Math.floor(+seg/(7*864e5));const a=lista[n%lista.length],b=lista[(n+2)%lista.length];
  return [{id:"freq",titulo:"Treinar "+alvo+" vezes nesta semana",feito:sem.length,alvo},a,b].map(d=>Object.assign(d,{ok:d.feito>=d.alvo}));
}

/* ---------- resumo do mês ---------- */
const chaveMes=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
const NOMES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const nomeMes=k=>{const [a,m]=k.split("-");return NOMES[+m-1]+" de "+a};
function meses(rows){return [...new Set(rows.map(r=>chaveMes(r.date)))].sort().reverse()}
function mes(rows,k){
  const [a,m]=k.split("-").map(Number);
  const hoje=new Date();const atual=hoje.getFullYear()===a&&hoje.getMonth()===m-1;
  // Mês em andamento: compara só com os mesmos dias do mês anterior.
  if(atual){const P=periodo(rows,new Date(a,m-1,1),new Date(a,m,1),new Date(a,m-2,1),nomeMes(k),"mesmos dias do mês anterior",new Date(a,m-2,hoje.getDate()+1),hoje.getDate()<7);return P}
  return periodo(rows,new Date(a,m-1,1),new Date(a,m,1),new Date(a,m-2,1),nomeMes(k),"mês anterior");
}
// Resumo de qualquer período [ini, fim). iniAnt: início do período anterior, para comparar.
function periodo(rows,ini,fim,iniAnt,nome,rotAnt,fimAnt,noComeco){
  const cur=rows.filter(r=>r.date>=ini&&r.date<fim),ant=iniAnt?rows.filter(r=>r.date>=iniAnt&&r.date<(fimAnt&&fimAnt<ini?fimAnt:ini)):[];
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
    const mq=maqDe(ex.rows);const hist=antes.filter(r=>base(r.ex)===ex.k&&r.e1&&mesmaMaq(r.maq,mq)).map(r=>r.e1);if(!hist.length)return;
    const rec=Math.max(...hist);if(best>rec+0.5)out.recordes.push({nome:ex.nome,de:rec,para:best});
    const pa=ant.filter(r=>base(r.ex)===ex.k&&r.e1&&mesmaMaq(r.maq,mq)).map(r=>r.e1);
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
  if(noComeco)F.push("O mês ainda está no começo. A comparação de frequência e de volume fica para daqui a alguns dias.");
  else if(out.treinosAnt&&out.treinos<out.treinosAnt)F.push("Frequência caiu de "+out.treinosAnt+" para "+out.treinos+" treinos. Priorize voltar à rotina.");
  else if(out.treinosAnt&&out.treinos>out.treinosAnt)F.push("Frequência subiu de "+out.treinosAnt+" para "+out.treinos+" treinos. Mantenha.");
  const quedas=out.grupos.filter(x=>x.dif!=null&&x.dif<=-15).slice(0,2);
  if(quedas.length&&!noComeco)F.push("Volume caiu em "+quedas.map(x=>x.g+" ("+x.dif+"%)").join(" e ")+". Dê mais atenção.");
  out.partes.filter(x=>x.n>=2).slice(0,2).forEach(x=>F.push("Dor ou incômodo no "+x.p+" apareceu em "+x.n+" treinos. Vale ajustar exercícios e conversar com o professor."));
  const c=id=>temas[id]||0;
  if(c("sono")>=2)F.push("Sono ruim apareceu em "+c("sono")+" treinos. Melhorar o sono deve render mais que qualquer ajuste.");
  if(c("cansaco")>=3)F.push("Cansaço apareceu em "+c("cansaco")+" treinos. Avalie descanso e alimentação.");
  if(c("animo")>=2)F.push("Pouco ânimo apareceu em "+c("animo")+" treinos. Vale mudar horário, academia ou variar exercícios.");
  if(out.recordes.length)F.push("Bateu "+out.recordes.length+(out.recordes.length===1?" recorde":" recordes")+". O caminho está certo: siga progredindo a carga aos poucos.");
  if(porSes.length){const ac=melhorAcademia(sessoes(rows),porSes[porSes.length-1]);
    if(ac&&ac.comparacao.length>=2){const nomes=ac.comparacao.slice(0,2).map(x=>x.nome);F.push("Pelos seus treinos, você costuma render mais na "+nomes[0]+" do que na "+ac.comparacao[ac.comparacao.length-1].nome+".");out.academiasComparadas=ac.comparacao}}
  if(!F.length)F.push("Período estável. Pelo seu volume, é só manter.");
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
    (hoje.length?hoje.map(m=>esc(m.nome)+" com "+esc(m.curto)).join(" e "):"o mesmo nível do último treino")+"."+(A.academiaDica?" "+esc(A.academiaDica):""),metas:A.metasEx||{},metasTipo:A.metasTipo||{}};
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
  return {treino:A.treino,data:A.dateS,gruposDoTreino:A.gruposTreino||[],comentariosDoTreino:A.comentariosTreino||[],relacaoComOTreino:A.nexoTreino||"",academiaDiferente:A.academiaDif||"",maquinasDiferentes:A.maquinaDif||[],maquinas:A.maquinasInfo||[],pedidosDeRevisao:A.pedidos||[],inicial:A.inicial||null,metasLongoPrazo:(A.metasLongo||[]).map(tira),avaliacaoPorRegras:A.titulo+". "+A.texto,fecho:A.fecho,dicaAcademia:A.academiaDica||"",comparacaoAcademias:A.academias?A.academias.comparacao:null,quedas:A.inicial?[]:A.quedas,semana:A.inicial?null:A.contexto.semana,mes:A.inicial?null:A.contexto.mes,
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

return {projecao,caminhoCerto,desafios,relatorio,metaDaSerie,bateuAlvo,FIRMAR,treino,mes,periodo,meses,nomeMes,academias,sessoes,temasDe,partesComDor,animoDe,animos,duracaoDe,recado,recadoPicker,chegada,saida,base,fatosIA,nomeAcademia,setModelos,EMO};
})();
