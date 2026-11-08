/* Métodos de treino (arquivos em metodos/*.json). Este módulo só lê o arquivo e calcula:
   fase pela data de início, séries/reps/reps sobrando, cardio do dia, zona 2 e alternativas. */
window.Metodos=(function(){
"use strict";
const lista=new Map();
let pronto=null;
let planosLista=[];
let imagens=null; // fotos do free-exercise-db (domínio público), ligadas aos nomes em português
const bib=new Map(); // nome normalizado -> {nome, grupo}
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();

function load(){
  if(pronto)return pronto;
  const json=a=>fetch("metodos/"+a,{cache:"no-cache"}).then(r=>r.json());
  pronto=Promise.all([
    json("index.json").then(ix=>Promise.all((ix.metodos||[]).map(it=>json(it.arquivo).then(m=>lista.set(m.id,m)).catch(()=>{})))).catch(()=>{}),
    json("biblioteca.json").then(b=>Object.entries(b.grupos||{}).forEach(([g,ns])=>ns.forEach(n=>bib.set(norm(n),{nome:n,grupo:g})))).catch(()=>{}),
    json("planos.json").then(p=>{planosLista=p.planos||[]}).catch(()=>{}),
    json("imagens.json").then(j=>{imagens={base:j.base,regras:(j.regras||[]).map(r=>({rx:new RegExp(r.rx),img:r.img,en:r.en})),femBase:(j.femininas||{}).base||"",fem:new Set((j.femininas||{}).exercicios||[])}}).catch(()=>{})
  ]);
  return pronto;
}
const planos=()=>planosLista;
// As duas fotos do exercício (posição inicial e final), ou null. Alunas veem a versão feminina quando existe.
function imagem(nome,sexo){if(!imagens)return null;const n=norm(nome);const r=imagens.regras.find(x=>x.rx.test(n));if(!r)return null;const fem=/^f/i.test(sexo||"")&&imagens.fem.has(r.img[0].split("/")[0]);return {fotos:r.img.map(p=>(fem?imagens.femBase:imagens.base)+p),en:r.en,fem}}
const bibGrupo=n=>{const x=bib.get(norm(n));return x?x.grupo:null};
const bibNomes=()=>[...bib.values()].map(x=>x.nome);
const bibDoGrupo=g=>[...bib.values()].filter(x=>x.grupo===g).map(x=>x.nome);
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

return {imagem,load,planos,bibGrupo,bibNomes,bibDoGrupo,get,todos,fase,seriesDoPar,meta,topo,treinoDoDia,cardio,zona2,exercicio,alternativas,incremento,parseBr};
})();
