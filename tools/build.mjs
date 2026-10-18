// Copia para docs/ o Chart.js, as fontes e gera os ícones. Rodar depois de `npm install`.
import { cpSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");
const nm = join(root, "node_modules");
for (const d of ["vendor", "fonts", "icons"]) mkdirSync(join(docs, d), { recursive: true });

cpSync(join(nm, "chart.js", "dist", "chart.umd.js"), join(docs, "vendor", "chart.umd.js"));

const fonts = [["Barlow", "barlow", [400, 500, 600, 700]], ["Barlow Condensed", "barlow-condensed", [500, 600, 700]]];
const ranges = {
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
};
let css = "";
for (const [family, id, weights] of fonts) for (const w of weights) for (const subset of Object.keys(ranges)) {
  const file = `${id}-${subset}-${w}-normal.woff2`;
  const src = join(nm, "@fontsource", id, "files", file);
  if (!existsSync(src)) throw new Error("Fonte não encontrada: " + src);
  cpSync(src, join(docs, "fonts", file));
  css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format("woff2");unicode-range:${ranges[subset]}}\n`;
}
writeFileSync(join(docs, "fonts", "fonts.css"), css);

// Ícones: primeiro plano (tools/icon.svg) sobre fundo azul-escuro.
const fg = readFileSync(join(root, "tools", "icon.svg"));
const BG = "#0f1b2d";
async function icon(size, inset, round, out) {
  const inner = Math.round(size * inset);
  const fgPng = await sharp(fg, { density: 600 }).resize(inner, inner).png().toBuffer();
  const r = round ? Math.round(size * 0.2) : 0;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/></svg>`);
  await sharp(bg).composite([{ input: fgPng, gravity: "center" }]).png().toFile(join(docs, "icons", out));
}
await icon(192, 0.8, true, "icon-192.png");
await icon(512, 0.8, true, "icon-512.png");
await icon(512, 0.6, false, "icon-maskable-512.png");
await icon(180, 0.74, false, "apple-touch-icon.png");
console.log("docs/ pronto");
