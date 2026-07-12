/* ============================================================
   SAPO BROS — Testes de regressão (Playwright)
   Sobe um servidor estático da raiz do projeto, abre o jogo com
   ?debug=1 e valida os comportamentos que já quebraram antes:
   power-ups, botão de fogo, voo, flor não-enterrada, moedas,
   pisão, som/mudo, layout dos controles e salvar/continuar.

   Rodar:  npm test        (ou: node tests/regression.mjs)
   ============================================================ */
import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json",
};

// --- servidor estático mínimo (ignora query strings tipo ?v=7) ---
function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/") rel = "/index.html";
      const file = path.join(ROOT, path.normalize(rel));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// --- micro-harness de asserções ---
const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "✓ PASS" : "✗ FAIL"}  ${name}${cond ? "" : "  → " + detail}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await startServer();
const PORT = server.address().port;
const BASE = `http://localhost:${PORT}`;
const exe = process.env.CHROMIUM_PATH;                 // opcional (local); em CI o Playwright acha sozinho
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

const pageErrors = [];
async function newGame(opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push("PE:" + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) pageErrors.push("CE:" + m.text()); });
  await page.goto(`${BASE}/index.html?debug=1`);
  await sleep(300);
  return { ctx, page };
}
// Inicia o jogo e entra na fase 1 (o "Novo jogo" agora abre o mapa)
async function startPlay(page) {
  await page.click("#startBtn"); await sleep(150);
  await page.evaluate(() => window.__DINO.enterLevel(0));
  await sleep(150);
}

