/* ============================================================
   MOTOR DE PLATAFORMA — TEMPLATE DIRIGIDO POR CONFIGURAÇÃO
   ------------------------------------------------------------
   Este arquivo é o "engine". Você NÃO precisa editá-lo.
   Para criar um jogo novo, edite apenas `game.config.js`
   (imagens, vozes, músicas, inimigos, chefões, fases e os
   COMPORTAMENTOS por nome). O engine lê essa config e monta tudo.

   Se uma imagem/áudio faltar, o engine desenha um "placeholder"
   colorido no lugar — então dá para rodar antes de ter a arte.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.GAME_CONFIG;
  const $ = (id) => document.getElementById(id);
  if (!CFG) { document.body.innerHTML = "<p style='color:#fff;font-family:sans-serif;padding:20px'>Falta o game.config.js (window.GAME_CONFIG).</p>"; return; }

  // ---------- Motor / tela ----------
  const V = CFG.view || {};
  const W = V.width || 800, H = V.height || 450, TILE = V.tile || 40;
  const GRAVITY = V.gravity ?? 0.62, MOVE = V.moveAccel ?? 0.8, FRICTION = V.friction ?? 0.82;
  const MAX_VX = V.maxSpeed ?? 4.6, JUMP_VY = V.jumpSpeed ?? -12.4, POWER_JUMP = V.powerJumpSpeed ?? -14.6;
  const START_LIVES = CFG.lives ?? 3;
  const canvas = $("game"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ---------- Carregamento de imagens (com placeholder) ----------
  const IMAGES = {};
  function img(url) {
    if (!url) return null;
    if (IMAGES[url]) return IMAGES[url];
    const im = new Image();
    im._ok = false; im.onload = () => { im._ok = true; }; im.onerror = () => { im._err = true; };
    im.src = url; IMAGES[url] = im; return im;
  }
  // desenha um sprite (imagem) ou um placeholder colorido com "carinha"
  function sprite(im, x, y, w, h, opt) {
    opt = opt || {};
    if (im && im._ok) {
      ctx.save();
      if (opt.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); }
      else ctx.drawImage(im, x, y, w, h);
      ctx.restore();
      return;
    }
    // placeholder
    const c = opt.color || "#8e44ad";
    roundRect(x, y, w, h, Math.min(8, w / 4)); ctx.fillStyle = c; ctx.fill();
    ctx.fillStyle = "#fff";
    const ey = y + h * 0.4, ex = w * 0.22;
    ctx.beginPath(); ctx.arc(x + w / 2 - ex, ey, Math.max(3, w * 0.11), 0, 7); ctx.arc(x + w / 2 + ex, ey, Math.max(3, w * 0.11), 0, 7); ctx.fill();
    ctx.fillStyle = "#000";
    const look = opt.flip ? -2 : 2;
    ctx.beginPath(); ctx.arc(x + w / 2 - ex + look, ey, Math.max(1.5, w * 0.05), 0, 7); ctx.arc(x + w / 2 + ex + look, ey, Math.max(1.5, w * 0.05), 0, 7); ctx.fill();
    if (opt.label) { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText(opt.label, x + w / 2, y + h - 3); ctx.textAlign = "start"; }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- Áudio (músicas + vozes fornecidas; SFX sintetizado) ----------
  let muted = false, curMusic = null;
  function playMusic(url) {
    if (curMusic) { curMusic.pause(); curMusic = null; }
    if (!url || muted) return;
    try { const a = new Audio(url); a.loop = true; a.volume = 0.5; a.play().catch(() => {}); curMusic = a; } catch (e) {}
  }
  function stopMusic() { if (curMusic) { curMusic.pause(); curMusic = null; } }
  function playVoice(id) {
    if (muted || !CFG.voices || !CFG.voices[id]) return;
    try { const a = new Audio(CFG.voices[id]); a.volume = 0.9; a.play().catch(() => {}); } catch (e) {}
  }
  // SFX curtinho via WebAudio (não precisa de arquivo)
  let AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function beep(freq, dur, type, vol) {
    if (muted) return; const a = ac(); if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.value = vol || 0.06; o.connect(g); g.connect(a.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + (dur || 0.1)); o.stop(a.currentTime + (dur || 0.1));
    } catch (e) {}
  }
  const SFX = {
    jump: () => beep(520, 0.12, "square"), coin: () => beep(880, 0.09, "sine"),
    stomp: () => beep(240, 0.1, "square"), shoot: () => beep(400, 0.08, "sawtooth"),
    hit: () => beep(160, 0.18, "square"), power: () => beep(660, 0.18, "triangle"),
    die: () => beep(120, 0.5, "sawtooth"), win: () => beep(700, 0.4, "triangle"), bump: () => beep(200, 0.08, "square"),
  };

  // ---------- Estado ----------
  let state = "start";          // start | play | dead | levelcomplete | win | gameover
  let levelIdx = 0, score = 0, lives = START_LIVES, chosen = 0;
  let solids, coins, enemies, enemyShots, powerups, fireballs, particles, hazardsLava, hazardsSpike, boss, bossShots, flag;
  let levelW, levelH, cameraX, tick, underground, curTheme;
  const keys = { left: false, right: false, up: false, upHeld: false, down: false, fire: false };
  const players = CFG.players || [{ id: "p1", name: "Player", w: 30, h: 38 }];
  const player = { x: 0, y: 0, w: 30, h: 38, vx: 0, vy: 0, onGround: false, face: 1, dead: false, deadT: 0, power: "small", invuln: 0, fireCd: 0, spawnX: 0, spawnY: 0, walk: 0 };

  // pré-carrega imagens
  players.forEach(p => p._img = img(p.image));
  for (const k in (CFG.enemies || {})) CFG.enemies[k]._img = img(CFG.enemies[k].image);
  for (const k in (CFG.bosses || {})) CFG.bosses[k]._img = img(CFG.bosses[k].image);
  for (const k in (CFG.powerups || {})) CFG.powerups[k]._img = img(CFG.powerups[k].image);
  for (const k in (CFG.themes || {})) if (CFG.themes[k].bgImage) CFG.themes[k]._bg = img(CFG.themes[k].bgImage);

  // ---------- Legenda dos mapas ----------
  const LEGEND = Object.assign({
    "G": "ground", "B": "brick", "?": "coin", "P": "spawn", "F": "flag", "L": "lava", "^": "spike", ".": "empty", " ": "empty",
  }, CFG.legend || {});

  // Mapa de fases (trilha) + vidas infinitas (opcionais)
  const worldMapOn = CFG.worldMap !== false && (CFG.levels || []).length > 1;
  let infinite = !!CFG.infiniteLives, unlocked = 0, mapSel = 0;
  const LEVEL_IS_BOSS = (CFG.levels || []).map(L => (L.map || "").split("").some(ch => LEGEND[ch] && LEGEND[ch].boss));
  const MAP_NODES = buildMapNodes((CFG.levels || []).length);

  function sizeFor(power) { const b = players[chosen]; const w = b.w || 30, h = b.h || 38; return power === "small" ? { w, h: Math.round(h * 0.72) } : { w, h }; }

  // ---------- Construção de fase ----------
  function buildLevel(idx) {
    const L = CFG.levels[idx];
    solids = []; coins = []; enemies = []; enemyShots = []; powerups = []; fireballs = []; particles = [];
    hazardsLava = []; hazardsSpike = []; boss = null; bossShots = []; flag = null;
    underground = !!L.underground; curTheme = L.theme || Object.keys(CFG.themes || { def: 1 })[0];
    const map = L.map.replace(/\n$/, "").split("\n");
    levelH = map.length * TILE; levelW = (Math.max(...map.map(r => r.length))) * TILE;
    let eIdx = 0;
    for (let r = 0; r < map.length; r++) for (let c = 0; c < map[r].length; c++) {
      const ch = map[r][c]; if (ch === "." || ch === " ") continue;
      const x = c * TILE, y = r * TILE, def = LEGEND[ch];
      if (def === "ground" || def === "brick") solids.push({ x, y, w: TILE, h: TILE, type: def });
      else if (def === "coin") coins.push({ x: x + 10, y: y + 8, w: 20, h: 24, taken: false, ph: Math.random() * 6.28 });
      else if (def === "spawn") { player.spawnX = x; player.spawnY = y; }
      else if (def === "flag") flag = { x: x + 16, y: y - TILE * 2, w: 8, h: TILE * 3 };
      else if (def === "lava") hazardsLava.push({ x, y: y + 10, w: TILE, h: TILE - 10 });
      else if (def === "spike") hazardsSpike.push({ x, y, w: TILE, h: TILE });
      else if (def && def.enemy) enemies.push(makeEnemy(def.enemy, x, y, idx, eIdx++));
      else if (def && def.powerup) spawnPowerup(def.powerup, x, y);
      else if (def && def.boss) boss = makeBoss(def.boss, x, y);
    }
    respawn(false); cameraX = 0; tick = 0;
    playMusic(CFG.music && (L.music ? CFG.music[L.music] : CFG.music[curTheme]));
  }
  function respawn(resetPower) {
    if (resetPower) player.power = "small";
    const s = sizeFor(player.power); player.w = s.w; player.h = s.h;
    player.x = player.spawnX; player.y = player.spawnY; player.vx = 0; player.vy = 0;
    player.dead = false; player.deadT = 0; player.invuln = 0; player.onGround = false; fireballs = [];
  }

  // ============================================================
  //  CATÁLOGO DE COMPORTAMENTOS DE INIMIGO  (referenciados por nome)
  //  walker hopper roller jumper shooter lobber splitter charger
  //  drifter flyer diver zigzag turret spiker bomber spitter
  // ============================================================
  function makeEnemy(key, x, y, idx, eIdx) {
    const d = (CFG.enemies || {})[key] || {};
    const beh = d.behavior || "walker";
    const mul = 1 + idx * 0.03, dir = (eIdx % 2 === 0) ? -1 : 1;
    const gy = y + 6;
    const e = { key, beh, x: x + 4, y: gy, w: d.w || 32, h: d.h || 32, vx: 0, vy: 0, alive: true, squash: 0, t: (eIdx * 17) % 60, _img: d._img, color: d.color };
    const sp = (d.speed || 1) * mul;
    switch (beh) {
      case "hopper": Object.assign(e, { vx: dir * 0.7 * sp, jump: true, jumpEvery: d.jumpEvery || 46, jumpVy: -7 }); break;
      case "roller": Object.assign(e, { vx: dir * 1.9 * sp, roller: true }); break;
      case "jumper": Object.assign(e, { vx: dir * 0.8 * sp, jump: true, chase: true, jumpEvery: d.jumpEvery || 100, jumpVy: -10 }); break;
      case "shooter": Object.assign(e, { vx: dir * 0.5 * sp, shoot: true, shootEvery: d.shootEvery || 120, shotSpeed: d.shotSpeed || 3, scd: 60 }); break;
      case "lobber": Object.assign(e, { lob: true, shootEvery: d.shootEvery || 120, scd: 60 }); break;
      case "splitter": Object.assign(e, { vx: dir * 0.8 * sp, split: true }); break;
      case "charger": Object.assign(e, { vx: dir * 0.7 * sp, patrolVx: dir * 0.7 * sp, charger: true, range: d.range || 220, cd: 60, charge: 0 }); break;
      case "drifter": Object.assign(e, { fly: true, hover: true }); break;
      case "flyer": Object.assign(e, { y: gy - TILE * 2, baseY: gy - TILE * 2, vx: dir * 1.3 * sp, fly: true, ph: Math.random() * 6.28, amp: 24 }); break;
      case "diver": Object.assign(e, { y: gy - TILE * 3, baseY: gy - TILE * 3, vx: dir * 1.2 * sp, fly: true, diver: true, phase: "cruise", amp: 14 }); break;
      case "zigzag": Object.assign(e, { y: gy - TILE * 2, baseY: gy - TILE * 2, vx: dir * 1.4 * sp, fly: true, zig: true }); break;
      case "turret": Object.assign(e, { spiky: true, shoot: true, shootEvery: d.shootEvery || 110, shotSpeed: d.shotSpeed || 3.4, scd: 50 }); break;
      case "spiker": Object.assign(e, { vx: dir * 0.8 * sp, spiky: true }); break;
      case "bomber": Object.assign(e, { y: gy - TILE * 3, baseY: gy - TILE * 3, vx: dir * 1.5 * sp, fly: true, bomber: true, amp: 10, scd: 70, shootEvery: d.shootEvery || 90 }); break;
      case "spitter": Object.assign(e, { spread: true, shootEvery: d.shootEvery || 130, scd: 80 }); break;
      default: e.vx = dir * 0.9 * sp;            // walker
    }
    return e;
  }
  function updateEnemies() {
    const p = player, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, floorTop = levelH - TILE;
    for (const e of enemies) {
      if (!e.alive) { e.squash = Math.max(0, e.squash - 1); continue; }
      e.t++;
      if (e.fly) enemyFly(e, pcx, pcy, floorTop); else enemyGround(e, pcx);
      if (e.shoot || e.lob || e.spread) {
        e.scd--; if (e.scd <= 0 && Math.abs(pcx - (e.x + e.w / 2)) < 380) {
          if (e.lob) shoot(e, "bomb", 0); else if (e.spread) shoot(e, "spread"); else shoot(e, "bolt", e.shotSpeed);
          e.scd = e.shootEvery;
        }
      }
      if (overlap(p, e) && !p.dead) {
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 20;
        if (stomping && !e.spiky) { e.alive = false; e.squash = 16; p.vy = JUMP_VY * 0.62; score += 100; pop(e.x + e.w / 2, e.y + e.h / 2); SFX.stomp(); if (e.split) split(e); }
        else hurtPlayer();
      }
    }
    enemies = enemies.filter(e => e.alive || e.squash > 0);
  }
  function enemyGround(e, pcx) {
    e.vy += GRAVITY; if (e.vy > 14) e.vy = 14;
    if (e.charger) {
      if (e.charge > 0) { e.charge--; if (e.charge === 0) e.vx = e.patrolVx; }
      else if (e.grounded && (e.cd = (e.cd || 0) - 1) <= 0 && Math.abs(pcx - (e.x + e.w / 2)) < e.range) { e.charge = 42; e.cd = 130; e.vx = (pcx < e.x + e.w / 2 ? -1 : 1) * 4.6; }
    }
    e.x += e.vx;
    for (const s of solids) if (overlap(e, s)) { e.x = e.vx > 0 ? s.x - e.w : s.x + s.w; e.vx *= -1; }
    e.y += e.vy; let grounded = false;
    for (const s of solids) if (overlap(e, s)) { if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; grounded = true; } else { e.y = s.y + s.h; e.vy = 0; } }
    e.grounded = grounded;
    if (e.jump && grounded && e.t % (e.jumpEvery || 100) === 0) { e.vy = e.jumpVy || -9.5; if (e.chase) e.vx = Math.abs(e.vx || 0.8) * (pcx < e.x + e.w / 2 ? -1 : 1); }
    if (grounded && e.vy === 0 && !e.roller && !(e.charger && e.charge > 0)) {
      const ax = e.vx > 0 ? e.x + e.w + 2 : e.x - 2, fy = e.y + e.h + 4;
      let floor = false; for (const s of solids) if (ax >= s.x && ax <= s.x + s.w && fy >= s.y && fy <= s.y + s.h) { floor = true; break; }
      if (!floor && e.vx) e.vx *= -1;
    }
    if (e.y > levelH + 80) e.alive = false;
  }
  function enemyFly(e, pcx, pcy, floorTop) {
    if (e.hover) { const dx = pcx - (e.x + e.w / 2), dy = pcy - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1; e.x += dx / d * 1.15; e.y += dy / d * 0.95; }
    else if (e.diver) {
      e.x += e.vx; edgeReflect(e);
      if (e.phase === "cruise") { e.y = e.baseY + Math.sin(e.t * 0.08) * e.amp; if (e.t % 150 === 120 && Math.abs(pcx - (e.x + e.w / 2)) < 180) { e.phase = "dive"; e.dy = 2; } }
      else if (e.phase === "dive") { e.dy += 0.55; e.y += e.dy; if (e.y >= floorTop - e.h - 2) { e.y = floorTop - e.h - 2; e.phase = "rise"; } }
      else { e.y -= 3; if (e.y <= e.baseY) { e.y = e.baseY; e.phase = "cruise"; } }
    } else if (e.zig) { e.x += e.vx; edgeReflect(e); e.y = e.baseY + (Math.abs(((e.t * 0.05) % 2) - 1) * 2 - 1) * 22; }
    else {
      e.ph = (e.ph || 0) + 0.08; e.x += e.vx; edgeReflect(e); e.y = e.baseY + Math.sin(e.ph) * (e.amp || 26);
      if (e.bomber) { e.scd--; if (e.scd <= 0 && Math.abs(pcx - (e.x + e.w / 2)) < 130) { shoot(e, "bomb", 0, true); e.scd = e.shootEvery; } }
    }
    e.x = Math.max(TILE, Math.min(e.x, levelW - TILE - e.w));
    if (e.hover) e.y = Math.max(TILE, Math.min(e.y, floorTop - e.h + 8));
  }
  function edgeReflect(e) { if (e.x < TILE) { e.x = TILE; e.vx = Math.abs(e.vx); } if (e.x + e.w > levelW - TILE) { e.x = levelW - TILE - e.w; e.vx = -Math.abs(e.vx); } }
  function split(e) { for (const dd of [-1, 1]) enemies.push({ key: e.key, beh: "walker", x: e.x + e.w / 2 - 10, y: e.y, w: 20, h: 20, vx: dd * 1.7, vy: -3, alive: true, squash: 0, t: 0, _img: e._img, color: e.color }); }
  function shoot(e, kind, spd, down) {
    const ox = e.x + e.w / 2, dir = player.x + player.w / 2 < ox ? -1 : 1;
    if (kind === "spread") { for (const a of [-0.5, 0, 0.5]) enemyShots.push({ x: ox - 7, y: e.y + 2, w: 14, h: 14, vx: Math.sin(a) * 3.2, vy: -4.6 + Math.abs(a) * 0.6, kind: "bolt" }); }
    else if (kind === "bomb") enemyShots.push({ x: ox - 8, y: down ? e.y + e.h : e.y, w: 16, h: 16, vx: down ? 0 : dir * 2.2, vy: down ? 0.6 : -6.4, kind: "bomb" });
    else enemyShots.push({ x: ox - 7, y: e.y + e.h * 0.3, w: 14, h: 14, vx: dir * (spd || 3), vy: -0.6, kind: "bolt" });
    SFX.shoot();
  }
  function updateEnemyShots() {
    for (const s of enemyShots) { s.vy += 0.18; s.x += s.vx; s.y += s.vy;
      for (const so of solids) if (overlap(s, so)) { s.dead = true; break; }
      if (s.x < -30 || s.x > levelW + 30 || s.y > levelH + 40) s.dead = true;
      if (!s.dead && !player.dead && overlap(player, s)) { s.dead = true; hurtPlayer(); }
    }
    enemyShots = enemyShots.filter(s => !s.dead);
  }

  // ============================================================
  //  CATÁLOGO DE COMPORTAMENTOS DE CHEFÃO
  //  brute (investe) · plant (sobe e cospe) · ghost (persegue de costas)
  //  mole (cava e salta) · dragon (pula, fogo, martelo) — o final
  // ============================================================
  function makeBoss(key, x, y) {
    const d = (CFG.bosses || {})[key] || {};
    const beh = d.behavior || "brute";
    const floorTop = levelH - TILE, w = d.w || 62, h = d.h || 60;
    const b = { key, beh, w, h, hp: d.hp || 3, maxHp: d.hp || 3, x: x + TILE / 2 - w / 2, y: floorTop - h, vx: 0, vy: 0, face: -1, t: 0, phase: "idle", pcd: 0, hitFlash: 0, invT: 0, dying: false, dieT: 0, frozen: false, floorTop, homeY: floorTop - h, _img: d._img, color: d.color || "#b03048", name: d.name || key };
    if (beh === "plant") { b.phase = "down"; b.y = floorTop + 6; }
    if (beh === "mole") { b.phase = "under"; b.y = floorTop + 6; }
    return b;
  }
  function bossGround(b) {
    b.vy += GRAVITY; if (b.vy > 14) b.vy = 14; b.x += b.vx;
    for (const s of solids) if (overlap(b, s)) { b.x = b.vx > 0 ? s.x - b.w : s.x + s.w; b.vx *= -1; b.face *= -1; }
    b.y += b.vy; b.onFloor = false;
    for (const s of solids) if (overlap(b, s)) { if (b.vy > 0) { b.y = s.y - b.h; b.vy = 0; b.onFloor = true; } else { b.y = s.y + s.h; b.vy = 0; } }
    if (b.onFloor) { const ax = b.vx > 0 ? b.x + b.w + 2 : b.x - 2, fy = b.y + b.h + 4;
      const solid = solids.some(s => ax >= s.x && ax <= s.x + s.w && fy >= s.y && fy <= s.y + s.h);
      const lava = hazardsLava.some(L => ax >= L.x && ax <= L.x + L.w);
      if (!solid || lava) { b.vx *= -1; b.face *= -1; } }
  }
  function updateBoss() {
    const b = boss; if (!b) return; const p = player, pcx = p.x + p.w / 2;
    b.t++; if (b.hitFlash > 0) b.hitFlash--; if (b.invT > 0) b.invT--;
    if (b.dying) { b.dieT++; b.y -= 1.2; if (b.dieT > 80) { boss = null; levelComplete(); } return; }
    switch (b.beh) {
      case "brute":
        if (b.phase === "idle") { b.phase = "patrol"; b.vx = (b.x + b.w / 2 > pcx ? -1 : 1) * 1.4; }
        if (b.phase === "patrol") { if (!b.vx) b.vx = 1.4; bossGround(b); if (b.t % 200 === 190) { b.phase = "windup"; b.pcd = 26; b.vx = 0; b.face = pcx < b.x + b.w / 2 ? -1 : 1; } }
        else if (b.phase === "windup") { b.vx = 0; bossGround(b); if (--b.pcd <= 0) { b.phase = "charge"; b.pcd = 44; b.vx = b.face * 4.6; } }
        else if (b.phase === "charge") { bossGround(b); if (--b.pcd <= 0) { b.phase = "patrol"; b.vx = b.face * 1.4; } }
        break;
      case "plant":
        if (b.phase === "down") { b.y = b.floorTop + 6; if (b.t % 150 === 130) b.phase = "rise"; }
        else if (b.phase === "rise") { b.y -= 3; if (b.y <= b.homeY) { b.y = b.homeY; b.phase = "up"; b.pcd = 48; } }
        else if (b.phase === "up") { if (--b.pcd <= 0) { b.phase = "spit"; b.pcd = 38; b.shotDone = false; } }
        else if (b.phase === "spit") { if (!b.shotDone && b.pcd < 20) { b.shotDone = true; bossSpit(); } if (--b.pcd <= 0) b.phase = "retract"; }
        else { b.y += 3; if (b.y >= b.floorTop + 6) { b.y = b.floorTop + 6; b.phase = "down"; b.t -= b.t % 150; } }
        break;
      case "ghost": {
        const bcx = b.x + b.w / 2; b.frozen = ((bcx > pcx) === (p.face === 1));
        if (b.frozen) { b.vx *= 0.7; b.vy *= 0.7; }
        else { const dx = pcx - bcx, dy = (p.y + p.h / 2) - (b.y + b.h / 2), d = Math.hypot(dx, dy) || 1; b.vx = dx / d * 1.5; b.vy = dy / d; }
        b.x += b.vx; b.y += b.vy + Math.sin(b.t * 0.08) * 0.4;
        b.x = Math.max(TILE, Math.min(b.x, levelW - TILE - b.w)); b.y = Math.max(TILE, Math.min(b.y, b.floorTop - b.h + 10)); break;
      }
      case "mole":
        if (b.phase === "under") { b.y = b.floorTop + 6; b.x += (pcx > b.x + b.w / 2 ? 1 : -1) * 1.7; b.x = Math.max(TILE, Math.min(b.x, levelW - TILE - b.w)); if (b.t % 150 === 130) { b.phase = "pop"; b.vy = -12; } }
        else if (b.phase === "pop") { b.vy += GRAVITY; b.y += b.vy; if (b.y >= b.floorTop - b.h) { b.y = b.floorTop - b.h; b.vy = 0; b.phase = "out"; b.pcd = 44; } }
        else { if (--b.pcd <= 0) { b.phase = "under"; b.t -= b.t % 150; } }
        break;
      case "dragon":
        bossGround(b); if (b.onFloor) b.vx = (pcx < b.x + b.w / 2 ? -0.5 : 0.5);
        if (b.onFloor && b.t % 150 === 140) b.vy = -11;
        if (b.t % 110 === 60) bossFire(); if (b.t % 200 === 120) bossHammer(); break;
    }
    bossHitPlayer();
  }
  function bossStompable(b) { return b.beh === "plant" ? (b.phase === "up" || b.phase === "rise") : b.beh === "ghost" ? b.frozen : b.beh === "mole" ? (b.phase === "pop" || b.phase === "out") : true; }
  function bossFireVulnerable(b) { return b.beh === "ghost" ? b.frozen : b.beh === "plant" ? (b.phase !== "down" && b.phase !== "retract") : b.beh === "mole" ? (b.phase === "pop" || b.phase === "out") : true; }
  function bossHurt(n) { const b = boss; if (!b || b.invT > 0 || b.dying) return false; b.hp -= n; b.hitFlash = 12; b.invT = 45; SFX.bump(); if (b.hp <= 0) { b.dying = true; b.dieT = 0; SFX.stomp(); score += 2000; } return true; }
  function bossHitPlayer() { const b = boss, p = player; if (!b || b.dying || p.dead || !overlap(p, b)) return; const stomping = p.vy > 0 && (p.y + p.h) - b.y < 26; if (stomping && bossStompable(b)) { p.vy = JUMP_VY * 0.72; bossHurt(1); } else hurtPlayer(); }
  function bossSpit() { const b = boss, ox = b.x + b.w / 2, dir = player.x > b.x ? 1 : -1; for (const a of [-1, 0, 1]) bossShots.push({ x: ox - 8, y: b.y + 4, w: 16, h: 16, vx: dir * 2.2 + a * 0.9, vy: -4 - Math.abs(a) * 0.6, kind: "seed" }); SFX.shoot(); }
  function bossFire() { const b = boss, dir = player.x + player.w / 2 < b.x + b.w / 2 ? -1 : 1, oy = b.y + b.h * 0.42; for (let i = 0; i < 3; i++) bossShots.push({ x: b.x + b.w / 2, y: oy, w: 22, h: 15, vx: dir * (3 + i * 0.6), vy: (i - 1) * 0.35, kind: "fire", life: 120, g: 0 }); SFX.shoot(); }
  function bossHammer() { const b = boss, dir = player.x + player.w / 2 < b.x + b.w / 2 ? -1 : 1; bossShots.push({ x: b.x + b.w / 2, y: b.y + 4, w: 16, h: 16, vx: dir * 2.4, vy: -6, kind: "hammer", spin: 0 }); SFX.shoot(); }
  function updateBossShots() {
    for (const s of bossShots) { s.t = (s.t || 0) + 1; s.vy += (s.g == null ? 0.22 : s.g); s.x += s.vx; s.y += s.vy; if (s.kind === "hammer") s.spin = (s.spin || 0) + 0.4;
      if (s.kind !== "fire" && s.y + s.h >= levelH - TILE) s.dead = true;
      if (s.x < -30 || s.x > levelW + 30 || s.y > levelH + 40) s.dead = true; if (s.life && s.t > s.life) s.dead = true;
      if (!s.dead && !player.dead && overlap(player, s)) { s.dead = true; hurtPlayer(); }
    }
    bossShots = bossShots.filter(s => !s.dead);
  }

  // ---------- Power-ups / tiro do jogador ----------
  function spawnPowerup(key, x, y) {
    const d = (CFG.powerups || {})[key] || {}; const effect = d.effect || key;
    powerups.push({ key, effect, x: x + 6, y: y + 6, w: 28, h: 28, vx: effect === "grow" ? 1.1 : 0, vy: 0, taken: false, _img: d._img, color: d.color || "#e63b2e" });
  }
  function updatePowerups() {
    for (const it of powerups) { if (it.taken) continue;
      it.vy += GRAVITY; if (it.vy > 12) it.vy = 12; it.x += it.vx; it.y += it.vy;
      for (const s of solids) if (overlap(it, s)) { if (it.vy > 0) { it.y = s.y - it.h; it.vy = 0; } else if (it.vy < 0) { it.y = s.y + s.h; it.vy = 0; } if (it.vx) { it.x = it.vx > 0 ? s.x - it.w : s.x + s.w; it.vx *= -1; } }
      if (overlap(player, it)) { it.taken = true; applyPower(it.effect); SFX.power(); voiceEvent("powerup"); }
    }
    powerups = powerups.filter(it => !it.taken);
  }
  function applyPower(effect) { if (effect === "grow" && player.power === "small") setPower("big"); else if (effect === "fire") setPower("fire"); else if (effect === "fly") setPower("fly"); else if (player.power === "small") setPower("big"); score += 50; }
  function setPower(np) { const foot = player.y + player.h; player.power = np; const s = sizeFor(np); player.w = s.w; player.h = s.h; player.y = foot - player.h; }
  function shootFire() { const dir = player.face; fireballs.push({ x: player.x + (dir > 0 ? player.w : -12), y: player.y + player.h * 0.35, w: 12, h: 12, vx: dir * 6.2, vy: -1.5 }); SFX.shoot(); }
  function updateFireballs() {
    for (const f of fireballs) { if (f.dead) continue; f.vy += 0.4; f.x += f.vx;
      for (const s of solids) if (overlap(f, s)) { f.dead = true; break; }
      f.y += f.vy; for (const s of solids) if (overlap(f, s)) { if (f.vy > 0) { f.y = s.y - f.h; f.vy = -5.2; } else { f.y = s.y + s.h; f.vy = 0; } }
      if (f.x < 0 || f.x > levelW || f.y > levelH + 40) f.dead = true;
      if (!f.dead && boss && !boss.dying && bossFireVulnerable(boss) && overlap(f, boss)) { f.dead = true; bossHurt(1); }
      if (!f.dead) for (const e of enemies) if (e.alive && overlap(f, e)) { e.alive = false; e.squash = 16; score += 150; pop(e.x + e.w / 2, e.y + e.h / 2); f.dead = true; break; }
    }
    fireballs = fireballs.filter(f => !f.dead);
  }

  // ---------- Dano / morte ----------
  function hurtPlayer() { const p = player; if (p.invuln > 0 || p.dead) return; voiceEvent("hurt"); if (p.power !== "small") { setPower("small"); p.invuln = 100; p.vy = -6; SFX.hit(); } else killPlayer(); }
  function killPlayer() { if (player.dead) return; player.dead = true; player.deadT = 0; player.vy = -9; stopMusic(); SFX.die(); voiceEvent("die"); }
  function loseLife() {
    if (infinite) { respawn(true); state = "play"; playMusic(CFG.music && CFG.music[curTheme]); return; }
    lives--; if (lives <= 0) { state = "gameover"; showMsg("💀 Fim de jogo", "Pontuação: " + score, "🔁 Recomeçar"); }
    else { respawn(true); state = "play"; playMusic(CFG.music && CFG.music[curTheme]); }
  }
  function voiceEvent(ev) { const map = CFG.voiceEvents || {}; if (map[ev]) playVoice(map[ev] === "@player" ? players[chosen].voice : map[ev]); }

  function levelComplete() {
    stopMusic(); SFX.win();
    unlocked = Math.max(unlocked, Math.min(levelIdx + 1, CFG.levels.length - 1));
    if (levelIdx + 1 >= CFG.levels.length) { state = "win"; showMsg("🏆 Você venceu!", "Pontuação final: " + score, "🔁 Jogar de novo"); }
    else { state = "levelcomplete"; showMsg("✔ Fase concluída!", "Pontuação: " + score, worldMapOn ? "🗺️ Ir ao mapa" : "▶ Próxima fase"); }
  }

  // ---------- Perigos ----------
  function checkHazards() { const p = player; if (p.dead) return; for (const L of hazardsLava) if (overlap(p, L)) { killPlayer(); return; } for (const s of hazardsSpike) if (overlap(p, s)) { hurtPlayer(); return; } }

  // ============================================================
  //  UPDATE
  // ============================================================
  function update() {
    if (state !== "play") return; tick++;
    const p = player;
    if (p.dead) { p.deadT++; p.vy += GRAVITY; p.y += p.vy; if (p.deadT > 70) loseLife(); return; }
    if (keys.left) { p.vx -= MOVE; p.face = -1; } if (keys.right) { p.vx += MOVE; p.face = 1; }
    if (!keys.left && !keys.right) p.vx *= FRICTION; p.vx = Math.max(-MAX_VX, Math.min(MAX_VX, p.vx)); if (Math.abs(p.vx) < 0.05) p.vx = 0;
    if (keys.up && p.onGround) { p.vy = (p.power === "small") ? JUMP_VY : POWER_JUMP; p.onGround = false; SFX.jump(); }
    keys.up = false;
    if (p.power !== "fly" && !keys.upHeld && p.vy < -4) p.vy = -4;
    p.vy += GRAVITY;
    if (p.power === "fly" && keys.upHeld) { p.vy -= 0.95; if (p.vy < -6.5) p.vy = -6.5; }
    if (p.vy > 16) p.vy = 16;
    if (p.fireCd > 0) p.fireCd--;
    if (keys.fire && p.power === "fire" && p.fireCd <= 0) { shootFire(); p.fireCd = 16; }
    keys.fire = false; if (p.invuln > 0) p.invuln--;
    p.x += p.vx; collide("x"); p.y += p.vy; p.onGround = false; collide("y");
    if (p.onGround && Math.abs(p.vx) > 0.4) p.walk += Math.abs(p.vx) * 0.06; else p.walk = 0;
    if (p.x < 0) { p.x = 0; p.vx = 0; } if (p.x + p.w > levelW) { p.x = levelW - p.w; p.vx = 0; }
    if (p.y > levelH + 60) killPlayer();
    updateEnemies(); updateEnemyShots(); updatePowerups(); updateFireballs(); updateParticles();
    if (boss) { updateBoss(); updateBossShots(); }
    checkHazards();
    for (const c of coins) if (!c.taken) { c.ph += 0.12; if (overlap(p, c)) { c.taken = true; score += 50; SFX.coin(); } }
    if (flag && overlap(p, flag)) { levelComplete(); return; }
    const target = p.x + p.w / 2 - W / 2; cameraX += (target - cameraX) * 0.14; cameraX = Math.max(0, Math.min(cameraX, levelW - W));
  }
  function collide(axis) {
    const o = player;
    for (const s of solids) { if (!overlap(o, s)) continue;
      if (axis === "x") { o.x = o.vx > 0 ? s.x - o.w : s.x + s.w; o.vx = 0; }
      else { if (o.vy > 0) { o.y = s.y - o.h; o.onGround = true; o.vy = 0; } else if (o.vy < 0) { o.y = s.y + s.h; o.vy = 0; } }
    }
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function pop(x, y) { for (let i = 0; i < 8; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, life: 24, r: 3, col: "#ffd23f" }); }
  function updateParticles() { for (const pt of particles) { pt.vy += 0.3; pt.x += pt.vx; pt.y += pt.vy; pt.life--; } particles = particles.filter(p => p.life > 0); }

  // ============================================================
  //  RENDER
  // ============================================================
  function render() {
    if (state === "map") { drawMap(); return; }
    if (!solids) return;                 // ainda no menu (nenhuma fase montada)
    const th = (CFG.themes || {})[curTheme] || {};
    // fundo
    if (th._bg && th._bg._ok) { const bw = th._bg.width, off = (cameraX * 0.3) % bw; for (let x = -off; x < W; x += bw) ctx.drawImage(th._bg, x, 0, bw, H); }
    else { const g = ctx.createLinearGradient(0, 0, 0, H); const sky = th.sky || ["#5c94fc", "#a8e0ff"]; g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1] || sky[0]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // sólidos
    const gc = th.ground || { top: "#5fa83d", dirt: "#8a5a2b" };
    for (const s of solids) { const sx = s.x - cameraX; if (sx + s.w < 0 || sx > W) continue;
      if (s.type === "brick") { ctx.fillStyle = "#c96f2e"; ctx.fillRect(sx, s.y, s.w, s.h); ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.strokeRect(sx + .5, s.y + .5, s.w - 1, s.h - 1); }
      else { ctx.fillStyle = gc.dirt; ctx.fillRect(sx, s.y, s.w, s.h); ctx.fillStyle = gc.top; ctx.fillRect(sx, s.y, s.w, 10); }
    }
    // lava / espinhos
    for (const L of hazardsLava) { const x = L.x - cameraX; ctx.fillStyle = "#e0451a"; ctx.fillRect(x, L.y, L.w, L.h); ctx.fillStyle = "rgba(255,220,120,.5)"; ctx.fillRect(x, L.y, L.w, 3); }
    for (const s of hazardsSpike) { const x = s.x - cameraX, left = s.x < levelW / 2; ctx.fillStyle = "#c9ccd4"; for (let i = 0; i < 3; i++) { const yy = s.y + 5 + i * 11; ctx.beginPath(); if (left) { ctx.moveTo(x, yy); ctx.lineTo(x + s.w * 0.7, yy + 5); ctx.lineTo(x, yy + 11); } else { ctx.moveTo(x + s.w, yy); ctx.lineTo(x + s.w * 0.3, yy + 5); ctx.lineTo(x + s.w, yy + 11); } ctx.closePath(); ctx.fill(); } }
    // moedas
    for (const c of coins) if (!c.taken) { const cx = c.x - cameraX + c.w / 2, cy = c.y + c.h / 2 + Math.sin(c.ph) * 3; ctx.fillStyle = "#ffcf33"; ctx.beginPath(); ctx.ellipse(cx, cy, c.w / 2 * Math.abs(Math.cos(c.ph)), c.h / 2, 0, 0, 7); ctx.fill(); }
    // power-ups
    for (const it of powerups) if (!it.taken) sprite(it._img, it.x - cameraX, it.y, it.w, it.h, { color: it.color, label: it.effect });
    // bandeira
    if (flag) { const fx = flag.x - cameraX; ctx.fillStyle = "#eee"; ctx.fillRect(fx, flag.y, 4, flag.h); ctx.fillStyle = "#39c463"; ctx.beginPath(); ctx.moveTo(fx + 4, flag.y + 6); ctx.lineTo(fx + 30, flag.y + 14); ctx.lineTo(fx + 4, flag.y + 22); ctx.fill(); }
    // inimigos
    for (const e of enemies) { const ex = e.x - cameraX; if (ex + e.w < 0 || ex > W) continue; if (!e.alive) { if (e.squash > 0) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(ex + e.w / 2, e.y + e.h - 4, e.w / 2, 6, 0, 0, 7); ctx.fill(); } continue; } sprite(e._img, ex, e.y, e.w, e.h, { flip: e.vx > 0, color: e.color || "#8e44ad", label: e.beh }); }
    // projéteis de inimigo
    for (const s of enemyShots) { const cx = s.x - cameraX + s.w / 2, cy = s.y + s.h / 2; if (s.kind === "bomb") { ctx.fillStyle = "#2b2b2b"; ctx.beginPath(); ctx.arc(cx, cy, s.w / 2, 0, 7); ctx.fill(); } else { ctx.fillStyle = "#c07bff"; ctx.beginPath(); ctx.ellipse(cx, cy, s.w / 2, s.h / 2, 0, 0, 7); ctx.fill(); } }
    // chefão
    if (boss) { const b = boss; ctx.save(); if (b.dying) ctx.globalAlpha = Math.max(0, 1 - b.dieT / 80); sprite(b._img, b.x - cameraX, b.y, b.w, b.h, { flip: b.face > 0, color: b.color, label: b.beh }); if (b.hitFlash > 0 && Math.floor(b.hitFlash / 2) % 2 === 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = "#fff"; roundRect(b.x - cameraX, b.y, b.w, b.h, 8); ctx.fill(); } ctx.restore(); bossBar(b); }
    // projéteis de chefão
    for (const s of bossShots) { const cx = s.x - cameraX + s.w / 2, cy = s.y + s.h / 2; ctx.fillStyle = s.kind === "fire" ? "#ff7a1a" : s.kind === "hammer" ? "#b9bcc4" : "#6bd06b"; ctx.beginPath(); ctx.arc(cx, cy, s.w / 2, 0, 7); ctx.fill(); }
    // fireballs
    for (const f of fireballs) { ctx.fillStyle = "#ff5a1a"; ctx.beginPath(); ctx.arc(f.x - cameraX + f.w / 2, f.y + f.h / 2, f.w / 2, 0, 7); ctx.fill(); }
    // partículas
    for (const pt of particles) { ctx.globalAlpha = Math.max(0, pt.life / 24); ctx.fillStyle = pt.col; ctx.fillRect(pt.x - cameraX, pt.y, pt.r, pt.r); } ctx.globalAlpha = 1;
    // jogador
    if (!player.dead || Math.floor(tick / 4) % 2 === 0) { if (!(player.invuln > 0 && Math.floor(tick / 4) % 2)) sprite(players[chosen]._img, player.x - cameraX, player.y, player.w, player.h, { flip: player.face < 0, color: "#39c463" }); }
    updateHUD();
  }
  function bossBar(b) { const bw = 230, x = (W - bw) / 2, y = 54; ctx.fillStyle = "rgba(0,0,0,.55)"; roundRect(x - 10, y - 6, bw + 20, 34, 8); ctx.fill(); ctx.fillStyle = "#ff6b6b"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("👑 " + b.name, x, y + 2); const pw = bw / b.maxHp; for (let i = 0; i < b.maxHp; i++) { ctx.fillStyle = i < b.hp ? "#ff3b3b" : "rgba(255,255,255,.18)"; roundRect(x + i * pw + 1, y + 14, pw - 3, 7, 3); ctx.fill(); } ctx.textAlign = "start"; ctx.textBaseline = "alphabetic"; }

  // ---------- HUD / telas ----------
  const POWER_ICON = { small: "—", big: "⬆", fire: "🔥", fly: "🪽" };
  function updateHUD() { setTxt("hud-score", score); setTxt("hud-level", (levelIdx + 1) + "/" + CFG.levels.length); setTxt("hud-lives", infinite ? "∞" : lives); setTxt("hud-power", POWER_ICON[player.power] || "—"); }
  function setTxt(id, v) { const el = $(id); if (el) el.textContent = v; }
  function showMsg(title, text, btn) { const m = $("msg"); if (!m) return; setTxt("msg-title", title); setTxt("msg-text", text); setTxt("msg-btn", btn); m.classList.remove("hidden"); }
  function hideMsg() { const m = $("msg"); if (m) m.classList.add("hidden"); }

  // ============================================================
  //  ENTRADA (teclado + toque) e TELAS
  // ============================================================
  function bindKeys() {
    addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") { keys.left = true; if (state === "map" && !e.repeat) mapMove(-1); }
      else if (e.key === "ArrowRight" || e.key === "d") { keys.right = true; if (state === "map" && !e.repeat) mapMove(1); }
      else if (e.key === "ArrowUp" || e.key === " " || e.key === "w") { if (!keys.upHeld) { keys.up = true; if (state === "map") mapEnter(); } keys.upHeld = true; }
      else if (e.key === "ArrowDown" || e.key === "s") keys.down = true;
      else if (e.key === "f" || e.key === "x") keys.fire = true;
      else if (e.key === "m") toggleMute();
    });
    addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
      else if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
      else if (e.key === "ArrowUp" || e.key === " " || e.key === "w") keys.upHeld = false;
      else if (e.key === "ArrowDown" || e.key === "s") keys.down = false;
    });
  }
  function bindTouch(id, on, off) { const el = $(id); if (!el) return; const d = (e) => { e.preventDefault(); on(); }, u = (e) => { e.preventDefault(); off && off(); }; el.addEventListener("touchstart", d, { passive: false }); el.addEventListener("touchend", u); el.addEventListener("mousedown", d); el.addEventListener("mouseup", u); el.addEventListener("mouseleave", u); }
  function toggleMute() { muted = !muted; if (muted) stopMusic(); const b = $("muteBtn"); if (b) b.textContent = muted ? "🔇" : "🔊"; }

  function buildStartScreen() {
    setTxt("title", CFG.title || "Meu Jogo");
    const pick = $("playerPick"); if (pick) { pick.innerHTML = ""; players.forEach((p, i) => { const d = document.createElement("div"); d.className = "char" + (i === 0 ? " sel" : ""); d.dataset.i = i; d.innerHTML = "<canvas width=72 height=72></canvas><b>" + (p.name || ("P" + (i + 1))) + "</b>"; pick.appendChild(d); const pc = d.querySelector("canvas").getContext("2d"); const draw = () => { pc.clearRect(0, 0, 72, 72); const im = p._img; if (im && im._ok) pc.drawImage(im, 8, 4, 56, 64); else { pc.fillStyle = "#39c463"; pc.fillRect(16, 10, 40, 52); } }; if (p._img) { p._img._ok ? draw() : p._img.addEventListener("load", draw, { once: true }); } else draw(); d.addEventListener("click", () => { chosen = i; [...pick.children].forEach(c => c.classList.remove("sel")); d.classList.add("sel"); }); }); }
  }
  function startGame() {
    levelIdx = 0; score = 0; lives = START_LIVES; player.power = "small"; unlocked = 0; mapSel = 0;
    const chk = $("infiniteChk"); infinite = (chk && chk.checked) || !!CFG.infiniteLives;
    hideMsg(); $("startScreen").classList.add("hidden"); if ($("touch")) $("touch").classList.add("on");
    if (ac() && ac().state === "suspended") ac().resume();
    if (worldMapOn) openMap(0); else { $("hud").style.display = "flex"; buildLevel(0); state = "play"; }
  }
  function openMap(sel) { stopMusic(); hideMsg(); $("startScreen").classList.add("hidden"); $("hud").style.display = "none"; mapSel = Math.max(0, Math.min(sel == null ? mapSel : sel, unlocked)); state = "map"; }
  function playFromMap(i) { if (i > unlocked) return; levelIdx = i; $("hud").style.display = "flex"; buildLevel(i); state = "play"; }
  function mapMove(d) { if (state !== "map") return; mapSel = Math.max(0, Math.min(mapSel + d, unlocked)); }
  function mapEnter() { if (state !== "map") return; if (ac() && ac().state === "suspended") ac().resume(); playFromMap(mapSel); }
  function nextAfterMsg() {
    hideMsg();
    if (state === "levelcomplete") { if (worldMapOn) openMap(Math.min(levelIdx + 1, MAP_NODES.length - 1)); else { levelIdx++; buildLevel(levelIdx); $("hud").style.display = "flex"; state = "play"; } }
    else if (state === "win" || state === "gameover") { $("startScreen").classList.remove("hidden"); $("hud").style.display = "none"; if ($("touch")) $("touch").classList.remove("on"); state = "start"; }
  }

  // ---------- Mapa de fases (trilha sinuosa) ----------
  function buildMapNodes(N) {
    const nodes = [], perRow = 5, x0 = 92, x1 = 708;
    const rows = Math.max(1, Math.ceil(N / perRow));
    for (let i = 0; i < N; i++) {
      const r = Math.floor(i / perRow), k = i % perRow, cols = Math.min(perRow, N - r * perRow);
      const kk = (r % 2 === 0) ? k : (cols - 1 - k), t = cols > 1 ? kk / (cols - 1) : 0.5;
      const y = rows > 1 ? (96 + r * (268 / (rows - 1))) : 220;
      nodes.push({ x: x0 + (x1 - x0) * t + Math.sin(kk * 1.7 + r * 2.1) * 14, y: y + Math.sin(kk * 1.2 + r * 1.6) * 18 });
    }
    return nodes;
  }
  function traceTrail(pts, count) {
    const n = count == null ? pts.length : count; if (n < 1) return;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); }
    if (n >= 2) ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
  function drawMap() {
    const T = performance.now() / 1000;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2f7fc0"); g.addColorStop(1, "#57a9e6"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e9d29a"; ctx.beginPath(); ctx.ellipse(W / 2, H / 2 + 8, W * 0.46, H * 0.42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#6fae54"; ctx.beginPath(); ctx.ellipse(W / 2, H / 2 + 8, W * 0.43, H * 0.37, 0, 0, 7); ctx.fill();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(120,86,30,.5)"; ctx.lineWidth = 13; traceTrail(MAP_NODES); ctx.stroke();
    ctx.strokeStyle = "#efdca6"; ctx.lineWidth = 9; ctx.stroke();
    if (unlocked > 0) { ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = 9; traceTrail(MAP_NODES, Math.min(unlocked, MAP_NODES.length - 1) + 1); ctx.stroke(); }
    for (let i = 0; i < MAP_NODES.length; i++) {
      const n = MAP_NODES[i], boss = LEVEL_IS_BOSS[i], open = i <= unlocked, done = i < unlocked, cur = i === unlocked, sel = i === mapSel;
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(n.x, n.y + 18, 17, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = done ? "#39c463" : (open ? (boss ? "#b03048" : "#5fa83d") : "#8a8f9a");
      ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, 7); ctx.stroke();
      if (cur) { const p = 2 + Math.sin(T * 4) * 1.5; ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 22 + p, 0, 7); ctx.stroke(); }
      ctx.fillStyle = open ? "#fff" : "#e8e8e8"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(open ? String(i + 1) : "🔒", n.x, n.y + 1);
      if (boss) { ctx.font = "13px sans-serif"; ctx.fillText("👑", n.x, n.y - 26); }
      if (done) { ctx.fillStyle = "#0a5"; ctx.beginPath(); ctx.arc(n.x + 14, n.y - 14, 7, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.fillText("✓", n.x + 14, n.y - 13); }
      if (sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(n.x, n.y, 20, 0, 7); ctx.stroke(); }
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    const sn = MAP_NODES[mapSel];
    if (sn) { const hop = Math.abs(Math.sin(T * 3)) * 6; sprite(players[chosen]._img, sn.x - 14, sn.y - 42 - hop, 28, 34, { color: "#39c463" }); }
    ctx.fillStyle = "rgba(0,0,0,.5)"; roundRect(W / 2 - 155, 12, 310, 34, 9); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🗺️ Fase " + (mapSel + 1) + "/" + MAP_NODES.length + (LEVEL_IS_BOSS[mapSel] ? " · 👑 Chefão" : ""), W / 2, 29);
    ctx.font = "13px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillText("← →  escolher   ·   ↑ / ▲  entrar", W / 2, H - 16);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }
  function onMapTap(clientX, clientY) {
    if (state !== "map") return; const r = canvas.getBoundingClientRect();
    const cx = (clientX - r.left) * (canvas.width / r.width), cy = (clientY - r.top) * (canvas.height / r.height);
    for (let i = 0; i < MAP_NODES.length; i++) { const n = MAP_NODES[i]; if (i <= unlocked && Math.hypot(cx - n.x, cy - n.y) < 24) { mapSel = i; mapEnter(); return; } }
  }

  // ---------- Loop ----------
  let last = 0, acc = 0; const STEP = 1000 / 60;
  function loop(t) { const dt = Math.min(50, t - last); last = t; acc += dt; let n = 0; while (acc >= STEP && n++ < 5) { update(); acc -= STEP; } render(); requestAnimationFrame(loop); }

  // ---------- Boot ----------
  function boot() {
    bindKeys();
    bindTouch("btnLeft", () => { keys.left = true; if (state === "map") mapMove(-1); }, () => keys.left = false);
    bindTouch("btnRight", () => { keys.right = true; if (state === "map") mapMove(1); }, () => keys.right = false);
    bindTouch("btnDown", () => keys.down = true, () => keys.down = false);
    bindTouch("btnJump", () => { keys.up = true; keys.upHeld = true; if (state === "map") mapEnter(); }, () => keys.upHeld = false);
    bindTouch("btnFire", () => keys.fire = true, () => {});
    canvas.addEventListener("click", (e) => onMapTap(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", (e) => { if (state === "map" && e.touches[0]) { e.preventDefault(); onMapTap(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    const sb = $("startBtn"); if (sb) sb.addEventListener("click", startGame);
    const mb = $("msg-btn"); if (mb) mb.addEventListener("click", nextAfterMsg);
    const mu = $("muteBtn"); if (mu) mu.addEventListener("click", toggleMute);
    buildStartScreen();
    render(); requestAnimationFrame(loop);
    // hook de depuração/testes
    window.__ENGINE = {
      get state() { return state; }, get score() { return score; }, get levelIdx() { return levelIdx; },
      get boss() { return boss; }, get enemies() { return enemies; }, get player() { return player; },
      get lives() { return lives; }, get levelW() { return levelW; }, get levelH() { return levelH; },
      get unlocked() { return unlocked; }, get mapNodes() { return MAP_NODES; }, get worldMapOn() { return worldMapOn; },
      setUnlocked: (n) => { unlocked = n; }, openMap: (s) => openMap(s),
      enterLevel: (i) => { levelIdx = i; buildLevel(i); $("hud").style.display = "flex"; state = "play"; }, start: () => startGame(),
      hurtBoss: (n) => bossHurt(n || 1), config: CFG,
    };
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot); else boot();
})();
