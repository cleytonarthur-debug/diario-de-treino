// Troca a versão do app nos 3 lugares de uma vez, antes de publicar (git push).
// Uso: node tools/versao.mjs 2.4.1 "O que mudou 1" "O que mudou 2"
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [versao, ...notas] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(versao || "")) { console.error("Informe a versão, ex.: node tools/versao.mjs 2.4.1 \"nota\""); process.exit(1); }
const docs = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const hoje = new Date();
const data = String(hoje.getDate()).padStart(2, "0") + "/" + String(hoje.getMonth() + 1).padStart(2, "0") + "/" + hoje.getFullYear();

// 1) versao.json (o que o servidor anuncia)
writeFileSync(join(docs, "versao.json"), JSON.stringify({ versao, data, notas }, null, 2) + "\n");
// 2) versão que vai dentro do app
const at = join(docs, "js", "atualizacao.js");
writeFileSync(at, readFileSync(at, "utf8")
  .replace(/const VERSAO="[^"]*";/, `const VERSAO="${versao}";`)
  .replace(/const DATA="[^"]*";/, `const DATA="${data}";`));
// 3) nome do cache do service worker (força o celular a baixar os arquivos novos)
const sw = join(docs, "sw.js");
writeFileSync(sw, readFileSync(sw, "utf8").replace(/const CACHE = "[^"]*";/, `const CACHE = "diario-de-treino-${versao}";`));
// 4) versão de teste: mesma tela do app (teste.html) e mesmo programa central (demo-motor.js)
const raiz = join(docs, "..");
const code = readFileSync(join(raiz, "backend", "Code.gs"), "utf8").replace(/const PROF_PLANILHA = '[^']*'/, "const PROF_PLANILHA = 'SSMASTER'");
writeFileSync(join(docs, "js", "demo-motor.js"), "/* Gerado por tools/versao.mjs a partir de backend/Code.gs. Não editar. */\n" +
  "self.criarMotor=function(g){const {console,SpreadsheetApp,DriveApp,PropertiesService,LockService,CacheService,Utilities,UrlFetchApp,ContentService}=g;\n" + code +
  "\nreturn {doPost,salvarAluno_,escreverAluno_,abrirPlanilhaAluno_,gravarAvaliacao_,catalogo_,lerMetodos_,aprovarMetodo_};};\n");
writeFileSync(join(docs, "teste.html"), readFileSync(join(docs, "index.html"), "utf8")
  .replace(/<link rel="manifest"[^>]*>\r?\n/, "")
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">\n<script src="js/demo.js"></script>')
  .replace("<title>Diário de Treino</title>", "<title>Diário de Treino (teste)</title>"));
console.log("Versão " + versao + " (" + data + ") gravada em versao.json, atualizacao.js e sw.js.");
