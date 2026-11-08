/* Nomes padronizados dos exercícios.
   Tira a marca da máquina do nome (ela vai para o campo Máquina), arruma a grafia e mantém o lado (D ou E).
   Ex.: "Leg Press 45° vtom" vira "Leg press 45°" com máquina "Vtom". */
window.Nomes=(function(){
"use strict";
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[°º]/g," ").replace(/\s+/g," ").trim();
const MARCAS=[[/\b(cimerian|simeriam|simerian|cimeriam)\b/,"Cimerian"],[/\b(vtox|vtom|vton|vox)\b/,"VTOX"],
  [/\blife ?fitness?\b|\blifefitnes+\b/,"Life Fitness"],[/\bdeep fitness\b/,"Deep Fitness"],[/\bduck stronger\b/,"Duck Stronger"],[/\bcybergym\b/,"Cybergym"],
  [/\bxtrack\b/,"Xtrack"],[/\bhammer strength\b/,"Hammer Strength"],[/\btechnogym\b/,"Technogym"],[/\bmatrix\b/,"Matrix"],[/\bmovement\b/,"Movement"],[/\bconquer\b/,"Conquer"],[/\bwellness\b/,"Wellness"]];
// Comentários que foram parar no nome. Saem do nome (o comentário certo é a observação do treino).
const RUIDO=[/\bera o q[uy]?e tinha.*$/,/\bnao tem maquina aqui\b/,/\bpesadinha ela\b/,/\be a que tava livre\b/,/\bacademia (rex|de \w+)\b/,/\bsmart ?fit\b.*$/,/\bblack bull\b/,/\bvc sabe.*$/,/\b\d+ ?vs ?\d+\b/,/\bambos os lados.*$/];
function marcaDe(n){for(const [rx,nome] of MARCAS)if(rx.test(n))return nome;return ""}
function ladoDe(n){
  if(/^(direito|direita)\b/.test(n)||/(\blado d|\b(d|direito|direita|doreita))$/.test(n))return "D";
  if(/^(esquerdo|esquerda)\b/.test(n)||/(\blado e|\b(e|esquerdo|esquerda))$/.test(n))return "E";
  return "";
}
// [teste, nome padrão, aceita lado]. A ordem importa: o mais específico vem antes.
const R=[
  [/panturrilha|\bpantu\b|^(cimerian|simeriam|vtom|vton) 45\b/,n=>/sentad/.test(n)?"Panturrilha sentado":/alonga|esticando|extensao|isometria/.test(n)?"Panturrilha no leg press 45° isometria":/em pe\b/.test(n)?"Panturrilha em pé":"Panturrilha no leg press 45°",true],
  [/leg ?press|^leg unilateral/,n=>/180/.test(n)?"Leg press 180°":/horizontal/.test(n)?"Leg press horizontal":/articulad/.test(n)?"Leg press articulado":"Leg press 45°",true],
  [/extensora/,(n,l)=>"Cadeira extensora"+(l?" unilateral":"")+(/parcial/.test(n)?" parcial":"")+(/drop/.test(n)?" drop":""),true],
  [/mesa flexora|flexora deitad/,"Mesa flexora",true],
  [/flexora.*\bem pe\b|flexora em pe/,"Flexora em pé unilateral",true],
  [/flexora/,"Cadeira flexora",true],
  [/abdutor/,"Cadeira abdutora"],[/adutor/,"Cadeira adutora"],
  [/hack/,"Agachamento hack"],[/agachamento.*smith/,"Agachamento no Smith"],
  [/stiff/,n=>/maquina/.test(n)?"Stiff máquina":"Stiff"],
  [/\babs\b|abdom/,n=>/maquina/.test(n)?"Abdominal máquina":"Abdominal no banco"],
  [/prancha/,"Prancha"],
  [/posterior de ombro.*halter|crucifixo inverso.*halter/,"Crucifixo inverso com halteres no banco inclinado"],
  [/voador (reverso|inverso)|posterior de ombro.*voador/,"Voador inverso"],
  [/posterior de ombro.*(cross|polia|cabo)/,"Posterior de ombro na polia baixa",true],
  [/voador|peck ?deck/,"Voador peito"],
  [/face ?pull/,"Face pull na corda"],
  [/elevacao lateral/,n=>/polia|cabo/.test(n)?"Elevação lateral na polia unilateral":"Elevação lateral com halteres",true],
  [/desenvolvimento/,n=>/smith/.test(n)?"Desenvolvimento no Smith":/maquina|articulad/.test(n)?"Desenvolvimento máquina":/militar/.test(n)?"Desenvolvimento militar com barra":"Desenvolvimento com halteres sentado"],
  [/supino/,n=>/inclinad/.test(n)?(/halter/.test(n)?"Supino inclinado com halteres":/maquina|articulad/.test(n)?"Supino inclinado máquina":"Supino inclinado com barra"):/declinad/.test(n)?"Supino declinado":/maquina|articulad/.test(n)?"Supino reto máquina":/halter/.test(n)?"Supino reto com halteres":"Supino reto com barra"],
  [/cross ?(over)?.*polia alta|cross ?polia alta/,"Crossover polia alta"],
  [/cross ?(over)?.*polia baixa|cross ?polia baixa/,"Crossover polia baixa"],
  [/mergulho/,"Mergulho nas paralelas"],
  [/triceps frances|frances halter/,"Tríceps francês com halter"],
  [/(polia triceps|triceps.*polia) unilateral|polia triceps/,"Tríceps na polia unilateral"],
  [/triceps.*invertid/,"Tríceps pulley pegada invertida"],
  [/triceps.*corda/,"Tríceps pulley corda"],
  [/triceps.*(neutra|dois pegadores)/,"Tríceps pulley pegada neutra"],
  [/triceps.*(barra w|pronada)/,"Tríceps pulley barra W"],
  [/triceps.*barra reta|^triceps barra$/,"Tríceps pulley barra reta"],
  [/triceps (maquina|pulley)$/,"Tríceps pulley"],
  [/pulldown/,"Pulldown na corda"],
  [/(pulley|puxada).*triangulo/,"Puxada com triângulo"],
  [/(pulley|puxada).*neutr/,"Puxada neutra fechada"],
  [/(pulley|puxada)/,"Puxada alta pronada aberta"],
  [/serrote/,"Remada serrote",true],
  [/remada curvada/,n=>/halter/.test(n)?"Remada curvada com halteres":"Remada curvada com barra"],
  [/remada guiada|remada.*pronada aberta/,"Remada articulada pronada aberta"],
  [/remada articulada.*neutra/,"Remada articulada pegada neutra"],
  [/remada (baixa )?articulada/,n=>"Remada baixa articulada"+(ladoDe(n)?" unilateral":""),true],
  [/biceps.*polia|rosca.*polia/,"Rosca direta na polia baixa"],
  [/barra w aquecimento|aquecimento.*barra w/,"Rosca direta barra W aquecimento"],
  [/rosca 21/,"Rosca 21 barra W"],
  [/scott/,n=>/maquina/.test(n)?"Rosca Scott máquina":"Rosca Scott unilateral",true],
  [/rosca martelo/,n=>/corda/.test(n)?"Rosca martelo na corda":/unilateral/.test(n)?"Rosca martelo unilateral":"Rosca martelo com halteres",true],
  [/rosca alternada/,"Rosca alternada com halteres"],
  [/rosca.*(sentad|90)/,"Rosca sentado no banco 90°"],
  [/rosca.*inclinad/,"Rosca inclinada unilateral",true],
  [/rosca (direta|barra|completa)|rosca.*barra w/,"Rosca direta barra W"],
];
const tirarLado=n=>n.replace(/^(direito|direita|esquerdo|esquerda)\s+/,"").replace(/\s+(lado\s+)?(d|e|direito|direita|doreita|esquerdo|esquerda)$/,"");
// {nome, maquina, mudou}. Se não reconhece, devolve o nome como está (só sem a marca, quando tiver).
function padronizar(original){
  const orig=String(original||"").replace(/\s+/g," ").trim();let n=norm(orig).replace(/\b(d|e) drop$/,"drop $1");
  const maquina=marcaDe(n);
  for(const [rx] of MARCAS)n=n.replace(rx," ");RUIDO.forEach(rx=>{n=n.replace(rx," ")});n=n.replace(/\s+/g," ").trim();const lado=ladoDe(n);
  const sem=tirarLado(n);
  for(const [rx,f,aceita] of R){
    if(!rx.test(sem)&&!rx.test(norm(orig)))continue;
    let nome=typeof f==="function"?f(sem,lado):f;
    if(lado&&aceita){if(!/unilateral/.test(norm(nome))&&!/^(posterior|remada serrote)/.test(norm(nome)))nome+=" unilateral";nome+=" "+lado}
    return {nome,maquina,mudou:nome!==orig};
  }
  if(!maquina)return {nome:orig,maquina:"",mudou:false};
  // marca reconhecida, exercício não: só tira a marca e arruma a primeira letra
  let s=orig;for(const [rx] of MARCAS)s=s.replace(new RegExp(rx.source.replace(/\\b/g,"\\b"),"i")," ");s=s.replace(/\s+/g," ").trim();
  s=s.charAt(0).toUpperCase()+s.slice(1);return {nome:s,maquina,mudou:s!==orig};
}
return {padronizar,marcaDe:n=>marcaDe(norm(n))};
})();
