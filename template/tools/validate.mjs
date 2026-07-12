#!/usr/bin/env node
/* ============================================================
   Validador de game.config.js
   ------------------------------------------------------------
   Aponta erros e avisos ANTES de rodar o jogo:
   • imagem/áudio referenciado que não existe no disco
   • comportamento (behavior) inválido de inimigo/chefão
   • letra usada no mapa sem entrada na legenda
   • legenda apontando para inimigo/chefão/power-up inexistente
   • fase sem início (P), sem fim (bandeira F nem chefão), etc.

   Uso:
     node tools/validate.mjs                 (valida ./game.config.js)
     node tools/validate.mjs examples/espaco.config.js
   Sai com código 1 se houver ERRO (bom para CI).
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");   // pasta template/
const cfgPath = resolve(ROOT, process.argv[2] || "game.config.js");

const ENEMY_BEHAVIORS = ["walker", "hopper", "roller", "jumper", "shooter", "lobber", "splitter", "charger", "drifter", "flyer", "diver", "zigzag", "turret", "spiker", "bomber", "spitter"];
const BOSS_BEHAVIORS = ["brute", "plant", "ghost", "mole", "dragon"];
const FIXED = new Set(["G", "B", "?", "P", "F", "L", "^", ".", " "]);
const POWER_EFFECTS = ["grow", "fire", "fly"];

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

// carrega a config num "window" falso
let CFG;
try {
  const src = readFileSync(cfgPath, "utf8");
  const sandbox = { window: {}, GAME_CONFIG: undefined };
  // eslint-disable-next-line no-new-func
  new Function("window", src + "\n;return window.GAME_CONFIG || GAME_CONFIG;")(sandbox.window);
  CFG = sandbox.window.GAME_CONFIG;
  if (!CFG) throw new Error("window.GAME_CONFIG não foi definido");
} catch (e) { console.error("✖ Não consegui ler a config:", e.message); process.exit(1); }

const assetExists = (rel) => !rel || existsSync(join(ROOT, rel));
const checkAsset = (rel, ctx) => { if (rel && !assetExists(rel)) warn(`${ctx}: arquivo não encontrado → ${rel}`); };

// players
(CFG.players || []).forEach((p, i) => {
  if (!p.image) warn(`players[${i}] (${p.name || i}) sem "image" (vai usar placeholder)`);
  checkAsset(p.image, `players[${i}]`);
  if (p.voice && !(CFG.voices || {})[p.voice]) err(`players[${i}] usa voice "${p.voice}" que não existe em voices{}`);
});
if (!(CFG.players || []).length) err(`Nenhum player definido em players[]`);

// enemies
for (const k in (CFG.enemies || {})) {
  const d = CFG.enemies[k];
  if (!ENEMY_BEHAVIORS.includes(d.behavior)) err(`enemies.${k}: behavior "${d.behavior}" inválido. Use: ${ENEMY_BEHAVIORS.join(", ")}`);
  checkAsset(d.image, `enemies.${k}`);
}
// bosses
for (const k in (CFG.bosses || {})) {
  const d = CFG.bosses[k];
  if (!BOSS_BEHAVIORS.includes(d.behavior)) err(`bosses.${k}: behavior "${d.behavior}" inválido. Use: ${BOSS_BEHAVIORS.join(", ")}`);
  if (!(d.hp > 0)) warn(`bosses.${k}: sem "hp" válido (assumirá 3)`);
  checkAsset(d.image, `bosses.${k}`);
}
// powerups
for (const k in (CFG.powerups || {})) {
  const d = CFG.powerups[k];
  if (d.effect && !POWER_EFFECTS.includes(d.effect)) warn(`powerups.${k}: effect "${d.effect}" desconhecido (use grow|fire|fly)`);
  checkAsset(d.image, `powerups.${k}`);
}
// voices / music
for (const k in (CFG.voices || {})) checkAsset(CFG.voices[k], `voices.${k}`);
for (const k in (CFG.music || {})) checkAsset(CFG.music[k], `music.${k}`);
// themes bg
for (const k in (CFG.themes || {})) checkAsset(CFG.themes[k].bgImage, `themes.${k}.bgImage`);
// voiceEvents
for (const ev in (CFG.voiceEvents || {})) {
  const v = CFG.voiceEvents[ev];
  if (v !== "@player" && !(CFG.voices || {})[v]) err(`voiceEvents.${ev} aponta para voz "${v}" que não existe`);
}

// legenda
const legend = CFG.legend || {};
for (const ch in legend) {
  const d = legend[ch];
  if (typeof d === "string") continue;   // aliases fixos raramente usados
  if (d.enemy && !(CFG.enemies || {})[d.enemy]) err(`legend["${ch}"] aponta para enemy "${d.enemy}" inexistente`);
  if (d.boss && !(CFG.bosses || {})[d.boss]) err(`legend["${ch}"] aponta para boss "${d.boss}" inexistente`);
  if (d.powerup && !(CFG.powerups || {})[d.powerup]) err(`legend["${ch}"] aponta para powerup "${d.powerup}" inexistente`);
}

// fases
(CFG.levels || []).forEach((L, i) => {
  const tag = `levels[${i}]`;
  if (!L.map) { err(`${tag}: sem "map"`); return; }
  if (L.theme && !(CFG.themes || {})[L.theme]) err(`${tag}: theme "${L.theme}" não existe em themes{}`);
  if (L.music && !(CFG.music || {})[L.music]) warn(`${tag}: music "${L.music}" não existe em music{}`);
  const rows = L.map.replace(/\n$/, "").split("\n");
  let hasSpawn = false, hasFlag = false, hasBoss = false;
  const seenBad = new Set();
  for (const row of rows) for (const ch of row) {
    if (FIXED.has(ch)) { if (ch === "P") hasSpawn = true; if (ch === "F") hasFlag = true; continue; }
    const d = legend[ch];
    if (!d) { if (!seenBad.has(ch)) { seenBad.add(ch); err(`${tag}: caractere "${ch}" no mapa sem entrada em legend{}`); } continue; }
    if (d.boss) hasBoss = true;
  }
  if (!hasSpawn) err(`${tag}: falta o ponto de início "P" no mapa`);
  if (!hasFlag && !hasBoss) warn(`${tag}: sem bandeira "F" nem chefão — a fase não teria como terminar`);
});
if (!(CFG.levels || []).length) err(`Nenhuma fase definida em levels[]`);

// relatório
const rel = cfgPath.replace(ROOT + "/", "");
console.log(`\nValidando: ${rel}`);
warns.forEach(w => console.log("  ⚠  " + w));
errors.forEach(e => console.log("  ✖  " + e));
if (!errors.length && !warns.length) console.log("  ✓  tudo certo!");
console.log(`\n${errors.length} erro(s), ${warns.length} aviso(s).`);
process.exit(errors.length ? 1 : 0);
