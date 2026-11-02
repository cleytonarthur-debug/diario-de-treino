/* Auxiliar do Coach: analisa 30 dias de um aluno e decide por regras o que sugerir ao professor.
   A IA só explica estes resultados. Nada aqui muda o treino: a decisão é sempre do professor. */
window.Auxiliar=(function(){
"use strict";
const SOBE=2.5,CAI=-2.5,SERIES_MIN=10,SERIES_MAX=20; // % de força e séries por semana por grupo
const FORA_VOLUME=new Set(["Abdômen","Sem grupo"]);
const nomeEstrategia={aguardar:"Aguardar",manter:"Manter",ajustar:"Ajustar",mudar:"Mudar"};
const um=x=>Math.round(x*10)/10;
const diaMs=864e5;
const media=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;

/* O grupo da biblioteca é largo demais: "Braços" junta bíceps e tríceps. A troca só vale para o mesmo músculo. */
const MUSCULOS=[["triceps",/triceps|frances|mergulho/],["biceps",/rosca|biceps|scott|martelo/],["antebraco",/antebraco|punho/],["panturrilha",/panturrilha|pantu|gemeo/],
  ["posterior",/flexora|stiff|terra|mesa/],["gluteo",/glute|pelvica|abdutor|coice/],["adutor",/adutor/],["quadriceps",/extensora|agach|leg|hack|afundo|bulgaro|passada/],
  ["ombro lateral",/elevacao lateral/],["ombro posterior",/posterior de ombro|face ?pull|voador reverso|crucifixo inverso/],["ombro",/desenvolvimento|elevacao frontal/],
  ["peito",/supino|peito|crucifixo|peck|fly|cross/],["costas",/pulley|pulldown|pull down|puxada|remada|barra fixa|serrote/],["lombar",/lombar/],["abdomen",/abs|abdom|prancha/]];
const musculoDe=k=>{for(const [m,rx] of MUSCULOS)if(rx.test(k))return m;return null};

function analisar(o){
  const {rows,avals,aluno,exKey,bibDoGrupo,gorduraDe,fim}=o;
  const fimD=new Date(fim.getFullYear(),fim.getMonth(),fim.getDate());
  const iniD=new Date(+fimD-29*diaMs),antesD=new Date(+iniD-30*diaMs);
  const feitas=rows.filter(r=>r.done);
  const cur=feitas.filter(r=>r.date>=iniD&&r.date<=fimD),ant=feitas.filter(r=>r.date>=antesD&&r.date<iniD);
  const sessoes=window.Coach.sessoes(cur),sessoesAnt=window.Coach.sessoes(ant);
  const dias=[...new Set(sessoes.map(s=>+s.date))].sort((a,b)=>a-b);
  let intervalo=0;for(let i=1;i<dias.length;i++)intervalo=Math.max(intervalo,Math.round((dias[i]-dias[i-1])/diaMs));
  const meta=parseFloat(String(aluno.dias||"").replace(",","."));
  const previstos=meta>0?Math.round(meta*30/7):null;
  const aderencia=previstos?Math.min(100,Math.round(dias.length/previstos*100)):null;

  /* grupos */
  const porGrupo=(rs,g)=>rs.filter(r=>r.grupo===g);
  const nomesG=[...new Set(cur.concat(ant).map(r=>r.grupo))].filter(Boolean);
  const grupos=nomesG.map(g=>{const a=porGrupo(cur,g),b=porGrupo(ant,g);const va=a.reduce((t,r)=>t+r.vol,0),vb=b.reduce((t,r)=>t+r.vol,0);
    return {grupo:g,seriesSemana:um(a.length*7/30),seriesSemanaAntes:um(b.length*7/30),volumeT:um(va/1000),volumeAntesT:um(vb/1000),variacaoVolumePct:vb?um((va/vb-1)*100):null}});

  /* exercícios: melhor força estimada no período contra o período anterior */
  const mapa=new Map();
  const add=(r,campo)=>{if(!r.ex)return;const k=exKey(r.ex);if(!mapa.has(k))mapa.set(k,{nome:r.ex,grupo:r.grupo,cur:0,ant:0,sessoes:new Set(),rir:[],carga:0});const m=mapa.get(k);
    if(r.e1>m[campo])m[campo]=r.e1;
    if(campo==="cur"){m.nome=r.ex;m.grupo=r.grupo;m.sessoes.add(r.dateS);const x=parseFloat(String(r.rir).replace(",","."));if(isFinite(x))m.rir.push(x);if(r.pesoN&&r.pesoN[0]>m.carga)m.carga=r.pesoN[0]}};
  ant.forEach(r=>add(r,"ant"));cur.forEach(r=>add(r,"cur"));
  const exercicios=[...mapa.values()].filter(m=>m.sessoes.size).map(m=>{const pct=m.cur&&m.ant?um((m.cur/m.ant-1)*100):null;const rir=media(m.rir);
    return {nome:m.nome,grupo:m.grupo,sessoes:m.sessoes.size,cargaMaxKg:m.carga||null,forcaPct:pct,rirMedio:rir==null?null:um(rir),situacao:pct==null?"novo":pct>=SOBE?"sobe":pct<=CAI?"cai":"estavel"}});
  const comp=exercicios.filter(e=>e.situacao!=="novo");
  const nSobe=comp.filter(e=>e.situacao==="sobe").length,nCai=comp.filter(e=>e.situacao==="cai").length;

  /* como a pessoa se sentiu */
  const an=sessoes.map(s=>window.Coach.animos(s.rows));
  const marcados=an.filter(a=>a.fim||a.ini);const ruins=marcados.filter(a=>(a.fim||a.ini)==="ruim").length;
  const dor={};const temas={};
  sessoes.forEach(s=>{const vistos=new Set();s.rows.forEach(r=>{window.Coach.temasDe(r.obs).forEach(t=>vistos.add(t));window.Coach.partesComDor(r.obs).forEach(p=>{dor[p]=(dor[p]||0)+1})});vistos.forEach(t=>{temas[t]=(temas[t]||0)+1})});
  const partesDor=Object.keys(dor);

  /* avaliação física */
  const av=(avals||[]).filter(a=>a.date<=fimD);const ultAv=av[av.length-1];const antAv=av.slice(0,-1).reverse().find(a=>a.date<iniD)||av[av.length-2];
  const dif=f=>{if(!ultAv||!antAv)return null;const x=f(ultAv.v)-f(antAv.v);return isFinite(x)?um(x):null};
  const numero=s=>window.Body.num(s);
  const avaliacao=ultAv?{data:ultAv.dataS,dentroDoPeriodo:ultAv.date>=iniD,pesoKg:isFinite(numero(ultAv.v["Peso (kg)"]))?numero(ultAv.v["Peso (kg)"]):null,gorduraPct:(g=>isFinite(g)?um(g):null)(gorduraDe(ultAv.v)),
    variacaoPesoKg:dif(v=>numero(v["Peso (kg)"])),variacaoGordura:dif(v=>gorduraDe(v)),variacaoCinturaCm:dif(v=>numero(v["Cintura (cm)"]))}:null;

  /* regras */
  const situacoes=new Set();const sinais=[];
  const fadiga=(marcados.length>=3&&ruins/marcados.length>=.4)||(temas.cansaco||0)>=3||(temas.sono||0)>=3||(comp.length>=3&&nCai/comp.length>=.5);
  if(fadiga){situacoes.add("fadiga");sinais.push("Sinais de cansaço, sono ruim ou ânimo baixo no período.")}
  if(partesDor.length){situacoes.add("dor");sinais.push("Dor citada: "+partesDor.join(", ")+". Vale conversar antes de mudar o treino.")}
  let estrategia,motivo;
  if(sessoes.length<4){estrategia="aguardar";motivo="Poucos treinos nos últimos 30 dias para avaliar a resposta."}
  else if(aderencia!=null&&aderencia<60){estrategia="ajustar";situacoes.add("baixa_frequencia");motivo="A frequência ficou baixa. Antes de julgar o treino, resolva a ida à academia."}
  else if(comp.length<3){estrategia="manter";motivo="Ainda há poucos exercícios para comparar com o mês anterior."}
  else if(nSobe/comp.length>=.5){estrategia="manter";situacoes.add("progredindo");motivo="A maioria dos exercícios está evoluindo."}
  else if(nSobe/comp.length<=.3){estrategia="mudar";situacoes.add("estagnado");motivo="Poucos exercícios evoluíram, mesmo com frequência suficiente."}
  else{estrategia="ajustar";situacoes.add("estagnado");motivo="Parte dos exercícios evoluiu e parte parou. Cabe um ajuste pontual."}
  if(partesDor.length&&estrategia==="manter")estrategia="ajustar";

  const carga=[],volume=[],trocar=[];
  exercicios.forEach(e=>{
    if(e.situacao==="novo")return;
    const folga=e.rirMedio==null||e.rirMedio>=2;
    if(e.situacao==="cai")carga.push({exercicio:e.nome,sugestao:"Manter ou reduzir a carga e olhar técnica e recuperação"});
    else if(folga&&!fadiga)carga.push({exercicio:e.nome,sugestao:"Subir de 2,5 a 5% na carga"});
    else if(e.situacao==="estavel")carga.push({exercicio:e.nome,sugestao:"Manter a carga, pois já está perto do limite"});
  });
  grupos.filter(g=>!FORA_VOLUME.has(g.grupo)).forEach(g=>{
    const ex=comp.filter(e=>e.grupo===g.grupo);const parado=ex.length&&ex.filter(e=>e.situacao==="sobe").length/ex.length<.5;
    if(g.seriesSemana<SERIES_MIN&&parado&&!fadiga){volume.push({grupo:g.grupo,sugestao:"Subir 2 séries por semana"});situacoes.add("volume_baixo")}
    else if(g.seriesSemana>SERIES_MAX&&fadiga)volume.push({grupo:g.grupo,sugestao:"Reduzir o volume semanal"});
  });
  const usados=new Set(exercicios.map(e=>exKey(e.nome)));
  exercicios.filter(e=>(e.situacao==="cai"||e.situacao==="estavel")&&e.sessoes>=4).forEach(e=>{
    const mus=musculoDe(exKey(e.nome));
    const alt=mus?(bibDoGrupo(e.grupo)||[]).filter(n=>!usados.has(exKey(n))&&musculoDe(exKey(n))===mus).slice(0,3):[];
    trocar.push({exercicio:e.nome,situacao:e.situacao,alternativas:alt});
  });

  const isoBr=d=>String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
  return {
    periodo:{inicio:isoBr(iniD),fim:isoBr(fimD),dias:30},
    perfil:{idade:o.idade,sexo:aluno.sexo||"",objetivo:aluno.objetivo||"",diasPorSemana:meta>0?meta:null,restricoes:String(aluno.obs||"").slice(0,300)},
    frequencia:{treinos:sessoes.length,diasComTreino:dias.length,treinosMesAnterior:sessoesAnt.length,previstos,aderenciaPct:aderencia,maiorIntervaloDias:intervalo},
    grupos,exercicios:exercicios.sort((a,b)=>(a.forcaPct==null)-(b.forcaPct==null)||b.forcaPct-a.forcaPct).slice(0,25),
    resumoExercicios:{comparados:comp.length,sobem:nSobe,caem:nCai,estaveis:comp.length-nSobe-nCai},
    animo:{marcados:marcados.length,ruins},temasNosComentarios:temas,dor:dor,avaliacao,
    regras:{estrategia,motivo,sinais,carga,volume,trocar:trocar.slice(0,6),situacoes:[...situacoes]}
  };
}
return {analisar,nomeEstrategia};
})();
