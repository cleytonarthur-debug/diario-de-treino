/* Versão de teste (teste.html): o app de verdade, com alunos fictícios que ficam só neste aparelho.
   Não lê nem grava dados reais: só fala com o programa central para conferir o link e usar a IA. */
(function(){
"use strict";
const API=location.hostname==="localhost"?location.origin+"/exec":"https://script.google.com/macros/s/AKfycbztFNMiyDaVQpbpO3ZJXdEmDmfXKXqQCOeY6rTGflYqE1sjyXS5W_MsZVF3o8zGMn1djQ/exec";
const API_FALSA="https://script.google.com/macros/s/DEMO/exec";

/* Tudo o que o app guarda neste modo fica separado do acesso real do aparelho. */
const P="dtdemo:",sp=Storage.prototype,get=sp.getItem,set=sp.setItem,rem=sp.removeItem;
sp.getItem=function(k){return get.call(this,P+k)};
sp.setItem=function(k,v){return set.call(this,P+k,v)};
sp.removeItem=function(k){return rem.call(this,P+k)};

const m=/[#&]c=([A-Za-z0-9]+)/.exec(location.hash);
if(m){localStorage.setItem("demo-codigo",m[1]);history.replaceState(null,"",location.pathname)}
const codigo=localStorage.getItem("demo-codigo")||"";
let aparelho=localStorage.getItem("demo-aparelho");
if(!aparelho){aparelho="ap-"+crypto.randomUUID();localStorage.setItem("demo-aparelho",aparelho)}
localStorage.setItem("dt2-acesso",JSON.stringify({api:API_FALSA,p:"DEMO"}));
localStorage.setItem("dt2-install-ok","1");

/* Tela de espera, que vira aviso quando o link não vale neste aparelho. */
const css=document.createElement("style");
css.textContent="#demo-capa{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:#0e0f12;color:#f2f3f5;font:16px/1.5 system-ui,sans-serif;text-align:center}"+
  "#demo-capa b{display:block;font-size:20px;margin-bottom:8px}#demo-capa div{max-width:340px}"+
  "#demo-faixa{padding:6px 16px;background:#23262d;color:#f2f3f5;font:12px/1.4 system-ui,sans-serif;text-align:center}"+
  "#demo-aviso{position:fixed;left:16px;right:16px;bottom:96px;z-index:9998;padding:12px 16px;border-radius:12px;background:#23262d;color:#f2f3f5;font:14px/1.4 system-ui,sans-serif;text-align:center}"+
  ".linkbox,[data-copy],.btn.wa,.btn.wa-p,#p-out{display:none!important}";
document.documentElement.appendChild(css);
const capa=document.createElement("div");capa.id="demo-capa";
const mostrar=(t,x)=>{capa.textContent="";const d=document.createElement("div"),b=document.createElement("b");b.textContent=t;d.appendChild(b);d.appendChild(document.createTextNode(x||""));capa.appendChild(d)};
mostrar("Preparando a versão de teste","Isso leva alguns segundos.");
document.documentElement.appendChild(capa);

const MOTIVOS={demo_outro_aparelho:["Este link já foi usado em outro aparelho","O link de teste é pessoal e funciona em um só aparelho. Peça o seu ao professor."],
  demo_vencido:["Este link de teste venceu","Fale com o professor para pedir um novo."],
  demo_pausado:["Este link de teste foi pausado","Fale com o professor."],
  demo_invalido:["Link de teste inválido","Abra o link completo que o professor enviou."]};

const fetchReal=window.fetch.bind(window);
async function conferir(){
  if(!codigo)throw {codigo:"demo_invalido"};
  let r;
  try{
    const res=await fetchReal(API,{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"demoEntrar",demo:codigo,aparelho})});
    r=await res.json();
  }catch(e){
    const ok=localStorage.getItem("demo-para");
    if(ok!=null)return ok; // sem internet, depois de já ter entrado neste aparelho
    throw {codigo:"sem_internet"};
  }
  if(!r.ok)throw {codigo:r.error};
  localStorage.setItem("demo-para",r.para||"");
  return r.para||"";
}

/* Os dados rodam em segundo plano, com o mesmo programa central do app e planilhas guardadas no aparelho. */
const pedidos=new Map();let seq=0,worker=null;
const liberado=conferir().then(para=>new Promise(pronto=>{
  worker=new Worker("js/demo-worker.js");
  worker.onmessage=e=>{
    if(e.data.pronto){capa.remove();colocarFaixa(para);pronto();return}
    const f=pedidos.get(e.data.id);pedidos.delete(e.data.id);if(f)f(e.data.saida);
  };
  worker.postMessage({iniciar:true,api:API,codigo,aparelho});
})).catch(e=>{
  const t=MOTIVOS[e.codigo]||["Sem conexão","Conecte-se à internet e abra o link de novo."];
  mostrar(t[0],t[1]);
  return new Promise(()=>{}); // o app fica parado atrás do aviso
});
function colocarFaixa(para){
  const entra=()=>{const f=document.createElement("div");f.id="demo-faixa";
    f.textContent="Versão de teste"+(para?" de "+para:"")+" · alunos fictícios · uso pessoal";
    document.body.insertBefore(f,document.body.firstChild)};
  if(document.body)entra();else document.addEventListener("DOMContentLoaded",entra);
}

window.fetch=async function(u,o){
  if(String(u&&u.url||u)!==API_FALSA)return fetchReal(u,o);
  await liberado;
  const saida=await new Promise(f=>{const id=++seq;pedidos.set(id,f);worker.postMessage({id,corpo:o.body})});
  return new Response(saida,{status:200,headers:{"Content-Type":"application/json"}});
};

/* Nesta versão nada sai do aparelho: sem envio por WhatsApp e sem cópia de link. */
function avisar(t){let a=document.getElementById("demo-aviso");if(!a){a=document.createElement("div");a.id="demo-aviso";document.body.appendChild(a)}a.textContent=t;clearTimeout(avisar.t);avisar.t=setTimeout(()=>a.remove(),3000)}
document.addEventListener("click",e=>{
  const a=e.target.closest&&e.target.closest("a[href]");if(!a)return;
  if(/wa\.me|whatsapp/i.test(a.href)){e.preventDefault();e.stopPropagation();avisar("Na versão de teste, o envio pelo WhatsApp fica desligado.")}
  else if(/docs\.google\.com/.test(a.href)){e.preventDefault();e.stopPropagation();avisar("Na versão de teste, os alunos ficam só neste aparelho, sem planilha.")}
},true);
})();
