/* Atualização do app (gratuita: GitHub Pages + service worker).
   - O site publica versao.json com a versão atual.
   - O app compara com a própria versão (abaixo). Se houver versão nova, limpa a cópia
     guardada no aparelho e recarrega já com os arquivos novos.
   VERSAO e DATA são trocados pelo script tools/versao.mjs a cada publicação. */
window.Atualizacao=(function(){
"use strict";
const VERSAO="2.4.0";
const DATA="24/10/2026";
const K="dt2-ultima-verificacao";

// compara "2.4.10" com "2.4.9" número a número
function cmp(a,b){
  const x=String(a||"0").split(".").map(n=>parseInt(n,10)||0),y=String(b||"0").split(".").map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d}
  return 0;
}

async function verificar(){
  if(!navigator.onLine){const e=new Error("Sem internet.");e.code="offline";throw e}
  const r=await fetch("versao.json?t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error("Não consegui ler a versão do servidor (HTTP "+r.status+").");
  const info=await r.json();
  try{localStorage.setItem(K,JSON.stringify({em:Date.now(),remota:info.versao}))}catch(e){}
  return {local:VERSAO,remota:info.versao,nova:cmp(info.versao,VERSAO)>0,info};
}
function ultima(){try{return JSON.parse(localStorage.getItem(K)||"null")}catch(e){return null}}

// Baixa a versão nova: atualiza o service worker, apaga a cópia antiga e recarrega.
// O rascunho do treino e o acesso ficam guardados (localStorage) e não são apagados.
async function aplicar(){
  try{
    if("serviceWorker" in navigator){
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg){try{await reg.update()}catch(e){}if(reg.waiting)reg.waiting.postMessage("pular-espera")}
    }
    if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}
  }finally{
    location.replace(location.pathname+"?atualizado="+Date.now()+location.hash);
  }
}

return {VERSAO,DATA,cmp,verificar,ultima,aplicar};
})();