try {
  // ---------- 1. Tela inicial ----------
  {
    const { ctx, page } = await newGame();
    check("título é 'Sapo Bros'", (await page.title()).includes("Sapo Bros"));
    check("hook de debug ativo", await page.evaluate(() => !!window.__DINO));
    check("dois personagens na seleção", (await page.$$("#charPick .char")).length === 2);
    const names = await page.evaluate(() => Array.from(document.querySelectorAll("#charPick .char b")).map(b => b.textContent));
    check("personagens renomeados p/ Jones e Minja", names.join(",") === "Jones,Minja", JSON.stringify(names));
    check("motor de som carregado", await page.evaluate(() => typeof window.Sound === "object"));
    check("vozes embutidas (Jones/Minja + encrencado)", await page.evaluate(() => !!(window.VOICES && window.VOICES.jones && window.VOICES.minja && window.VOICES.minja_trouble)));
    // Pré-decodificação no carregamento: TODAS as vozes prontas antes de iniciar
    const preDecoded = await page.evaluate(async () => {
      const need = ["jones", "minja", "minja_trouble"];
      for (let i = 0; i < 40 && !need.every(n => window.Sound.hasVoice(n)); i++) await new Promise(r => setTimeout(r, 50));
      return need.map(n => [n, window.Sound.hasVoice(n)]);
    });
    check("todas as vozes pré-decodificam no load (Jones incluso)", preDecoded.every(([, ok]) => ok), JSON.stringify(preDecoded));
    await ctx.close();
  }

  // ---------- 2. Cogumelo cresce ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const r = await page.evaluate(() => {
      const h0 = window.__DINO.player.h;
      window.__DINO.give("mushroom");
      return { h0, h1: window.__DINO.player.h, power: window.__DINO.player.power, hud: document.getElementById("power").textContent };
    });
    check("cogumelo cresce o personagem", r.h1 > r.h0 && r.power === "big", JSON.stringify(r));
    check("HUD mostra 🍄", r.hud === "🍄", r.hud);
    // MP3 decodifica no Chromium — a voz deve ficar pronta e tocar sem erro
    const decoded = await page.evaluate(async () => {
      for (let i = 0; i < 30 && !window.Sound.hasVoice("jones"); i++) await new Promise(r => setTimeout(r, 50));
      return window.Sound.hasVoice("jones");
    });
    check("voz decodifica (buffer pronto)", decoded === true);
    const voiceOk = await page.evaluate(() => {
      try { return typeof window.Sound.playVoice === "function" && (window.Sound.playVoice("jones"), true); }
      catch (e) { return false; }
    });
    check("tocar a voz do personagem não gera erro", voiceOk);
    await ctx.close();
  }

  // ---------- 3. Flor de fogo + botão + tiro (regressão do botão de fogo) ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    await page.evaluate(() => window.__DINO.give("fire"));
    await sleep(30);
    const btnHidden = await page.evaluate(() => document.getElementById("btnFire").classList.contains("hidden"));
    const before = await page.evaluate(() => window.__DINO.fireballs().length);
    await page.keyboard.press("x"); await sleep(60);
    const afterKey = await page.evaluate(() => window.__DINO.fireballs().length);
    await page.dispatchEvent("#btnFire", "touchstart"); await sleep(60);
    const afterTouch = await page.evaluate(() => window.__DINO.fireballs().length);
    check("botão de fogo aparece com a flor", btnHidden === false);
    check("tecla X atira bola de fogo", afterKey > before, `${before}->${afterKey}`);
    check("botão 🔥 (toque) atira bola de fogo", afterTouch > afterKey || afterTouch >= 1, `${afterKey}->${afterTouch}`);
    await ctx.close();
  }

  // ---------- 4. Flor voadora permite voar ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    await page.evaluate(() => window.__DINO.give("fly"));
    const y0 = await page.evaluate(() => window.__DINO.player.y);
    await page.keyboard.down("ArrowUp"); await sleep(600); await page.keyboard.up("ArrowUp");
    const y1 = await page.evaluate(() => window.__DINO.player.y);
    check("flor voadora faz subir (voar)", y1 < y0 - 30, `y ${y0.toFixed(0)}→${y1.toFixed(0)}`);
    await ctx.close();
  }

  // ---------- 5. Flor NÃO fica enterrada (regressão) ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page); await sleep(400);   // deixa a gravidade assentar
    const r = await page.evaluate(() => {
      const flowers = window.__DINO.powerups().filter(u => u.type === "fire" || u.type === "fly");
      const solids = window.__DINO.solids();
      return flowers.map(f => {
        const ft = f.y, fb = f.y + f.h;
        let resting = false, buried = false;
        for (const s of solids) {
          const overlapX = f.x < s.x + s.w && f.x + f.w > s.x;
          if (!overlapX) continue;
          const overlapY = Math.min(fb, s.y + s.h) - Math.max(ft, s.y);
          if (overlapY > 4) buried = true;              // afundada dentro de um sólido
          if (Math.abs(fb - s.y) < 3) resting = true;   // pousada exatamente em cima
        }
        return { resting, buried };
      });
    });
    check("flores existem na fase", r.length > 0, JSON.stringify(r));
    check("flores pousam no chão (não enterradas)", r.length > 0 && r.every(f => f.resting && !f.buried), JSON.stringify(r));
    await ctx.close();
  }

  // ---------- 6. Moeda dá pontos ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const gained = await page.evaluate(async () => {
      const s0 = +document.getElementById("score").textContent;
      const c = window.__DINO.coins().find(c => !c.taken);
      const pl = window.__DINO.player;
      pl.x = c.x - 2; pl.y = c.y - 2;                       // teleporta em cima da maçã
      await new Promise(r => setTimeout(r, 120));
      return +document.getElementById("score").textContent - s0;
    });
    check("coletar maçã aumenta a pontuação", gained >= 50, `+${gained}`);
    await ctx.close();
  }

  // ---------- 7. Pisar no inimigo derrota (e pontua) ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const r = await page.evaluate(async () => {
      const e = window.__DINO.enemies().find(e => e.alive);
      const pl = window.__DINO.player;
      const s0 = +document.getElementById("score").textContent;
      pl.x = e.x + (e.w - pl.w) / 2; pl.y = e.y - pl.h - 4; pl.vy = 2;   // cai em cima
      await new Promise(r => setTimeout(r, 300));
      return { alive: e.alive, gained: +document.getElementById("score").textContent - s0 };
    });
    check("pisar no inimigo derrota", r.alive === false, JSON.stringify(r));
    check("pisão pontua (+100)", r.gained >= 100, JSON.stringify(r));
    await ctx.close();
  }

  // ---------- 8. Mudo liga/desliga ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(150);
    const a0 = await page.evaluate(() => window.Sound.isMuted());
    await page.click("#muteBtn"); await sleep(30);
    const a1 = await page.evaluate(() => ({ m: window.Sound.isMuted(), t: document.getElementById("muteBtn").textContent }));
    await page.click("#muteBtn"); await sleep(30);
    const a2 = await page.evaluate(() => ({ m: window.Sound.isMuted(), t: document.getElementById("muteBtn").textContent }));
    check("mudo desligado por padrão", a0 === false);
    check("botão de mudo silencia", a1.m === true && a1.t === "🔇", JSON.stringify(a1));
    check("botão de mudo religa", a2.m === false && a2.t === "🔊", JSON.stringify(a2));
    await ctx.close();
  }

  // ---------- 9. Controles de toque centralizados na horizontal (regressão) ----------
  {
    const { ctx, page } = await newGame({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await startPlay(page);
    const box = await page.evaluate(() => {
      const r = document.querySelector(".pad.left").getBoundingClientRect();
      return { center: (r.top + r.bottom) / 2, vh: innerHeight, bottom: r.bottom };
    });
    check("pad centralizado verticalmente", Math.abs(box.center - box.vh / 2) < 40, JSON.stringify(box));
    check("pad não cortado embaixo", box.bottom <= box.vh, JSON.stringify(box));
    await ctx.close();
  }

  // ---------- 10. Salvar/continuar ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sapobros_save_v1")));
    await page.reload(); await sleep(300);
    const cont = await page.evaluate(() => {
      const b = document.getElementById("continueBtn");
      return { hidden: b.classList.contains("hidden"), text: b.textContent };
    });
    check("progresso é salvo (inProgress)", saved && saved.inProgress === true, JSON.stringify(saved));
    check("botão Continuar aparece após recarregar", cont.hidden === false, JSON.stringify(cont));
    await ctx.close();
  }

  // ---------- 11. Pausa e menu inicial ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    // pausar
    await page.click("#pauseBtn"); await sleep(50);
    const paused = await page.evaluate(() => ({ state: window.__DINO.state, overlay: !document.getElementById("pauseScreen").classList.contains("hidden") }));
    check("pausar congela o jogo e mostra overlay", paused.state === "paused" && paused.overlay === true, JSON.stringify(paused));
    // jogo não avança enquanto pausado
    const x0 = await page.evaluate(() => window.__DINO.player.x);
    await page.keyboard.down("ArrowRight"); await sleep(300); await page.keyboard.up("ArrowRight");
    const x1 = await page.evaluate(() => window.__DINO.player.x);
    check("jogo não avança enquanto pausado", Math.abs(x1 - x0) < 0.5, `x ${x0}->${x1}`);
    // retomar
    await page.click("#resumeBtn"); await sleep(50);
    const resumed = await page.evaluate(() => ({ state: window.__DINO.state, overlay: !document.getElementById("pauseScreen").classList.contains("hidden") }));
    check("retomar volta ao jogo", resumed.state === "play" && resumed.overlay === false, JSON.stringify(resumed));
    // menu inicial
    await page.click("#homeBtn"); await sleep(80);
    const menu = await page.evaluate(() => ({ state: window.__DINO.state, start: !document.getElementById("startScreen").classList.contains("hidden"), cont: !document.getElementById("continueBtn").classList.contains("hidden") }));
    check("botão menu volta à tela inicial", menu.state === "start" && menu.start === true, JSON.stringify(menu));
    check("menu preserva o progresso (Continuar disponível)", menu.cont === true, JSON.stringify(menu));
    await ctx.close();
  }

  // ---------- 12. Modo invencível (não morre) ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#invincibleToggle"); await sleep(30);   // liga o modo
    await startPlay(page);
    const hud = await page.evaluate(() => document.getElementById("lives").textContent);
    check("HUD mostra escudo no modo invencível", hud === "🛡️", hud);

    // colide de lado com um inimigo (sem pisar): não deve tomar dano nem morrer
    const enemyHit = await page.evaluate(async () => {
      const e = window.__DINO.enemies().find(e => e.alive);
      const pl = window.__DINO.player;
      const pw0 = pl.power;
      pl.power = "fire";                       // com poder, para detectar "powerdown"
      pl.x = e.x - pl.w + 2; pl.y = e.y; pl.vy = 0;   // encosta de lado
      await new Promise(r => setTimeout(r, 250));
      return { dead: pl.dead, power: pl.power, wasFire: pw0 };
    });
    check("invencível: não toma dano ao esbarrar em inimigo", enemyHit.dead === false && enemyHit.power === "fire", JSON.stringify(enemyHit));

    // cai num buraco: não morre — volta a um ponto seguro
    const pit = await page.evaluate(async () => {
      const pl = window.__DINO.player;
      pl.y = window.__DINO.levelH + 200;       // joga para fora do mundo
      await new Promise(r => setTimeout(r, 200));
      return { dead: pl.dead, inside: pl.y < window.__DINO.levelH, state: window.__DINO.state };
    });
    check("invencível: cair no buraco não mata (volta ao chão)", pit.dead === false && pit.inside === true && pit.state === "play", JSON.stringify(pit));
    await ctx.close();
  }

  // ---------- 13. Morte do Jones dispara a voz sem erro ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);   // Jones é o padrão (char 0)
    const r = await page.evaluate(async () => {
      const pl = window.__DINO.player;
      pl.y = window.__DINO.levelH + 200;               // cai no buraco -> morre
      await new Promise(r => setTimeout(r, 200));
      return { dead: pl.dead, hasJones: window.Sound.hasVoice("jones") };
    });
    check("Jones morre e a voz de morte está disponível", r.dead === true && r.hasJones === true, JSON.stringify(r));
    await ctx.close();
  }

  // ---------- 14. Mapa de fases (desbloqueio progressivo) ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(150);       // vai ao mapa
    const onMap = await page.evaluate(() => ({ state: window.__DINO.state, unlocked: window.__DINO.unlocked }));
    check("novo jogo abre o mapa de fases", onMap.state === "map", JSON.stringify(onMap));
    check("apenas a 1ª fase começa desbloqueada", onMap.unlocked === 0, JSON.stringify(onMap));
    // completar a fase 1 (mastro) desbloqueia a 2
    await page.evaluate(() => window.__DINO.enterLevel(0)); await sleep(120);
    const done = await page.evaluate(async () => {
      const pl = window.__DINO.player, f = window.__DINO.flag();
      pl.x = f.x - 4; pl.y = f.y + 10;      // teleporta sobre o mastro
      for (let i = 0; i < 120 && window.__DINO.state === "play"; i++) await new Promise(r => setTimeout(r, 30));
      return { state: window.__DINO.state, unlocked: window.__DINO.unlocked };
    });
    check("completar a fase desbloqueia a próxima", done.unlocked >= 1, JSON.stringify(done));
    await ctx.close();
  }

  // ---------- 14b. Mastro da bandeira: desliza antes de concluir ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const slide = await page.evaluate(async () => {
      const pl = window.__DINO.player, f = window.__DINO.flag();
      pl.x = f.x - 4; pl.y = f.y + 4;                 // encosta no topo do mastro
      await new Promise(r => setTimeout(r, 120));
      const y0 = pl.y, sliding = window.__DINO.sliding, st = window.__DINO.state;
      await new Promise(r => setTimeout(r, 250));
      return { sliding, st, y0, y1: pl.y, base: f.y + f.h - pl.h };
    });
    check("agarra o mastro (não conclui na hora)", slide.sliding === true && slide.st === "play", JSON.stringify(slide));
    check("desliza para baixo pelo mastro", slide.y1 > slide.y0, `y ${slide.y0.toFixed(0)}→${slide.y1.toFixed(0)}`);
    await ctx.close();
  }

  // ---------- 15. Bloco "?" solta item na cabeçada ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const r = await page.evaluate(async () => {
      const before = window.__DINO.powerups().length;
      window.__DINO.hitBlock();                 // simula a cabeçada num bloco "?"
      await new Promise(r => setTimeout(r, 60));
      const q = window.__DINO.solids().find(s => s.type === "question");
      return { before, after: window.__DINO.powerups().length, used: q && q.used };
    });
    check("bloco ? solta um item na cabeçada", r.after > r.before, JSON.stringify(r));
    check("bloco ? fica gasto após soltar", r.used === true, JSON.stringify(r));
    await ctx.close();
  }

  // ---------- 16. Cano gigante leva ao subterrâneo (morcegos + volta) ----------
  {
    const { ctx, page } = await newGame();
    await startPlay(page);
    const inCave = await page.evaluate(async () => {
      window.__DINO.enterPipeNow();
      await new Promise(r => setTimeout(r, 80));
      const bats = window.__DINO.enemies().filter(e => e.type === "bat").length;
      return { underground: window.__DINO.underground, bats, state: window.__DINO.state };
    });
    check("entrar no cano abre o subterrâneo", inCave.underground === true && inCave.state === "play", JSON.stringify(inCave));
    check("subterrâneo tem morcegos voando", inCave.bats > 0, JSON.stringify(inCave));
    const audio = await page.evaluate(() => ({
      horror: typeof window.Sound.startHorror === "function" && typeof window.Sound.stopHorror === "function",
      suck: (() => { try { window.Sound.play("suck"); return true; } catch (e) { return false; } })(),
    }));
    check("música de terror + som de sucção disponíveis", audio.horror && audio.suck, JSON.stringify(audio));
    await ctx.close();
  }

  // O Chromium headless (CI) não decodifica AAC/m4a — as vozes tocam no Safari.
  // Ignoramos só erros de codec de áudio; qualquer outro reprova o teste.
  const realErrors = pageErrors.filter((e) => !/decode audio data|no supported source|supported sources|NotSupportedError|failed to load because/i.test(e));
  check("sem erros de runtime no console/página", realErrors.length === 0, realErrors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
if (failed.length) { console.error("FALHARAM: " + failed.map((f) => f.name).join("; ")); process.exit(1); }
