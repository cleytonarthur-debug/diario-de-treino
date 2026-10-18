/* Avaliação física: campos, desenho do corpo (frente e costas) e cálculos.
   Os rótulos dos campos são os mesmos nomes das colunas da aba Avaliações. */
window.Body=(function(){
"use strict";
const F=(k,u,grp,extra)=>Object.assign({k,u,grp},extra||{});

const GERAL=[F("Peso (kg)","kg","geral"),F("Altura (cm)","cm","geral"),F("FC repouso (bpm)","bpm","geral"),F("Pressão arterial","","geral",{text:true,ph:"120/80"})];
const BIO=[F("% Gordura (bioimpedância)","%","bio"),F("Massa muscular (kg, bioimpedância)","kg","bio")];
const PER=[
  F("Pescoço (cm)","cm","per"),F("Ombros (cm)","cm","per"),F("Tórax (cm)","cm","per"),
  F("Cintura (cm)","cm","per"),F("Abdômen (cm)","cm","per"),F("Quadril (cm)","cm","per"),
  F("Braço relaxado D (cm)","cm","per"),F("Braço relaxado E (cm)","cm","per"),
  F("Braço contraído D (cm)","cm","per"),F("Braço contraído E (cm)","cm","per"),
  F("Antebraço D (cm)","cm","per"),F("Antebraço E (cm)","cm","per"),
  F("Coxa D (cm)","cm","per"),F("Coxa E (cm)","cm","per"),
  F("Panturrilha D (cm)","cm","per"),F("Panturrilha E (cm)","cm","per")];
const DOB=[
  F("Dobra peitoral (mm)","mm","dob"),F("Dobra axilar média (mm)","mm","dob"),F("Dobra tríceps (mm)","mm","dob"),
  F("Dobra subescapular (mm)","mm","dob"),F("Dobra abdominal (mm)","mm","dob"),F("Dobra supra-ilíaca (mm)","mm","dob"),
  F("Dobra coxa (mm)","mm","dob")];
const CALC=["IMC","RCQ","% Gordura (dobras)","% Gordura","Massa gorda (kg)","Massa magra (kg)"];
const OBS="Observações";
const FIELDS=[...GERAL,...BIO,...PER,...DOB];
const BYK=Object.fromEntries(FIELDS.map(f=>[f.k,f]));

/* Pontos no desenho. x,y no espaço 0..400 x 0..400 (frente 0..200, costas 200..400).
   Na frente, o lado direito do aluno fica à esquerda de quem olha. */
const P=(id,t,x,y,keys,dobra)=>({id,t,x,y,keys,dobra:!!dobra});
const POINTS=[
  P("pescoco","Pescoço",100,66,["Pescoço (cm)"]),
  P("ombros","Ombros",134,82,["Ombros (cm)"]),
  P("torax","Tórax",100,106,["Tórax (cm)"]),
  P("cintura","Cintura",100,148,["Cintura (cm)"]),
  P("abdomen","Abdômen",100,170,["Abdômen (cm)"]),
  P("quadril","Quadril",100,198,["Quadril (cm)"]),
  P("bracoD","Braço D",50,124,["Braço relaxado D (cm)","Braço contraído D (cm)"]),
  P("bracoE","Braço E",150,124,["Braço relaxado E (cm)","Braço contraído E (cm)"]),
  P("antebD","Antebraço D",40,166,["Antebraço D (cm)"]),
  P("antebE","Antebraço E",160,166,["Antebraço E (cm)"]),
  P("coxaD","Coxa D",83,238,["Coxa D (cm)"]),
  P("coxaE","Coxa E",117,238,["Coxa E (cm)"]),
  P("pantD","Panturrilha D",82,318,["Panturrilha D (cm)"]),
  P("pantE","Panturrilha E",118,318,["Panturrilha E (cm)"]),
  P("dPeit","Dobra peitoral",78,98,["Dobra peitoral (mm)"],true),
  P("dAxil","Dobra axilar média",69,128,["Dobra axilar média (mm)"],true),
  P("dAbd","Dobra abdominal",88,172,["Dobra abdominal (mm)"],true),
  P("dSupra","Dobra supra-ilíaca",72,186,["Dobra supra-ilíaca (mm)"],true),
  P("dCoxa","Dobra coxa",84,266,["Dobra coxa (mm)"],true),
  P("dTric","Dobra tríceps",350,122,["Dobra tríceps (mm)"],true),
  P("dSub","Dobra subescapular",322,110,["Dobra subescapular (mm)"],true)
];

function figura(ox){
  // Silhueta simples, simétrica, em 200x400.
  const X=x=>x+ox;
  const torso=`M${X(80)},72 C${X(70)},74 ${X(60)},78 ${X(58)},88 L${X(60)},120 C${X(64)},150 ${X(70)},170 ${X(70)},190 L${X(68)},212 L${X(132)},212 L${X(130)},190 C${X(130)},170 ${X(136)},150 ${X(140)},120 L${X(142)},88 C${X(140)},78 ${X(130)},74 ${X(120)},72 Z`;
  const bracoE=`M${X(142)},86 C${X(152)},90 ${X(156)},104 ${X(156)},120 L${X(164)},170 L${X(168)},214 C${X(169)},222 ${X(160)},224 ${X(158)},216 L${X(150)},172 L${X(142)},130 Z`;
  const bracoD=`M${X(58)},86 C${X(48)},90 ${X(44)},104 ${X(44)},120 L${X(36)},170 L${X(32)},214 C${X(31)},222 ${X(40)},224 ${X(42)},216 L${X(50)},172 L${X(58)},130 Z`;
  const pernaD=`M${X(68)},208 L${X(99)},208 L${X(96)},270 L${X(94)},300 L${X(92)},370 L${X(96)},384 L${X(74)},386 L${X(76)},370 L${X(70)},300 L${X(68)},268 Z`;
  const pernaE=`M${X(132)},208 L${X(101)},208 L${X(104)},270 L${X(106)},300 L${X(108)},370 L${X(104)},384 L${X(126)},386 L${X(124)},370 L${X(130)},300 L${X(132)},268 Z`;
  return `<g><ellipse class="sil" cx="${X(100)}" cy="38" rx="19" ry="23"/><rect class="sil" x="${X(91)}" y="56" width="18" height="18" rx="5"/>`+
    `<path class="sil" d="${bracoD}"/><path class="sil" d="${bracoE}"/><path class="sil" d="${pernaD}"/><path class="sil" d="${pernaE}"/><path class="sil" d="${torso}"/></g>`;
}

/* values: {campo: texto}; sel: id do ponto escolhido */
function svg(values,sel){
  const has=p=>p.keys.some(k=>String(values&&values[k]||"").trim());
  return `<svg class="body-svg" viewBox="0 0 400 400" role="group" aria-label="Desenho do corpo: toque num ponto para ver ou lançar a medida">`+
    figura(0)+figura(200)+
    `<text class="side" x="100" y="398" text-anchor="middle">FRENTE</text><text class="side" x="300" y="398" text-anchor="middle">COSTAS</text>`+
    `<text class="side" x="28" y="100">D</text><text class="side" x="166" y="100">E</text>`+
    `<text class="side" x="228" y="100">E</text><text class="side" x="366" y="100">D</text>`+
    POINTS.map(p=>`<g class="pt${p.dobra?" dobra":""}${has(p)?" has":""}${p.id===sel?" sel":""}" data-pt="${p.id}" tabindex="0" role="button" aria-label="${p.t}"><circle cx="${p.x}" cy="${p.y}" r="7"/><title>${p.t}</title></g>`).join("")+
    `</svg>`;
}

/* ---------- cálculos ---------- */
const num=v=>{if(v==null)return NaN;const s=String(v).replace(/\s/g,"").replace(",",".");const n=parseFloat(s);return isFinite(n)?n:NaN};
function idadeEm(nasc,data){
  const m=String(nasc||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return NaN;
  const d=data||new Date();let a=d.getFullYear()-(+m[3]);
  if(d.getMonth()+1<+m[2]||(d.getMonth()+1===+m[2]&&d.getDate()<+m[1]))a--;return a;
}
const sexoDe=s=>{s=String(s||"").trim().toLowerCase();return /^(m|h)/.test(s)?"M":/^f/.test(s)?"F":""};

function calc(v,perfil,data){
  const out={};const r=(x,n)=>isFinite(x)?Math.round(x*Math.pow(10,n))/Math.pow(10,n):NaN;
  const peso=num(v["Peso (kg)"]);const alt=num(v["Altura (cm)"])||num(perfil&&perfil.altura);
  if(peso&&alt)out["IMC"]=r(peso/Math.pow(alt/100,2),1);
  const ci=num(v["Cintura (cm)"]),qu=num(v["Quadril (cm)"]);if(ci&&qu)out["RCQ"]=r(ci/qu,2);
  const idade=idadeEm(perfil&&perfil.nasc,data);const sx=sexoDe(perfil&&perfil.sexo);
  const d=k=>num(v["Dobra "+k+" (mm)"]);
  const sete=["peitoral","axilar média","tríceps","subescapular","abdominal","supra-ilíaca","coxa"].map(d);
  let dens=NaN,prot="";
  if(isFinite(idade)&&sx){
    if(sete.every(x=>x>0)){const S=sete.reduce((a,b)=>a+b,0);
      dens=sx==="M"?1.112-0.00043499*S+0.00000055*S*S-0.00028826*idade:1.097-0.00046971*S+0.00000056*S*S-0.00012828*idade;prot="Jackson & Pollock, 7 dobras"}
    else{const tres=sx==="M"?["peitoral","abdominal","coxa"].map(d):["tríceps","supra-ilíaca","coxa"].map(d);
      if(tres.every(x=>x>0)){const S=tres.reduce((a,b)=>a+b,0);
        dens=sx==="M"?1.10938-0.0008267*S+0.0000016*S*S-0.0002574*idade:1.0994921-0.0009929*S+0.0000023*S*S-0.0001392*idade;prot="Jackson & Pollock, 3 dobras"}}
  }
  if(isFinite(dens))out["% Gordura (dobras)"]=r(495/dens-450,1);
  const g=isFinite(out["% Gordura (dobras)"])?out["% Gordura (dobras)"]:num(v["% Gordura (bioimpedância)"]);
  if(isFinite(g)){out["% Gordura"]=r(g,1);if(peso){out["Massa gorda (kg)"]=r(peso*g/100,1);out["Massa magra (kg)"]=r(peso-peso*g/100,1)}}
  out._protocolo=prot||(isFinite(g)?"bioimpedância":"");
  out._faltaPerfil=!(isFinite(idade)&&sx);
  return out;
}

return {GERAL,BIO,PER,DOB,CALC,OBS,FIELDS,BYK,POINTS,svg,calc,num,idadeEm,sexoDe};
})();
