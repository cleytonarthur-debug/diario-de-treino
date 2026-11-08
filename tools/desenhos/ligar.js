// Liga os desenhos ao app: regras de nome -> GIF, codigo e estilos. Uso: node ligar.js <pasta-do-repo> <mapa.json> <gera-exs.txt>
const fs=require("fs"),path=require("path");const W=process.argv[2];
const R=[
["abdominal.*cabo","abdominal-cabo"],["(abdominal|abdomen|\\babs\\b).*maquina|abdominal na maquina","abdominal-maquina"],["abdominal.*solo|crunch","abdominal-solo"],["abdominal|abdomen|\\babs\\b","abdominal-banco"],
["prancha lateral","prancha-lateral"],["prancha.*joelho","prancha-joelhos"],["prancha","prancha"],["elevacao de pernas","elevacao-pernas"],["bicicleta no solo","bicicleta-solo"],["superman","superman"],["perdigueiro|bird dog","perdigueiro"],["extensao lombar","extensao-lombar"],
["panturrilha.*isometria","panturrilha-leg-press-isometria"],["panturrilha.*sentad","panturrilha-sentado"],["panturrilha.*degrau","panturrilha-degrau"],["panturrilha.*(leg|45)","panturrilha-leg-press"],["panturrilha","panturrilha-em-pe"],
["leg ?press.*(180|horizontal)","leg-press-horizontal"],["leg ?press.*articulad","leg-press-articulado"],["leg ?press","leg-press-45"],
["extensora.*(unilateral| d$| e$)","cadeira-extensora-unilateral"],["extensora","cadeira-extensora"],["mesa flexora|flexora deitad","mesa-flexora"],["flexora.*em pe","flexora-em-pe"],["flexora","cadeira-flexora"],["abdutor","cadeira-abdutora"],["adutor","cadeira-adutora"],
["hack","agachamento-hack"],["agachamento.*bulgaro","agachamento-bulgaro"],["agachamento.*goblet","agachamento-goblet"],["agachamento.*smith","agachamento-smith"],["agachamento sem peso","agachamento-peso-corpo"],["agachamento","agachamento-livre"],
["afundo sem peso","afundo-sem-peso"],["afundo","afundo-halteres"],["stiff.*maquina","stiff-maquina"],["stiff.*halter","stiff-halteres"],["stiff","stiff-barra"],["levantamento terra","levantamento-terra"],["elevacao pelvica","elevacao-pelvica"],["ponte de gluteo","ponte-gluteo"],
["crucifixo inverso|posterior.*halter","crucifixo-inverso"],["voador (reverso|inverso)|posterior.*voador","voador-inverso"],["posterior de ombro","posterior-polia-baixa"],["face ?pull","face-pull"],
["elevacao lateral.*(polia|cabo)","elevacao-lateral-polia"],["elevacao lateral","elevacao-lateral"],["elevacao frontal","elevacao-frontal"],
["desenvolvimento.*smith","desenvolvimento-smith"],["desenvolvimento.*(maquina|articulad)","desenvolvimento-maquina"],["desenvolvimento.*(militar|barra)","desenvolvimento-militar"],["desenvolvimento","desenvolvimento-halteres"],
["flexao pike","flexao-pike"],["flexao.*joelho","flexao-joelhos"],["flexao inclinada","flexao-inclinada"],["flexao","flexao"],
["supino.*inclinad.*halter","supino-inclinado-halteres"],["supino.*inclinad.*(maquina|articulad)","supino-inclinado-maquina"],["supino.*inclinad","supino-inclinado-barra"],["supino.*declinad","supino-declinado"],["supino.*halter","supino-reto-halteres"],["supino.*(maquina|articulad)","supino-reto-maquina"],["supino","supino-reto-barra"],
["voador|peck ?deck","voador-peito"],["crucifixo","crucifixo-halteres"],["cross.*baixa","crossover-baixa"],["cross","crossover-alta"],
["triceps.*(banco|mergulho)","triceps-banco"],["mergulho","mergulho"],["triceps.*frances|frances","triceps-frances"],["triceps testa","triceps-testa"],["triceps maquina","triceps-maquina"],["triceps.*invertid","triceps-invertida"],["triceps.*corda","triceps-corda"],["triceps.*(neutra|dois pegadores)","triceps-neutra"],["triceps.*barra w","triceps-barra-w"],["triceps.*barra","triceps-barra-reta"],["triceps.*(unilateral|na polia)","triceps-polia-unilateral"],["triceps","triceps-pulley"],
["pulldown","pulldown-corda"],["puxada.*triangulo","puxada-triangulo"],["puxada.*neutr","puxada-neutra"],["barra fixa assistida","barra-fixa-assistida"],["barra fixa","barra-fixa"],["puxada|pulley costas","puxada-aberta"],
["serrote|remada unilateral","remada-serrote"],["remada invertida","remada-invertida"],["remada.*elastico","remada-elastico"],["remada curvada.*halter","remada-curvada-halteres"],["remada curvada","remada-curvada-barra"],["remada.*pronada","remada-articulada-pronada"],["remada.*cabo","remada-baixa-cabo"],["remada","remada-baixa-articulada"],
["rosca martelo.*corda","rosca-martelo-corda"],["rosca martelo","rosca-martelo"],["rosca scott.*maquina","rosca-scott-maquina"],["rosca scott","rosca-scott"],["rosca inclinada","rosca-inclinada"],["rosca sentado","rosca-sentado"],["rosca alternada|rosca direta com halteres","rosca-alternada"],["rosca.*(polia|cabo)","rosca-polia-baixa"],["rosca.*(barra w|21)","rosca-barra-w"],["rosca","rosca-barra"],
];
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const achar=n=>{const x=norm(n);const r=R.find(p=>new RegExp(p[0]).test(x));return r?r[1]:null};
// conferencia: todo nome do historico e da biblioteca
const mapa=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));const bib=JSON.parse(fs.readFileSync(W+"/docs/metodos/biblioteca.json","utf8"));
const nomes=new Set(mapa.map(o=>o[1]));Object.entries(bib.grupos).forEach(([g,l])=>{if(g!=="Cardio")l.forEach(n=>nomes.add(n))});
const usados=new Set(R.map(r=>r[1]));const ex=fs.readFileSync(process.argv[4],"utf8").match(/reg\("([^"]+)"/g).map(x=>x.slice(5,-1));
console.log("exercicios:",ex.length,"sem regra:",ex.filter(e=>!usados.has(e)),"regra sem exercicio:",[...usados].filter(e=>!ex.includes(e)));
const out=[...nomes].sort().map(n=>[n,achar(n)]);console.log("sem desenho:",out.filter(o=>!o[1]).map(o=>o[0]));
fs.writeFileSync(path.dirname(process.argv[3])+"/mapa-desenhos.txt",out.map(o=>o[0].padEnd(56)+o[1]).join("\n"));
if(process.argv[5]==="aplicar"){
  const ip=W+"/docs/metodos/imagens.json";const j=JSON.parse(fs.readFileSync(ip,"utf8"));j.desenhos={fonte:"Desenhos próprios do Diário de Treino",base:"desenhos/",regras:R.map(r=>({rx:r[0],g:r[1]+".gif"}))};fs.writeFileSync(ip,JSON.stringify(j));
  const ed=(f,a,b)=>{const p=W+"/"+f;let s=fs.readFileSync(p,"utf8");const crlf=s.includes("\r\n");s=s.replace(/\r\n/g,"\n");if(!s.includes(a))throw new Error(f+" nao achei "+a.slice(0,70));s=s.split(a).join(b);fs.writeFileSync(p,crlf?s.replace(/\n/g,"\r\n"):s)};
  ed("docs/js/metodos.js",'imagens={base:j.base,regras:(j.regras||[]).map(r=>({rx:new RegExp(r.rx),img:r.img,en:r.en}))}','imagens={base:j.base,regras:(j.regras||[]).map(r=>({rx:new RegExp(r.rx),img:r.img,en:r.en})),desBase:(j.desenhos||{}).base||"",des:((j.desenhos||{}).regras||[]).map(r=>({rx:new RegExp(r.rx),g:r.g}))}');
  ed("docs/js/metodos.js",'// As duas fotos do exercício (posição inicial e final), ou null.\nfunction imagem(nome){if(!imagens)return null;const n=norm(nome);const r=','// O desenho animado do exercício (com o músculo pintado) ou, se não houver, as duas fotos. Null se não houver nada.\nfunction imagem(nome){if(!imagens)return null;const n=norm(nome);const d=imagens.des.find(x=>x.rx.test(n));if(d)return {fotos:[imagens.desBase+d.g],desenho:true};const r=');
  ed("docs/js/app.js",'<div class="foto-anim">\'+im.fotos.map(','<div class="foto-anim\'+(im.desenho?" des":"")+\'">\'+im.fotos.map(');
  ed("docs/js/app.js",'<p class="muted small">Imagens de referência do banco livre free-exercise-db. O aparelho da sua academia pode ser diferente.</p>','<p class="muted small">\'+(im.desenho?"O músculo mais trabalhado aparece em vermelho. O aparelho da sua academia pode ser diferente.":"Imagens de referência do banco livre free-exercise-db. O aparelho da sua academia pode ser diferente.")+\'</p>');
  ed("docs/css/app.css",'.foto-ov{position:fixed;','.foto-anim.des{aspect-ratio:1/1}.foto-anim.des img{object-fit:contain}\n.foto-ov{position:fixed;');
  ed("docs/js/app.js",'<img src="\'+esc(im.fotos[0])+\'" alt="" loading="lazy">\'+(im.fotos[1]?','<img src="\'+esc(im.fotos[0])+\'" alt="" loading="lazy"\'+(im.desenho?\' class="des"\':"")+\'>\'+(im.fotos[1]?');
  ed("docs/css/app.css",'.ex-foto .f2,.foto-anim .f2{animation','.ex-foto img.des{object-fit:contain}\n.ex-foto .f2,.foto-anim .f2{animation');
  console.log("aplicado");
}
