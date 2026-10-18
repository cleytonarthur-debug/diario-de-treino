/* Métodos de treino (arquivos em metodos/*.json). Este módulo só lê o arquivo e calcula:
   fase pela data de início, séries/reps/reps sobrando, cardio do dia, zona 2 e alternativas. */
window.Metodos=(function(){
"use strict";
const lista=new Map();
let pronto=null;

function load(){
  if(pronto)return pronto;
  pronto=fetch("metodos/index.json",{cache:"no-cache"}).then(r=>r.json())
    .then(ix=>Promise.all((ix.metodos||[]).map(it=>fetch("metodos/"+it.arquivo,{cache:"no-cache"}).then(r=>r.json()).then(m=>lista.set(m.id,m)).catch(()=>{}))))
    .catch(()=>{});
  return pronto;
}
const get=id=>lista.get(id)||null;
const todos=()=>[...lista.values()];

function parseBr(s){const m=String(s||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?new Date(+m[3],+m[2]-1,+m[1]):null}
const dia=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());

/* Fase do aluno numa data. Semana 1 começa na data de início; ciclo de N semanas que recomeça. */
function fase(m,inicioBr,data){
  const ini=parseBr(inicioBr);if(!m||!ini)return null;
  const hoje=dia(data||new Date());
  const dias=Math.round((hoje-dia(ini))/864e5);
  if(dias<0)return {antes:true,diasPara:-dias};
  const semana=Math.floor(dias/7)+1;
  const N=m.cicloSemanas||13;
  const semanaCiclo=((semana-1)%N)+1,ciclo=Math.floor((semana-1)/N)+1;
  const f=m.fases.find(x=>semanaCiclo>=x.semanas[0]&&semanaCiclo<=x.semanas[1])||m.fases[m.fases.length-1];
  return {semana,semanaCiclo,ciclo,total:N,fase:resolver(m,f)};
}
// Fase "descanso ativo" herda séries/reps de outra fase e multiplica as séries.
function resolver(m,f){
  if(!f.baseFase)return f;
  const b=m.fases.find(x=>x.id===f.baseFase)||{};
  const k=f.fatorSeries||1;
  const porPar={};Object.entries(b.seriesPorPar||{}).forEach(([p,n])=>porPar[p]=Math.ceil(n*k));
  return Object.assign({},b,f,{series:Math.ceil((b.series||2)*k),seriesPorPar:porPar,reps:f.reps||b.reps,tempo:f.tempo||b.tempo});
}
const seriesDoPar=(f,par)=>(f.seriesPorPar&&f.seriesPorPar[String(par)])||f.series;
const meta=(f,ex)=>ex&&ex.unidade==="s"?f.tempo[0]+"-"+f.tempo[1]+" s":f.reps[0]+"-"+f.reps[1];
const topo=(f,ex)=>ex&&ex.unidade==="s"?f.tempo[1]:f.reps[1];
const treinoDoDia=(m,data)=>(m.dias||{})[String((data||new Date()).getDay())]||null;
const cardio=(m,f,data)=>(f.cardio&&(f.cardio[String((data||new Date()).getDay())]||f.cardio.padrao))||"";
function zona2(m,idade){
  const z=m.intensidade&&m.intensidade.zona2;if(!z||!(idade>0))return null;
  const max=Math.round(z.fcMaxA-z.fcMaxB*idade);
  return {max,lo:Math.round(max*z.percentual[0]/100),hi:Math.round(max*z.percentual[1]/100),descricao:z.descricao};
}
const exercicio=(m,k)=>m&&m.exercicios[k]||null;
const alternativas=(m,k)=>{const e=exercicio(m,k);return e?(e.alternativas||[]).map(a=>({key:a,ex:m.exercicios[a]})).filter(x=>x.ex&&x.ex.musculo===e.musculo):[]};
const incremento=(m,tipo)=>(m.progressao&&m.progressao.incremento&&m.progressao.incremento[tipo])||"";

return {load,get,todos,fase,seriesDoPar,meta,topo,treinoDoDia,cardio,zona2,exercicio,alternativas,incremento,parseBr};
})();
