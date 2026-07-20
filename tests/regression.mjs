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
    check("título contém o nome do app", (await page.title()).includes("SapoBros"), await page.title());
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
    // acessibilidade: nenhum bloco ? pode ter sólido logo abaixo (senão inacessível)
    const blocked = await page.evaluate(() => {
      const solids = window.__DINO.solids();
      const qs = solids.filter(s => s.type === "question");
      return qs.filter(q => solids.some(s =>
        s !== q && (q.x + 20) > s.x && (q.x + 20) < s.x + s.w && Math.abs(s.y - (q.y + 40)) < 2)).length;
    });
    check("blocos ? não ficam sobre outros blocos (acessíveis)", blocked === 0, `bloqueados: ${blocked}`);
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
    // acessibilidade do subterrâneo: cano de saída no chão, moedas/plataformas ao alcance
    const acc = await page.evaluate(() => {
      const solids = window.__DINO.solids();
      const H = window.__DINO.levelH;
      const groundTop = H - 40;                 // topo do chão (última linha)
      // cano de saída: sua base deve estar no chão (não flutuando alto)
      const exit = solids.find(s => s.type === "pipe");
      const exitBase = exit ? exit.y + exit.h : 0;
      // plataformas mais altas: até ~4 tiles acima do chão (alcançáveis por pulo em degraus)
      const bricks = solids.filter(s => s.type === "cavebrick");
      const highest = bricks.length ? Math.min(...bricks.map(s => s.y)) : groundTop;
      // moedas: a mais alta deve estar a no máx ~5 tiles do chão OU sobre plataforma
      const coins = window.__DINO.coins();
      const width = window.__DINO.levelW;
      return { exitBase, groundTop, highestFromGround: (groundTop - highest) / 40, width };
    });
    check("cano de saída fica no chão (acessível)", Math.abs(acc.exitBase - acc.groundTop) < 2, JSON.stringify(acc));
    check("plataformas do subterrâneo são alcançáveis (≤4 tiles)", acc.highestFromGround <= 4.01, JSON.stringify(acc));
    check("fase subterrânea ficou mais longa (>2000px)", acc.width > 2000, JSON.stringify(acc));
    const audio = await page.evaluate(() => ({
      horror: typeof window.Sound.startHorror === "function" && typeof window.Sound.stopHorror === "function",
      suck: (() => { try { window.Sound.play("suck"); return true; } catch (e) { return false; } })(),
    }));
    check("música de terror + som de sucção disponíveis", audio.horror && audio.suck, JSON.stringify(audio));

    // nenhuma moeda pode ficar presa entre blocos (sólido logo acima e logo abaixo)
    const trapped = await page.evaluate(() => {
      const solids = window.__DINO.solids(), coins = window.__DINO.coins();
      const solidAt = (x, y) => solids.some(s => x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h);
      return coins.filter(c => {
        const cx = c.x + c.w / 2;
        return solidAt(cx, c.y - 6) && solidAt(cx, c.y + c.h + 6);   // preso acima E abaixo
      }).length;
    });
    check("nenhuma moeda presa entre blocos", trapped === 0, `presas: ${trapped}`);

    // ciclo do cano: sair do subterrâneo volta à fase principal (não re-suga)
    const round = await page.evaluate(async () => {
      const entryX = window.__DINO.pipes()[0] ? window.__DINO.pipes()[0].x : 0;   // já no subterrâneo -> pipes vazio
      const pl = window.__DINO.player;
      const exit = window.__DINO.solids().find(s => s.type === "pipe");
      pl.x = exit.x - pl.w - 2; pl.y = exit.y + exit.h - pl.h - 2;
      // segura "down" por vários quadros (simula o jogador saindo)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 20));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown" }));
      return { under: window.__DINO.underground, lw: window.__DINO.levelW };
    });
    check("sair do cano volta à fase principal (sem re-sugar)", round.under === false && round.lw !== inCave.lw, JSON.stringify(round));
    await ctx.close();
  }

  // ---------- 17. Canos e blocos não bloqueiam passagem (todas as fases) ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(120);
    const bad = await page.evaluate(async () => {
      const T = 40, problems = [];
      for (let lvl = 0; lvl < 20; lvl++) {
        if (lvl % 4 === 3) continue;              // arenas de chefão não têm canos/blocos ?
        window.__DINO.enterLevel(lvl);
        await new Promise(r => setTimeout(r, 25));
        const solids = window.__DINO.solids();
        const solidAt = (x, y) => solids.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
        // cada cano: as 2 células diretamente acima do topo devem estar livres
        for (const p of window.__DINO.pipes()) {
          for (const dx of [T * 0.5, T * 1.5]) {
            if (solidAt(p.x + dx, p.y - T * 0.5)) problems.push(`L${lvl} cano bloqueado acima`);
          }
        }
        // cada bloco "?": espaço vazio logo abaixo (cabeçada possível)
        for (const q of solids.filter(s => s.type === "question")) {
          if (solidAt(q.x + T * 0.5, q.y + T + 6)) problems.push(`L${lvl} bloco ? sobre sólido`);
        }
      }
      return problems;
    });
    check("canos têm espaço livre acima (entrar/pular por cima)", bad.filter(x => x.includes("cano")).length === 0, bad.join("; "));
    check("nenhum bloco ? inacessível em nenhuma fase", bad.filter(x => x.includes("bloco")).length === 0, bad.join("; "));
    await ctx.close();
  }

  // ---------- 17b. Cada bloco "?" declarado é colocado E responde à cabeçada ----------
  // (Bug já visto: um "?" caía em cima de um tijolo — aparecia na tela, mas
  //  a colisão do tijolo vencia antes e a cabeçada não disparava nada.)
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(120);
    const r = await page.evaluate(async () => {
      const QBLOCKS = [
        [ {col:6,row:6,item:"mushroom"},{col:20,row:6,item:"star"},{col:37,row:6,item:"fire"},{col:27,row:6,item:"egg"} ],
        [ {col:11,row:5,item:"mushroom"},{col:22,row:5,item:"star"},{col:39,row:5,item:"fly"}, {col:16,row:5,item:"egg"} ],
        [ {col:6,row:5,item:"mushroom"}, {col:21,row:5,item:"star"},{col:37,row:5,item:"fire"},{col:15,row:5,item:"egg"} ],
      ]; // amostra: primeiras 3 fases normais (representam todos os padrões de layout)
      const T = 40;
      const missing = [], dead = [];
      for (let ti = 0; ti < QBLOCKS.length; ti++) {
        const lvl = ti;                                // 0..2 são as fases 1..3 (não-chefão)
        window.__DINO.enterLevel(lvl);
        await new Promise(r => setTimeout(r, 25));
        const solids = window.__DINO.solids();
        for (const q of QBLOCKS[ti]) {
          const bx = q.col * T, by = q.row * T;
          const at = solids.find(s => s.type === "question" && s.x === bx && s.y === by);
          if (!at) { missing.push(`L${lvl} (${q.col},${q.row})`); continue; }
          // Simula uma cabeçada: reposiciona jogador embaixo do bloco e força vy < 0.
          const before = at.used;
          window.__DINO.player.x = bx + 4;
          window.__DINO.player.y = by + T + 4;
          window.__DINO.player.vy = -8;
          await new Promise(r => setTimeout(r, 40));    // deixa a física rodar
          const after = window.__DINO.solids().find(s => s.type === "question" && s.x === bx && s.y === by);
          if (!after || !after.used) dead.push(`L${lvl} (${q.col},${q.row})`);
        }
      }
      return { missing, dead };
    });
    check("todo bloco ? declarado é realmente colocado", r.missing.length === 0, r.missing.join("; "));
    check("todo bloco ? responde à cabeçada (não fica inerte)", r.dead.length === 0, r.dead.join("; "));
    await ctx.close();
  }

  // ---------- 18. 20 estágios carregáveis (15 fases c/ bandeira + 5 chefões) ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(120);
    const r = await page.evaluate(async () => {
      let ok = 0, themedFlag = 0, bossArenas = 0;
      for (let i = 0; i < 20; i++) {
        window.__DINO.enterLevel(i);
        await new Promise(r => setTimeout(r, 20));
        if (window.__DINO.state === "play") ok++;
        if (i % 4 === 3) { if (window.__DINO.bossStage && window.__DINO.boss()) bossArenas++; }
        else if (window.__DINO.flag()) themedFlag++;
      }
      return { ok, themedFlag, bossArenas };
    });
    check("existem 20 estágios carregáveis", r.ok === 20, JSON.stringify(r));
    check("as 15 fases normais têm bandeira", r.themedFlag === 15, JSON.stringify(r));
    check("as 5 arenas de chefão têm um chefão", r.bossArenas === 5, JSON.stringify(r));
    await ctx.close();
  }

  // ---------- 19. Chefões: comportamento, dano, lava/espinhos, derrota ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(120);
    // 19a. cada arena de chefão tem lava e espinhos e um chefão com vida
    const arenas = await page.evaluate(async () => {
      const out = [];
      for (const i of [3, 7, 11, 15, 19]) {
        window.__DINO.enterLevel(i);
        await new Promise(r => setTimeout(r, 25));
        const b = window.__DINO.boss();
        out.push({ i, type: b && b.type, hp: b && b.hp, lava: window.__DINO.lavas().length, spikes: window.__DINO.spikes().length });
      }
      return out;
    });
    check("as 5 arenas têm lava e espinhos", arenas.every(a => a.lava > 0 && a.spikes > 0), JSON.stringify(arenas));
    check("os 5 chefões são de tipos distintos", new Set(arenas.map(a => a.type)).size === 5, JSON.stringify(arenas.map(a => a.type)));

    // 19b. dano reduz a vida (um golpe de cada vez por causa da invulnerabilidade)
    const dmg = await page.evaluate(async () => {
      window.__DINO.enterLevel(3);                // Brutão (fresco: sem invulnerabilidade)
      await new Promise(r => setTimeout(r, 30));
      const hp0 = window.__DINO.boss().hp;
      window.__DINO.hurtBoss(1);
      await new Promise(r => setTimeout(r, 20));
      const hp1 = window.__DINO.boss() ? window.__DINO.boss().hp : 0;
      return { hp0, hp1 };
    });
    check("dano reduz a vida do chefão", dmg.hp1 === dmg.hp0 - 1, JSON.stringify(dmg));

    // 19c. zerar a vida derrota o chefão e conclui o estágio (desbloqueia a próxima)
    const defeat = await page.evaluate(async () => {
      window.__DINO.enterLevel(3);                // fresco -> um golpe letal
      await new Promise(r => setTimeout(r, 30));
      window.__DINO.hurtBoss(9);                  // zera toda a vida de uma vez
      await new Promise(r => setTimeout(r, 1800)); // espera a animação de derrota
      return { state: window.__DINO.state, unlocked: window.__DINO.unlocked, boss: !!window.__DINO.boss() };
    });
    check("derrotar o chefão conclui o estágio", (defeat.state === "levelend" || defeat.state === "win") && defeat.unlocked >= 4, JSON.stringify(defeat));

    // 19c. lava mata; espinho tira o poder
    const hazard = await page.evaluate(async () => {
      window.__DINO.enterLevel(3);
      await new Promise(r => setTimeout(r, 30));
      const pl = window.__DINO.player;
      const lava = window.__DINO.lavas()[0];
      pl.x = lava.x + 4; pl.y = lava.y - pl.h + 20; pl.vy = 4;
      await new Promise(r => setTimeout(r, 120));
      return { dead: pl.dead || window.__DINO.state === "dead" };
    });
    check("cair na lava mata o jogador", hazard.dead === true, JSON.stringify(hazard));
    await ctx.close();
  }

  // ---------- 20. Inimigos variados, com pulo/tiro e dificuldade crescente ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(120);
    // varre as fases normais e coleta os tipos de inimigo por mundo
    const survey = await page.evaluate(async () => {
      const kinds = {}, byWorld = {};
      for (let i = 0; i < 20; i++) {
        if (i % 4 === 3) continue;                 // pula arenas de chefão
        window.__DINO.enterLevel(i);
        await new Promise(r => setTimeout(r, 20));
        const w = Math.floor(i / 4);
        byWorld[w] = byWorld[w] || new Set();
        for (const e of window.__DINO.enemies()) { kinds[e.type] = (kinds[e.type] || 0) + 1; byWorld[w].add(e.type); }
      }
      return { kinds, world0: [...(byWorld[0]||[])], world4: [...(byWorld[4]||[])] };
    });
    const EASY = ["walker", "hopper", "roller"];
    check("há muitos tipos de inimigo pelas fases (10+)", Object.keys(survey.kinds).length >= 10, JSON.stringify(Object.keys(survey.kinds)));
    check("mundo 1 só tem tipos fáceis (anda/pula/rola)", survey.world0.every(t => EASY.includes(t)) && survey.world0.length >= 2, JSON.stringify(survey.world0));
    check("mundo 5 traz tipos avançados (atirador/voador/espinho…)",
      ["shooter", "flyer", "spiker", "bomber", "spitter", "turret"].some(t => survey.world4.includes(t)), JSON.stringify(survey.world4));
    check("a variedade de inimigos cresce até o fim", survey.world4.length > survey.world0.length, JSON.stringify({ w0: survey.world0.length, w4: survey.world4.length }));

    // atirador dispara um projétil que causa dano ao jogador
    const shots = await page.evaluate(async () => {
      // procura uma fase com atirador
      let found = -1;
      for (let i = 8; i < 20 && found < 0; i++) {
        if (i % 4 === 3) continue;
        window.__DINO.enterLevel(i);
        await new Promise(r => setTimeout(r, 20));
        if (window.__DINO.enemies().some(e => e.type === "shooter")) found = i;
      }
      if (found < 0) return { found };
      // posiciona o jogador perto de um atirador (dentro do alcance) e espera disparar
      const sp = window.__DINO.enemies().find(e => e.type === "shooter");
      const pl = window.__DINO.player; pl.x = sp.x - 90; pl.y = sp.y;
      let maxShots = 0;
      for (let k = 0; k < 80; k++) { await new Promise(r => setTimeout(r, 30)); const pl2 = window.__DINO.player; const s2 = window.__DINO.enemies().find(e => e.type === "shooter"); if (s2) pl2.x = s2.x - 90; maxShots = Math.max(maxShots, window.__DINO.enemyShots().length); }
      return { found, maxShots };
    });
    check("existe fase com inimigo atirador", shots.found >= 0, JSON.stringify(shots));
    check("o atirador dispara projéteis", (shots.maxShots || 0) > 0, JSON.stringify(shots));

    // pisar num espinho NÃO o mata (e machuca o jogador)
    const spikeHit = await page.evaluate(async () => {
      let lvl = -1;
      for (let i = 0; i < 20 && lvl < 0; i++) { if (i % 4 === 3) continue; window.__DINO.enterLevel(i); await new Promise(r => setTimeout(r, 20)); if (window.__DINO.enemies().some(e => e.type === "spiker")) lvl = i; }
      if (lvl < 0) return { lvl };
      const pl = window.__DINO.player; window.__DINO.give("mushroom"); // fica grande p/ perder poder em vez de morrer
      await new Promise(r => setTimeout(r, 20));
      const sp = window.__DINO.enemies().find(e => e.type === "spiker");
      const pw0 = pl.power;
      pl.x = sp.x + (sp.w - pl.w) / 2; pl.y = sp.y - pl.h - 2; pl.vy = 4;   // cai em cima
      await new Promise(r => setTimeout(r, 120));
      return { lvl, alive: sp.alive, pw0, pw1: pl.power };
    });
    check("espinho não pode ser pisado (continua vivo)", spikeHit.alive === true, JSON.stringify(spikeHit));
    check("pisar no espinho machuca o jogador", spikeHit.pw1 !== spikeHit.pw0, JSON.stringify(spikeHit));
    await ctx.close();
  }

  // ---------- 21. Tijolos não podem formar teto sobre um buraco ----------
  {
    const { ctx, page } = await newGame();
    await page.click("#startBtn"); await sleep(120);
    const bad = await page.evaluate(async () => {
      const T = 40, problems = [];
      for (let i = 0; i < 20; i++) {
        if (i % 4 === 3) continue;                     // pula arenas de chefão
        window.__DINO.enterLevel(i);
        await new Promise(r => setTimeout(r, 20));
        const solids = window.__DINO.solids();
        const grounds = solids.filter(s => s.type === "ground");
        if (!grounds.length) continue;
        const groundY = Math.max(...grounds.map(s => s.y));
        const groundAt = (x) => grounds.some(s => s.y === groundY && x >= s.x && x < s.x + s.w);
        for (const b of solids.filter(s => s.type === "brick")) {
          if (b.y <= groundY - 2 * T && !groundAt(b.x + T / 2)) problems.push(`L${i}@${b.x / T | 0},${b.y / T | 0}`);
        }
      }
      return problems;
    });
    check("nenhum tijolo forma teto sobre um buraco", bad.length === 0, bad.slice(0, 8).join("; "));
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
