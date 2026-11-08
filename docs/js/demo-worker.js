/* Versão de teste: roda o programa central (demo-motor.js, cópia do Code.gs) com planilhas falsas
   guardadas no aparelho. A IA é a única coisa que passa pelo servidor, conferindo o link. */
"use strict";
importScripts("demo-motor.js");
const VERSAO_ALUNOS=1;
let cfg=null,motor=null,sujo=false,timer=0;

/* ---------- planilhas falsas ---------- */
const books=new Map();let seq=1,painel=null;
const disp=v=>v===""||v==null?"":typeof v==="number"?String(v).replace(".",","):String(v).replace(/^'/,"");
class Range{
  constructor(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
  getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];const lin=this.sh.d[this.r-1+i]||[];for(let j=0;j<this.nc;j++){const x=lin[this.c-1+j];row.push(x==null?"":x)}o.push(row)}return o}
  getDisplayValues(){return this.getValues().map(r=>r.map(disp))}
  getDisplayValue(){return this.getDisplayValues()[0][0]}
  getValue(){return this.getValues()[0][0]}
  clearContent(){this.setValues(Array.from({length:this.nr},()=>Array(this.nc).fill("")));return this}
  setValue(v){return this.setValues([[v]])}
  setValues(v){
    if(v.length!==this.nr||v.some(r=>r.length!==this.nc))throw new Error("dimensões erradas");
    v.forEach((row,i)=>{const R=this.r-1+i;this.sh.d[R]=this.sh.d[R]||[];row.forEach((x,j)=>{this.sh.d[R][this.c-1+j]=x})});
    sujo=true;return this;
  }
}
const nada=new Proxy({},{get:()=>function(){return nada}});
["setNumberFormat","setFontWeight","setBackground","setFontColor","setNote"].forEach(m=>{Range.prototype[m]=function(){return this}});
class Sheet{
  constructor(name){this.name=name;this.d=[];this.max=100000;this.maxC=40}
  getName(){return this.name} setName(n){this.name=n;return this}
  getLastRow(){for(let i=this.d.length-1;i>=0;i--)if((this.d[i]||[]).some(x=>x!==""&&x!=null))return i+1;return 0}
  getLastColumn(){let m=0;this.d.forEach(r=>(r||[]).forEach((x,j)=>{if(x!==""&&x!=null)m=Math.max(m,j+1)}));return m}
  getMaxColumns(){return this.maxC} insertColumnsAfter(_,k){this.maxC+=k}
  getMaxRows(){return this.max} insertRowsAfter(_,k){this.max+=k}
  getRange(r,c,nr,nc){if(typeof r==="string")return nada;return new Range(this,r,c,nr||1,nc||1)}
  setFrozenRows(){} setFrozenColumns(){} setColumnWidth(){}
}
class Book{
  constructor(name,id){this.id=id||"SS"+(seq++)+"xxxxxxxxxxxxxxxxxxxxxx";this.name=name;this.sheets=[new Sheet("Página1")];books.set(this.id,this)}
  getId(){return this.id} getSheets(){return this.sheets}
  getSheetByName(n){return this.sheets.find(s=>s.name===n)||null}
  insertSheet(n,i){const s=new Sheet(n);if(i===0)this.sheets.unshift(s);else this.sheets.push(s);sujo=true;return s}
  deleteSheet(s){this.sheets=this.sheets.filter(x=>x!==s)}
  setSpreadsheetLocale(){} setSpreadsheetTimeZone(){}
}
const pad=n=>String(n).padStart(2,"0");
const props={PROF_KEY:"DEMO",CF_CONTA:"demo",CF_TOKEN:"demo",IA_ALUNOS:"todos",API_URL:"https://script.google.com/macros/s/DEMO/exec",PASTA_ALUNOS:"PASTA"};
const cache={};
function criar(){
  return self.criarMotor({
    console,
    SpreadsheetApp:{getActiveSpreadsheet:()=>painel,openById:id=>{const b=books.get(id);if(!b)throw new Error("not found");return b},create:n=>new Book(n),flush(){}},
    DriveApp:{createFolder:()=>({getId:()=>"PASTA",isTrashed:()=>false}),getFolderById:()=>({isTrashed:()=>false}),getFileById:()=>({moveTo(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]==null?null:props[k],setProperty:(k,v)=>{props[k]=v;sujo=true}})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    CacheService:{getScriptCache:()=>({get:k=>cache[k]==null?null:cache[k],put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
    Utilities:{sleep(){},getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:"sha256"},
      formatDate:(d,_,f)=>f.replace("yyyy",d.getFullYear()).replace("MM",pad(d.getMonth()+1)).replace("dd",pad(d.getDate())).replace("HH",pad(d.getHours())).replace("mm",pad(d.getMinutes())),
      computeDigest:()=>[...crypto.getRandomValues(new Int8Array(32))]},
    UrlFetchApp:{fetch:(_,o)=>iaReal(JSON.parse(o.payload))},
    ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:"json"}}
  });
}
/* Pedido síncrono: o programa central espera a resposta, como no servidor. Aqui não trava a tela. */
function iaReal(p){
  const resp=(c,t)=>({getResponseCode:()=>c,getContentText:()=>t});
  try{
    const x=new XMLHttpRequest();
    x.open("POST",cfg.api,false);x.setRequestHeader("Content-Type","text/plain;charset=utf-8");
    x.send(JSON.stringify({action:"demoIa",demo:cfg.codigo,aparelho:cfg.aparelho,mensagens:p.messages,maxTokens:p.max_tokens}));
    const r=JSON.parse(x.responseText);
    if(!r.ok)return resp(429,r.error||"erro");
    return resp(200,JSON.stringify({result:{response:r.resposta}}));
  }catch(e){return resp(500,String(e&&e.message||e))}
}

/* ---------- guardar no aparelho ---------- */
function banco(){return new Promise((ok,no)=>{const q=indexedDB.open("dt-teste",1);q.onupgradeneeded=()=>q.result.createObjectStore("e");q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function ler(){const db=await banco();return new Promise((ok,no)=>{const q=db.transaction("e").objectStore("e").get("estado");q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function guardar(){
  sujo=false;
  const estado={versao:VERSAO_ALUNOS,seq,painel:painel.id,props,books:[...books.values()].map(b=>({id:b.id,name:b.name,sheets:b.sheets.map(s=>({name:s.name,d:s.d,max:s.max,maxC:s.maxC}))}))};
  const db=await banco();db.transaction("e","readwrite").objectStore("e").put(estado,"estado");
}
function restaurar(e){
  seq=e.seq;Object.assign(props,e.props);
  e.books.forEach(x=>{const b=new Book(x.name,x.id);b.sheets=x.sheets.map(s=>{const n=new Sheet(s.name);n.d=s.d;n.max=s.max;n.maxC=s.maxC;return n})});
  painel=books.get(e.painel);
}

/* ---------- alunos fictícios ---------- */
const EX={supino:["Supino reto com barra","Peito",50],inclin:["Supino inclinado com halteres","Peito",20],voador:["Voador peito (máquina)","Peito",45],supmaq:["Supino reto máquina","Peito",35],
  puxada:["Puxada frontal","Costas",55],remada:["Remada baixa no cabo","Costas",50],serrote:["Remada unilateral com halter (serrote)","Costas",22],remmaq:["Remada sentada máquina","Costas",40],
  desenv:["Desenvolvimento com halteres sentado","Ombros",16],desmaq:["Desenvolvimento máquina","Ombros",30],desmil:["Desenvolvimento militar com barra","Ombros",35],lateral:["Elevação lateral com halteres","Ombros",8],face:["Face pull na corda","Ombros",25],
  rosca:["Rosca direta barra W","Braços",24],martelo:["Rosca martelo","Braços",12],triceps:["Tríceps corda","Braços",28],frances:["Tríceps francês com halter","Braços",16],
  agach:["Agachamento livre","Inferiores",70],goblet:["Agachamento goblet","Inferiores",20],leg:["Leg press 45°","Inferiores",150],ext:["Cadeira extensora","Inferiores",45],flex:["Mesa flexora","Inferiores",35],stiff:["Stiff com halteres","Inferiores",24],
  terra:["Levantamento terra","Inferiores",90],bulgaro:["Agachamento búlgaro","Inferiores",14],pelv:["Elevação pélvica","Inferiores",70],abdu:["Cadeira abdutora","Inferiores",45],pant:["Panturrilha em pé","Inferiores",50],abd:["Abdominal no cabo","Abdômen",25]};
const SPLITS={
  abc:[["Peito e Tríceps",["supino","inclin","voador","triceps","frances"]],["Costas e Bíceps",["puxada","remada","serrote","rosca","martelo"]],["Pernas e Ombros",["agach","leg","ext","flex","desenv","lateral","pant"]]],
  abcd:[["Peito",["supino","inclin","voador","triceps"]],["Costas",["puxada","remada","serrote","rosca"]],["Pernas",["agach","leg","ext","flex","pant"]],["Ombros e Braços",["desenv","lateral","face","martelo","frances"]]],
  ab:[["Superior",["supino","puxada","remada","desenv","rosca","triceps"]],["Inferior",["agach","leg","flex","stiff","pant","abd"]]],
  gluteo:[["Glúteo e Posterior",["pelv","stiff","abdu","flex"]],["Superior",["puxada","supmaq","lateral","remada","triceps"]],["Pernas",["agach","leg","ext","bulgaro","pant"]]],
  saude:[["Treino A",["leg","puxada","supmaq","flex","abd"]],["Treino B",["goblet","remmaq","desmaq","ext","pant"]]],
  forca:[["Agachamento",["agach","leg","flex"]],["Supino",["supino","inclin","triceps"]],["Terra",["terra","remada","puxada"]],["Desenvolvimento",["desmil","lateral","rosca"]]]
};
const SONO=["Dormi mal essa noite","Dormi pouco, com sono"],CANS=["Muito cansado hoje","Cheguei cansada do trabalho"],BEM=["Treino muito bom hoje","Me senti bem, com energia"],
  OMBRO=["Dor no ombro direito no supino"],LOMBAR=["Dor na lombar no agachamento"],JOELHO=["Dor no joelho na extensora"],CHEIA=["Academia muito cheia, horário de pico"],COMIDA=["Comi pouco antes do treino"];
/* g: % de força a cada 30 dias; mix: diferença entre exercícios; ad: chance de ir no dia; par: dias parado até hoje. */
const ALUNOS=[
 {n:"Marina Alves",s:"F",nasc:"14/03/1996",a:165,o:"Hipertrofia",d:[1,2,4,5],sp:"abcd",f:.55,g:5,sem:20,ad:.92,p:[63,65],c:[71,70],q:[100,102],coment:BEM,ani:"bom",ac:["Smart Fit Centro"]},
 {n:"Rafael Costa",s:"M",nasc:"02/08/1991",a:180,o:"Hipertrofia",d:[1,2,3,4,5],sp:"abc",f:1.15,g:0,mix:1,sem:20,ad:.88,p:[86,86.5],c:[89,89],coment:CHEIA,ani:"ok",ac:["Bluefit","Smart Fit Centro"],obs:"Treina há 8 anos"},
 {n:"Juliana Ferreira",s:"F",nasc:"21/11/1984",a:160,o:"Emagrecimento",d:[1,3,5],sp:"ab",f:.45,g:4,sem:18,ad:.85,p:[78,72],c:[92,85],q:[108,104],coment:BEM,ani:"bom",ac:["Academia do Bairro"]},
 {n:"Pedro Henrique Dias",s:"M",nasc:"30/05/2009",a:174,o:"Ganho de força",d:[1,3,5],sp:"ab",f:.6,g:8,sem:14,ad:.9,p:[60,63],c:[70,71],coment:BEM,ani:"bom",ac:["Academia do Bairro"],obs:"17 anos, autorização dos pais"},
 {n:"Helena Martins",s:"F",nasc:"09/01/1959",a:157,o:"Saúde e mobilidade",d:[2,4],sp:"saude",f:.3,g:2.5,sem:24,ad:.9,rep:"12",p:[61,60],c:[84,83],q:[99,98],ani:"bom",ac:["Studio Vida"],obs:"Osteopenia. Evitar impacto"},
 {n:"Thiago Ramos",s:"M",nasc:"17/06/1998",a:176,o:"Hipertrofia",d:[1,2,3,4,5,6],sp:"abc",f:1.05,g:-3,mix:1,sem:16,ad:.95,rir:0,p:[80,78],c:[82,81],coment:SONO.concat(CANS),pc:.5,ani:"ruim",ac:["Bluefit"]},
 {n:"Camila Duarte",s:"F",nasc:"05/09/1993",a:168,o:"Retorno pós-parto",d:[1,3,5],sp:"saude",f:.4,g:6,sem:10,ad:.8,rep:"12",p:[72,69],c:[88,83],q:[106,103],coment:SONO,pc:.3,ani:"ok",ac:["Studio Vida"],obs:"Parto há 7 meses, liberada pelo médico"},
 {n:"Lucas Barbosa",s:"M",nasc:"12/02/2003",a:182,o:"Hipertrofia",d:[1,3,5],sp:"ab",f:.5,g:0,sem:1.4,ad:1,p:[74,74],c:[80,80],ani:"bom",ac:["Smart Fit Centro"],obs:"Iniciante"},
 {n:"Beatriz Moura",s:"F",nasc:"28/07/1990",a:170,o:"Hipertrofia",d:[1,2,4,5],sp:"abcd",f:.6,g:1,mix:1,sem:18,ad:.85,p:[66,67],c:[73,73],q:[101,102],coment:OMBRO,pc:.35,ani:"ok",ac:["Bluefit"],obs:"Tendinite no ombro direito"},
 {n:"André Vieira",s:"M",nasc:"03/04/1981",a:175,o:"Emagrecimento",d:[1,2,4,5],sp:"ab",f:.8,g:1,sem:16,ad:.4,p:[98,97],c:[106,105],coment:CANS.concat(COMIDA),pc:.3,ani:"ok",ac:["Academia do Bairro"],obs:"Hipertensão controlada"},
 {n:"Patrícia Lopes",s:"F",nasc:"19/12/1975",a:162,o:"Saúde",d:[1,3,5],sp:"saude",f:.35,g:2,sem:16,ad:.8,par:17,rep:"12",p:[70,69],c:[86,85],q:[104,103],ani:"ok",ac:["Studio Vida"]},
 {n:"Gustavo Pereira",s:"M",nasc:"25/10/1995",a:178,o:"Ganho de força",d:[1,2,4,6],sp:"forca",f:1.4,g:4,sem:24,ad:.95,rep:"5",rir:1,p:[92,94],c:[90,91],coment:BEM,ani:"bom",ac:["Iron Gym"],obs:"Competirá em powerlifting em março"},
 {n:"Larissa Teixeira",s:"F",nasc:"08/06/2001",a:164,o:"Glúteos e pernas",d:[1,2,3,4,5],sp:"gluteo",f:.7,g:5,mix:1,sem:20,ad:.9,p:[58,60],c:[66,66],q:[96,99],coment:BEM,ani:"bom",ac:["Smart Fit Centro"]},
 {n:"Eduardo Santos",s:"M",nasc:"15/02/1968",a:172,o:"Saúde",d:[1,3,5],sp:"saude",f:.55,g:1.5,sem:20,ad:.85,rep:"12",p:[84,82],c:[98,96],coment:JOELHO,pc:.2,ani:"ok",ac:["Studio Vida"],obs:"Artrose leve no joelho esquerdo"},
 {n:"Fernanda Rocha",s:"F",nasc:"11/03/1988",a:167,o:"Hipertrofia",d:[1,3,4,6],sp:"abc",f:.55,g:-4,sem:16,ad:.8,p:[64,62],c:[72,72],q:[99,97],coment:COMIDA.concat(CANS),pc:.4,ani:"ruim",ac:["Bluefit"]},
 {n:"Vinícius Cardoso",s:"M",nasc:"22/09/2000",a:184,o:"Hipertrofia",d:[1,2,4,5],sp:"abcd",f:.9,g:2,mix:1,sem:14,ad:.85,p:[82,83],c:[84,84],coment:LOMBAR,pc:.35,ani:"ok",ac:["Iron Gym"]},
 {n:"Aline Nogueira",s:"F",nasc:"30/01/1982",a:171,o:"Condicionamento",d:[2,4,6],sp:"ab",f:.5,g:3,sem:18,ad:.8,p:[69,68],c:[77,75],q:[103,102],coment:CHEIA,pc:.2,ani:"bom",ac:["Smart Fit Centro","Bluefit","Iron Gym"],obs:"Viaja a trabalho, treina em academias diferentes"},
 {n:"Bruno Tavares",s:"M",nasc:"07/07/1987",a:179,o:"Hipertrofia",d:[1,3,5],sp:"abc",f:1,g:3,mix:.6,sem:22,ad:.9,p:[88,90],c:[92,91],ani:"bom",ac:["Iron Gym"]},
 {n:"Mateus Oliveira",s:"M",nasc:"16/04/2002",a:177,o:"Emagrecimento",d:[],status:"montar treino",peso:"89"},
 {n:"Renata Gomes",s:"",nasc:"",a:"",o:"",d:[],status:"aguardando cadastro"}
];
const PROF={n:"Professor (você)",s:"M",nasc:"20/05/1990",a:178,o:"Hipertrofia",d:[1,2,4,5],sp:"abcd",f:1,g:3,mix:.5,sem:20,ad:.9,p:[80,81],c:[84,84],coment:BEM,ani:"bom",ac:["Iron Gym"]};

const DIAS=["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
const fd=d=>pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear();
function sorte(n){let a=n*2654435+1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const virg=x=>String(Math.round(x*10)/10).replace(".",",");

function preencher(ss,u,i){
  const rnd=sorte(i+1),hoje=new Date(),split=SPLITS[u.sp];
  const dia=q=>new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()-q);
  const seriesDe=u.rep==="5"?5:u.rep==="12"?3:4,meta=u.rep||"10";
  const nomes={};split.forEach(t=>t[1].forEach(k=>{nomes[k]=EX[k]}));
  ss.getSheetByName("Exercícios").d.push(...Object.values(nomes).map(e=>[e[0],e[1]]));
  const mod=ss.getSheetByName("Modelos");
  split.forEach(t=>t[1].forEach(k=>{const e=EX[k];mod.d.push([t[0],e[0],String(seriesDe),meta,e[2]*u.f<3?"":Math.round(e[2]*u.f)+"kg"])}));
  const h=ss.getSheetByName("Histórico");
  const total=Math.round(u.sem*7);let vez=0;
  for(let q=total;q>=(u.par||0);q--){
    const d=dia(q);
    if(!u.d.includes(d.getDay())||rnd()>u.ad)continue;
    const t=split[vez++%split.length];
    const hora0=(u.d.length>4?6:17)*60+Math.floor(rnd()*90);let min=hora0;
    const ac=u.ac[Math.floor(rnd()*u.ac.length)];
    const ani=rnd()<.7?u.ani:["bom","ok","ruim"][Math.floor(rnd()*3)];
    let obs="[Ânimo início: "+ani+"] · [Ânimo fim: "+(ani==="ruim"&&rnd()<.5?"ok":ani)+"]";
    obs+=" · [Duração: "+(45+Math.floor(rnd()*35))+" min]";
    if(u.coment&&rnd()<(u.pc||.15))obs+=" "+u.coment[Math.floor(rnd()*u.coment.length)];
    t[1].forEach((k,ix)=>{
      const e=EX[k],g=u.g+(u.mix||0)*5*((ix%3)-1);
      const fator=1+g/100*(total-q)/30;
      const bruto=e[2]*u.f*fator*(.985+rnd()*.03),passo=bruto<25?1:2.5;
      const peso=Math.max(1,Math.round(bruto/passo)*passo);
      for(let s=1;s<=seriesDe;s++){
        min+=2+Math.floor(rnd()*3);
        const feitas=Math.max(1,parseInt(meta,10)+1-s+Math.floor(rnd()*2));
        h.d.push([fd(d),DIAS[d.getDay()],t[0],pad(Math.floor(min/60)%24)+":"+pad(min%60),e[1],e[0],String(s),meta,String(feitas),virg(peso)+"kg","",String(u.rir==null?1+Math.floor(rnd()*3):u.rir),!ix&&s===1?obs:"",ac]);
      }
    });
  }
  const av=Math.max(1,Math.round(u.sem/7));
  for(let k=0;k<=av;k++){
    const p=av?k/av:1,q=Math.round(total*(1-p))+(k===av?3:0),lin=(x)=>x[0]+(x[1]-x[0])*p;
    const v={Data:fd(dia(q)),"Peso (kg)":virg(lin(u.p)),"Altura (cm)":String(u.a),"Pescoço (cm)":String(u.s==="F"?33:38.5).replace(".",","),"Cintura (cm)":virg(lin(u.c))};
    if(u.q)v["Quadril (cm)"]=virg(lin(u.q));
    v["Braço relaxado D (cm)"]=virg((u.s==="F"?29:35)+p*(u.g>0?1:0));
    v["Coxa D (cm)"]=virg((u.s==="F"?56:58)+p*(u.g>0?1:0));
    motor.gravarAvaliacao_(ss,v);
  }
}
function semear(){
  painel=new Book("Painel de teste");
  const mestre=new Book("Treino do professor","SSMASTERxxxxxxxxxxxxxxxxxxxxxxx");
  mestre.sheets[0].name="Histórico";mestre.sheets[0].d=[["Data","Dia","Treino","Horário","Grupo","Exercício","Série","Reps meta","Reps feitas","Peso","Intensidade","Reps sobrando","Observações","Academia"]];
  mestre.insertSheet("Exercícios").d=[["Exercício","Grupo"]];
  mestre.insertSheet("Modelos").d=[["Treino","Exercício","Séries","Reps meta","Peso inicial"]];
  mestre.insertSheet("Avaliações").d=[["Data"]];
  const espera=()=>{const t=Date.now();while(Date.now()-t<3);};
  [PROF].concat(ALUNOS).forEach((u,i)=>{
    espera();
    const sexo=u.s==="F"?"Feminino":u.s==="M"?"Masculino":"";
    const dados={nome:u.n,nasc:u.nasc,sexo,altura:String(u.a),objetivo:u.o,telefone:"41 90000-00"+pad(i),dias:u.d.length?String(u.d.length):"",obs:u.obs||"",peso:u.peso||(u.p?virg(u.p[1]):"")};
    if(u===PROF)dados.planilhaExistente=mestre.id;
    const al=motor.salvarAluno_(dados);
    if(u.status)al.status=u.status;else{al.status="ok";al.aceite=fd(new Date())+" 08:00"}
    motor.escreverAluno_(al);
    if(u.sp)preencher(u===PROF?mestre:motor.abrirPlanilhaAluno_(al),u,i);
  });
  motor.catalogo_();
  motor.lerMetodos_().forEach(m=>motor.aprovarMetodo_({linha:m.linha,aprovado:true}));
}

/* Planos fictícios para mostrar o Financeiro, com vencimentos em torno de hoje. */
function semearFinanceiro(){
  const PL=[["Mensal",250],["Trimestral",690],["Semestral",1290],["Anual",2400]],FO=["Pix","Cartão","Dinheiro","Transferência"];
  const hoje=new Date(),em=d=>fd(new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()+d));
  const lista=motor.doPost({postData:{contents:JSON.stringify({action:"alunos",p:"DEMO"})}});
  JSON.parse(lista.s).alunos.filter(a=>!a.master&&a.status==="ok").forEach((a,i)=>{
    const pl=PL[i%4],av=i%9===8;
    const d={alunoId:a.id,nome:a.nome,plano:av?"Aula avulsa":pl[0],valor:av?80:pl[1],forma:FO[i%4],venc:""};
    if(av){d.aulasTotal=10}else d.venc=em(i%7===2?-(4+i):i%5===1?1+i%6:9+i*2);
    motor.finSalvar_(d);
    if(!av&&i%3===0)motor.finPagar_({alunoId:a.id,valor:pl[1],forma:FO[i%4],data:em(-(i%4)-1),aulas:0});
  });
}

/* ---------- conversa com a página ---------- */
self.onmessage=async e=>{
  const m=e.data;
  if(m.iniciar){
    cfg=m;motor=criar();
    let estado=null;try{estado=await ler()}catch(x){}
    if(estado&&estado.versao===VERSAO_ALUNOS)restaurar(estado);
    else{semear();try{await guardar()}catch(x){}}
    if(!painel.getSheetByName("Financeiro")){semearFinanceiro();try{await guardar()}catch(x){}}
    self.postMessage({pronto:true});
    return;
  }
  const out=motor.doPost({postData:{contents:m.corpo}});
  self.postMessage({id:m.id,saida:out.s});
  if(sujo){clearTimeout(timer);timer=setTimeout(()=>guardar().catch(()=>{}),400)}
};
