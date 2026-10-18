/* Conversa com o programa central (Apps Script). Guarda o acesso no aparelho e a
   última leitura de cada aluno, para abrir sem internet. */
window.Api=(function(){
"use strict";
const CFG_KEY="dt2-acesso";
const TIMEOUT_MS=30000;

function load(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function put(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function fail(code,message,sent){const e=new Error(message||code);e.code=code;e.sent=!!sent;return e}

/* Link: https://…/#api=<url /exec>&t=<código do aluno>  ou  &p=<chave do professor> */
function parseLink(s){
  const h=String(s||"");const i=h.indexOf("#");const q=new URLSearchParams(i>=0?h.slice(i+1):h);
  const api=q.get("api"),t=q.get("t"),p=q.get("p");
  if(!api||!/^https:\/\/script\.google\.com\/.+\/exec$/.test(api)||(!t&&!p))return null;
  return p?{api,p}:{api,t};
}
function fromHash(){
  const c=parseLink(location.hash);
  if(c){
    const old=load(CFG_KEY);
    // Professor abrindo o link de um aluno neste aparelho: não troca sozinho (perderia o acesso de professor).
    if(old&&old.p&&c.t&&!sessionStorage.getItem("dt2-trocar"))return {cfg:old,changed:false,conflict:c};
    sessionStorage.removeItem("dt2-trocar");
    put(CFG_KEY,c);
    // No iPhone o ícone da tela inicial abre o endereço com o #, então o link continua servindo.
    // No Android o app abre sem #, e usa o que ficou guardado aqui.
    return {cfg:c,changed:!old||old.api!==c.api||old.t!==c.t||old.p!==c.p};
  }
  return {cfg:load(CFG_KEY),changed:false};
}
function config(){return load(CFG_KEY)}
function setConfig(c){put(CFG_KEY,c)}
function logout(){
  try{Object.keys(localStorage).filter(k=>k.startsWith("dt2-")).forEach(k=>localStorage.removeItem(k))}catch(e){}
}

/* e.sent=true: o pedido pode ter chegado (resultado incerto). false: com certeza não chegou
   ou o servidor recusou (nada gravado). */
async function call(action,body){
  const cfg=config();
  if(!cfg)throw fail("not_configured");
  if(!navigator.onLine)throw fail("offline");
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  const payload=Object.assign({action},body||{});
  if(cfg.p)payload.p=cfg.p;else payload.t=cfg.t;
  let text="",status=0;
  try{
    const res=await fetch(cfg.api,{method:"POST",signal:ctl.signal,redirect:"follow",
      headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
    status=res.status;text=await res.text();
  }catch(e){
    throw fail(ctl.signal.aborted?"timeout":(navigator.onLine?"network":"offline"),e&&e.message,true);
  }finally{clearTimeout(timer)}
  let data=null;try{data=JSON.parse(text)}catch(e){}
  if(!data){
    if(/<html/i.test(text))throw fail("bad_deploy","Resposta em HTML (HTTP "+status+")",true);
    throw fail("bad_response","HTTP "+status,true);
  }
  if(!data.ok)throw fail(data.error||"server_error",data.message,false);
  return data;
}

function cacheGet(k){return load("dt2-cache-"+k)}
function cacheSet(k,v){put("dt2-cache-"+k,Object.assign({storedAt:Date.now()},v))}

return {fromHash,parseLink,config,setConfig,logout,call,cacheGet,cacheSet,store:{load,put}};
})();
