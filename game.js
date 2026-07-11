/* ============================================================
   SAPO BROS — Aventura no Bosque
   Um platformer estilo Super Mario Bros com dois sapos
   recortados de uma foto (sprites) e power-ups clássicos.
   ============================================================ */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // ---- HUD ----
  const $score = document.getElementById("score");
  const $level = document.getElementById("level");
  const $lives = document.getElementById("lives");
  const $power = document.getElementById("power");
  const $powerBox = document.getElementById("powerBox");
  const $btnFire = document.getElementById("btnFire");
  const $muteBtn = document.getElementById("muteBtn");

  // Atalhos de áudio (tolerantes à ausência do motor de som)
  const snd = (n) => { if (window.Sound) window.Sound.play(n); };
  const musicStart = () => { if (window.Sound) window.Sound.startMusic(); };
  const musicStop  = () => { if (window.Sound) window.Sound.stopMusic(); };
  const voice = (n) => { if (window.Sound && window.Sound.playVoice) window.Sound.playVoice(n); };

  // ---- Screens ----
  const startScreen = document.getElementById("startScreen");
  const msgScreen   = document.getElementById("msgScreen");
  const msgTitle    = document.getElementById("msgTitle");
  const msgText     = document.getElementById("msgText");
  const msgBtn      = document.getElementById("msgBtn");
  const startBtn    = document.getElementById("startBtn");
  const touchLayer  = document.getElementById("touch");

  // ============================================================
  //  CHARACTERS
  // ============================================================
  // Two dinosaurs cut out directly from the reference photo (PNG sprites).
  // `spark` is an accent color used only for particle effects.
  // `nativeFacing` = the direction the source art already faces (1=right, -1=left);
  // the sprite is mirrored when the player moves the other way.
  // As imagens vêm embutidas em base64 (assets.js), assim o jogo abre
  // direto pelo index.html, sem precisar de servidor. Se assets.js não
  // estiver presente, cai para os arquivos em assets/.
  const S = (typeof window !== "undefined" && window.SPRITES) || {};
  const CHARACTERS = [
    { name:"Jones", voice:"jones", src:S.rex  || "assets/rex.png",  spark:"#ffd23f", nativeFacing:1, img:null, ready:false },
    { name:"Minja", voice:"minja", src:S.lima || "assets/lima.png", spark:"#ffd23f", nativeFacing:1, img:null, ready:false },
  ];
  let chosen = 0;

  // preload sprite images
  CHARACTERS.forEach(c => {
    const img = new Image();
    img.onload = () => { c.ready = true; };
    img.src = c.src;
    c.img = img;
  });

  // ============================================================
  //  PHYSICS CONSTANTS
  // ============================================================
  const GRAVITY   = 0.62;
  const MOVE      = 0.8;
  const FRICTION  = 0.82;
  const MAX_VX    = 4.6;
  const JUMP_VY      = -12.4;   // pulo normal
  const POWER_JUMP   = -14.6;   // pulo mais alto quando com power-up (cogumelo etc.)
  const FLY_THRUST   = 0.95;    // empuxo por quadro ao voar (segurando pular)
  const FLY_MAX_UP   = -6.5;    // velocidade máxima de subida ao voar
  const FIRE_COOLDOWN = 16;     // quadros entre tiros de fogo
  const TILE      = 40;

  // tamanhos do jogador conforme o poder
  function sizeFor(power) { return power === "small" ? { w:30, h:38 } : { w:40, h:52 }; }

  // ============================================================
  //  LEVELS  (tile maps)
  //  Legend:
  //   . empty     G ground     B brick/platform
  //   ? coin      E enemy       F flag (goal)
  //   P player start
  //   M cogumelo (cresce + pula mais alto)
  //   R flor de fogo (atira bolas de fogo)
  //   V flor voadora (permite voar)
  // ============================================================
  const LEVELS = [
`................................................................................
................................................................................
................................................................................
..........?.?...................................................................
..............................BBBB..............................................
.................?..?...............................?.?.?.......................
............BBB.............BBB..............BBBB................................
.......................?.........................................F.............
..P.........E.......BB......E...........?..E.............E.......G..............
GGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`,

`................................................................................
................................................................................
.................?.?.?..........................................................
..............................BBB...............?...?...........................
.........?...................................BBBBB..............................
......BBBB.........E...............BB..............................F.............
...........................?..............E...............BBB.....G.............
..P.....E..........BBB.........E.......?.......E....?.....E.......G..............
GGGGGGGGGGGGGGGGGG....GGGGGGGGGGGGGGG..GGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGG`,

`................................................................................
.............?..?..?..?.........................................................
...........BBBBBBBB...................?.?.?.....................................
......................................BBBBB.....................................
....?...............E.....E.......................E.....E.......F...............
...BB......?.................BBB..........?.?.........BBBB......G................
.........BBBB.....................E..............BBB...........G................
..P..E..........BB.....?.....E..........BB..E.........?...E....G................
GGGGGGGGGG..GGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`,
  ];

  // Posições dos power-ups por fase (em coordenadas de tile: col, row),
  // colocadas sobre chão sólido. Desacoplado do desenho ASCII acima.
  const POWERUPS_BY_LEVEL = [
    [ {type:"mushroom", col:6,  row:8}, {type:"fire", col:46, row:8}, {type:"fly", col:72, row:8} ],
    [ {type:"mushroom", col:5,  row:8}, {type:"fire", col:30, row:8}, {type:"fly", col:66, row:8} ],
    [ {type:"mushroom", col:6,  row:8}, {type:"fire", col:40, row:8}, {type:"fly", col:70, row:8} ],
  ];
  function spawnPowerup(type, x, y) {
    if (type === "mushroom")
      powerups.push({ x:x+6, y:y+8, w:28, h:28, type:"mushroom", vx:1.1, vy:0, taken:false, phase:0 });
    else
      powerups.push({ x:x+6, y:y+6, w:28, h:30, type, vx:0, vy:0, taken:false, phase:Math.random()*6.28 });
  }

  // ============================================================
  //  WORLD STATE
  // ============================================================
  let state = "start"; // start | play | dead | win | gameover
  let levelIdx = 0;
  let score = 0, lives = 3;
  let infinite = false;          // modo vidas infinitas
  let audioMuted = false;        // som ligado/desligado
  const START_LIVES = 3;
  const SAVE_KEY = "sapobros_save_v1";
  let solids = [];   // {x,y,w,h}
  let coins = [];    // {x,y,w,h,taken,phase}
  let enemies = [];  // {x,y,w,h,vx,alive,squash}
  let powerups = []; // {x,y,w,h,type,vx,vy,taken,phase} type: mushroom|fire|fly
  let fireballs = []; // {x,y,w,h,vx,vy,dead}
  let flag = null;   // {x,y,w,h}
  let levelW = 0, levelH = 0;
  let cameraX = 0;
  let particles = [];
  let tick = 0;               // contador global de quadros (animação/piscar)

  const player = {
    x:0, y:0, w:30, h:38, vx:0, vy:0,
    onGround:false, face:1, walk:0, dead:false, deadT:0, blink:0, spawnX:0, spawnY:0,
    power:"small",            // small | big | fire | fly
    invuln:0,                 // quadros de invulnerabilidade após tomar dano
    fireCd:0                  // recarga do tiro de fogo
  };

  // Troca o poder ajustando o tamanho, mantendo os pés no chão e o centro.
  function setPower(np) {
    const s = sizeFor(np);
    player.y += player.h - s.h;
    player.x += (player.w - s.w) / 2;
    player.w = s.w; player.h = s.h; player.power = np;
  }

  // ============================================================
  //  INPUT
  // ============================================================
  const keys = { left:false, right:false, jump:false, jumpHeld:false, fire:false };

  addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key === "ArrowUp" || e.key === " ") { if (!keys.jumpHeld) keys.jump = true; keys.jumpHeld = true; }
    const k = e.key.toLowerCase();
    if (k === "f" || k === "x") { if (!e.repeat) keys.fire = true; }
    if (k === "m") { if (!e.repeat) toggleMute(); }
  });
  addEventListener("keyup", e => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
    if (e.key === "ArrowUp" || e.key === " ") keys.jumpHeld = false;
  });

  // Touch buttons
  function bindTouch(id, on, off) {
    const el = document.getElementById(id);
    const start = e => { e.preventDefault(); on(); };
    const end   = e => { e.preventDefault(); off(); };
    el.addEventListener("touchstart", start, {passive:false});
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", end);
    el.addEventListener("mouseleave", end);
  }
  bindTouch("btnLeft",  () => keys.left = true,  () => keys.left = false);
  bindTouch("btnRight", () => keys.right = true, () => keys.right = false);
  bindTouch("btnJump",  () => { keys.jump = true; keys.jumpHeld = true; }, () => keys.jumpHeld = false);
  bindTouch("btnFire",  () => { keys.fire = true; }, () => {});

  if ("ontouchstart" in window) touchLayer.classList.add("on");

  // ============================================================
  //  LEVEL LOADING
  // ============================================================
  function loadLevel(idx) {
    const map = LEVELS[idx].split("\n");
    solids = []; coins = []; enemies = []; particles = []; flag = null;
    powerups = []; fireballs = [];
    levelH = map.length * TILE;
    levelW = map[0].length * TILE;

    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const ch = map[r][c];
        const x = c * TILE, y = r * TILE;
        if (ch === "G" || ch === "B") {
          solids.push({ x, y, w:TILE, h:TILE, type: ch === "G" ? "ground" : "brick" });
        } else if (ch === "?") {
          coins.push({ x:x+10, y:y+8, w:20, h:24, taken:false, phase:Math.random()*6.28 });
        } else if (ch === "E") {
          enemies.push({ x:x+4, y:y+6, w:32, h:32, vx:-0.9, alive:true, squash:0 });
        } else if (ch === "M") {
          spawnPowerup("mushroom", x, y);
        } else if (ch === "R") {
          spawnPowerup("fire", x, y);
        } else if (ch === "V") {
          spawnPowerup("fly", x, y);
        } else if (ch === "F") {
          flag = { x:x+16, y:y - TILE*2, w:8, h:TILE*3 };
        } else if (ch === "P") {
          player.spawnX = x; player.spawnY = y;
        }
      }
    }
    // power-ups posicionados por coordenada de tile
    (POWERUPS_BY_LEVEL[idx] || []).forEach(pu => spawnPowerup(pu.type, pu.col * TILE, pu.row * TILE));
    respawnPlayer(false);   // mantém o poder atual ao entrar numa fase nova
    cameraX = 0;
  }

  // resetPower=true zera para "small" (usado ao morrer/começar); senão mantém.
  function respawnPlayer(resetPower) {
    if (resetPower) player.power = "small";
    const s = sizeFor(player.power);
    player.w = s.w; player.h = s.h;
    player.x = player.spawnX; player.y = player.spawnY;
    player.vx = 0; player.vy = 0; player.dead = false; player.deadT = 0;
    player.face = 1; player.walk = 0; player.onGround = false;
    player.invuln = 0; player.fireCd = 0;
    fireballs = [];
  }

  // ============================================================
  //  SAVE / LOAD  (localStorage)
  // ============================================================
  function saveProgress() {
    const inProgress = (state === "play" || state === "dead" || state === "levelend");
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        chosen, infinite, muted: audioMuted,   // preferências (sempre)
        inProgress,                       // há um jogo em andamento?
        levelIdx, score, lives: isFinite(lives) ? lives : START_LIVES,
        power: player.power,              // poder atual (cogumelo/fogo/voo)
        best: bestScore()
      }));
    } catch (e) { /* localStorage indisponível — ignora */ }
  }
  function readSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); }
    catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function bestScore() {
    const s = readSave();
    return Math.max(score, (s && s.best) || 0);
  }

  // ============================================================
  //  GAME FLOW
  // ============================================================
  // fresh = novo jogo (zera progresso); senão retoma o save existente.
  function startGame(fresh) {
    if (fresh) {
      levelIdx = 0; score = 0; lives = infinite ? Infinity : START_LIVES;
      player.power = "small";
    } else {
      const s = readSave();
      if (s) {
        chosen   = s.chosen ?? chosen;
        infinite = !!s.infinite;
        levelIdx = s.levelIdx ?? 0;
        score    = s.score ?? 0;
        lives    = infinite ? Infinity : (s.lives ?? START_LIVES);
        player.power = s.power || "small";
      } else {
        levelIdx = 0; score = 0; lives = infinite ? Infinity : START_LIVES;
        player.power = "small";
      }
    }
    startScreen.classList.add("hidden");
    msgScreen.classList.add("hidden");
    loadLevel(levelIdx);
    state = "play";
    updateHUD();
    saveProgress();
    if (window.Sound) { window.Sound.resume(); musicStart(); }
  }

  function showMsg(title, text, btn) {
    msgTitle.textContent = title;
    msgText.textContent = text;
    msgBtn.textContent = btn;
    msgScreen.classList.remove("hidden");
  }

  function nextLevel() {
    levelIdx++;
    musicStop();
    snd("levelclear");
    if (levelIdx >= LEVELS.length) {
      state = "win";
      saveProgress();   // guarda preferências, marca jogo como concluído (sem "continuar")
      showMsg("🏆 Você venceu!", `Parabéns! ${CHARACTERS[chosen].name} atravessou todo o bosque. Pontuação final: ${score} 🍎`, "🔁 Jogar de novo");
    } else {
      state = "levelend";
      saveProgress();
      showMsg("✔ Fase concluída!", `Rumo à fase ${levelIdx + 1}. Pontuação: ${score} 🍎`, "▶ Próxima fase");
    }
  }

  function loseLife() {
    if (infinite) {          // vidas infinitas: apenas renasce
      respawnPlayer(true);
      state = "play";
      musicStart();
      return;
    }
    lives--;
    updateHUD();
    if (lives <= 0) {
      state = "gameover";
      saveProgress();        // fim de jogo: mantém preferências, encerra o progresso
      musicStop();
      snd("gameover");
      showMsg("💀 Fim de jogo", `Que pena! Pontuação: ${score} 🍎. Tente novamente.`, "🔁 Recomeçar");
    } else {
      respawnPlayer(true);
      state = "play";
      saveProgress();
      musicStart();          // volta a música ao renascer
    }
  }

  const POWER_ICON = { small:"—", big:"🍄", fire:"🔥", fly:"🪽" };
  const POWER_BG   = { small:"rgba(0,0,0,.28)", big:"rgba(220,60,50,.5)", fire:"rgba(255,120,40,.55)", fly:"rgba(80,160,255,.55)" };
  function updateHUD() {
    $score.textContent = score;
    $level.textContent = levelIdx + 1;
    $lives.textContent = infinite ? "∞" : lives;
    if ($power) $power.textContent = POWER_ICON[player.power] || "—";
    if ($powerBox) $powerBox.style.background = POWER_BG[player.power] || POWER_BG.small;
    if ($btnFire) $btnFire.classList.toggle("hidden", player.power !== "fire");
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  function update() {
    if (state !== "play") return;
    tick++;

    const p = player;

    if (p.dead) {
      p.deadT++;
      p.vy += GRAVITY;
      p.y += p.vy;
      if (p.deadT > 70) loseLife();
      return;
    }

    // Horizontal input
    if (keys.left)  { p.vx -= MOVE; p.face = -1; }
    if (keys.right) { p.vx += MOVE; p.face = 1; }
    if (!keys.left && !keys.right) p.vx *= FRICTION;
    p.vx = Math.max(-MAX_VX, Math.min(MAX_VX, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    // Jump (mais alto quando com power-up)
    if (keys.jump && p.onGround) {
      p.vy = (p.power === "small") ? JUMP_VY : POWER_JUMP;
      p.onGround = false;
      spawnDust(p.x + p.w/2, p.y + p.h);
      snd("jump");
    }
    keys.jump = false;
    // Variable jump height (não se aplica ao voo, que usa empuxo contínuo)
    if (p.power !== "fly" && !keys.jumpHeld && p.vy < -4) p.vy = -4;

    p.vy += GRAVITY;

    // Voo: segurar pular dá empuxo para cima (flor voadora 🪽)
    if (p.power === "fly" && keys.jumpHeld) {
      p.vy -= FLY_THRUST;
      if (p.vy < FLY_MAX_UP) p.vy = FLY_MAX_UP;
      if (tick % 4 === 0) spawnDust(p.x + p.w/2, p.y + p.h);
    }
    if (p.vy > 16) p.vy = 16;

    // Tiro de fogo (flor de fogo 🔥)
    if (p.fireCd > 0) p.fireCd--;
    if (keys.fire && p.power === "fire" && p.fireCd <= 0) {
      shootFireball();
      p.fireCd = FIRE_COOLDOWN;
    }
    keys.fire = false;
    if (p.invuln > 0) p.invuln--;

    // Move + collide X
    p.x += p.vx;
    collide(p, "x");
    // Move + collide Y
    p.y += p.vy;
    p.onGround = false;
    collide(p, "y");

    // Walk animation
    if (p.onGround && Math.abs(p.vx) > 0.4) p.walk += Math.abs(p.vx) * 0.06;
    else p.walk = 0;
    p.blink = (p.blink + 1) % 220;

    // World bounds
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x + p.w > levelW) { p.x = levelW - p.w; p.vx = 0; }

    // Fell in a pit
    if (p.y > levelH + 60) killPlayer();

    updateEnemies();
    updateCoins();
    updatePowerups();
    updateFireballs();
    updateParticles();

    // Flag / goal
    if (flag && rectsOverlap(p, flag)) {
      score += 500;
      updateHUD();
      nextLevel();
      return;
    }

    // Camera follows player
    const target = p.x + p.w/2 - W/2;
    cameraX += (target - cameraX) * 0.12;
    cameraX = Math.max(0, Math.min(cameraX, levelW - W));
  }

  function collide(o, axis) {
    for (const s of solids) {
      if (!rectsOverlap(o, s)) continue;
      if (axis === "x") {
        if (o.vx > 0) o.x = s.x - o.w;
        else if (o.vx < 0) o.x = s.x + s.w;
        o.vx = 0;
      } else {
        if (o.vy > 0) { o.y = s.y - o.h; o.onGround = true; o.vy = 0; }
        else if (o.vy < 0) { o.y = s.y + s.h; o.vy = 0; }
      }
    }
  }

  function updateEnemies() {
    const p = player;
    for (const e of enemies) {
      if (!e.alive) { e.squash = Math.max(0, e.squash - 1); continue; }

      // Patrol with gravity
      e.vy = (e.vy || 0) + GRAVITY;
      if (e.vy > 14) e.vy = 14;

      e.x += e.vx;
      // turn at walls
      for (const s of solids) {
        if (rectsOverlap(e, s)) {
          if (e.vx > 0) e.x = s.x - e.w; else e.x = s.x + s.w;
          e.vx *= -1;
        }
      }
      e.y += e.vy;
      let grounded = false;
      for (const s of solids) {
        if (rectsOverlap(e, s)) {
          if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; grounded = true; }
          else { e.y = s.y + s.h; e.vy = 0; }
        }
      }
      // turn at ledges (avoid walking off edges)
      if (grounded) {
        const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const footY = e.y + e.h + 4;
        let floor = false;
        for (const s of solids) {
          if (aheadX >= s.x && aheadX <= s.x + s.w && footY >= s.y && footY <= s.y + s.h) { floor = true; break; }
        }
        if (!floor) e.vx *= -1;
      }
      // fell off world
      if (e.y > levelH + 80) e.alive = false;

      // Collision with player
      if (rectsOverlap(p, e) && !p.dead) {
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 20;
        if (stomping) {
          e.alive = false; e.squash = 16;
          p.vy = JUMP_VY * 0.62;
          score += 100; updateHUD();
          spawnPop(e.x + e.w/2, e.y + e.h/2);
          snd("stomp");
        } else if (p.invuln <= 0) {
          // voz do Minja ao se encrencar (esbarrar/levar dano de um inimigo)
          if (chosen === 1) voice("minja_trouble");
          if (p.power !== "small") {
            // perde o poder em vez de morrer (estilo Mario)
            setPower("small");
            p.invuln = 100;
            p.vy = -6;
            spawnSpark(p.x + p.w/2, p.y + p.h/2);
            updateHUD();
            snd("powerdown");
          } else {
            killPlayer();
          }
        }
      }
    }
  }

  function updateCoins() {
    const p = player;
    for (const c of coins) {
      if (c.taken) continue;
      c.phase += 0.12;
      if (rectsOverlap(p, c)) {
        c.taken = true;
        score += 50; updateHUD();
        spawnSpark(c.x + c.w/2, c.y + c.h/2);
        snd("coin");
      }
    }
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    player.deadT = 0;
    player.vy = -9;
    musicStop();
    snd("die");
  }

  // ---- POWER-UPS ----
  function updatePowerups() {
    const p = player;
    for (const it of powerups) {
      if (it.taken) continue;
      it.phase += 0.1;

      // Movimento horizontal: só o cogumelo anda (e vira nas paredes)
      if (it.type === "mushroom") {
        it.x += it.vx;
        for (const s of solids) {
          if (rectsOverlap(it, s)) {
            if (it.vx > 0) it.x = s.x - it.w; else it.x = s.x + s.w;
            it.vx *= -1;
          }
        }
        if (it.x < 0) { it.x = 0; it.vx *= -1; }
        if (it.x + it.w > levelW) { it.x = levelW - it.w; it.vx *= -1; }
      }

      // Gravidade para TODOS os itens: sempre pousam sobre o chão/plataforma,
      // nunca ficam enterrados (corrige a flor "enterrada").
      it.vy += GRAVITY; if (it.vy > 14) it.vy = 14;
      it.y += it.vy;
      for (const s of solids) {
        if (rectsOverlap(it, s)) {
          if (it.vy > 0) { it.y = s.y - it.h; it.vy = 0; }
          else { it.y = s.y + s.h; it.vy = 0; }
        }
      }

      // coleta
      if (rectsOverlap(p, it)) {
        it.taken = true;
        collectPower(it.type);
        spawnSpark(it.x + it.w/2, it.y + it.h/2);
      }
    }
  }

  function collectPower(type) {
    const p = player;
    if (type === "mushroom") {
      if (p.power === "small") { setPower("big"); snd("powerup"); }
      else { score += 1000; snd("oneup"); }   // já grande: vira pontos
    } else if (type === "fire") {
      setPower("fire");
      score += 200;
      snd("powerup");
    } else if (type === "fly") {
      setPower("fly");
      score += 200;
      snd("powerup");
    }
    // voz do personagem ao pegar cogumelo/flor
    voice(CHARACTERS[chosen].voice);
    updateHUD();
  }

  // ---- FIREBALLS ----
  function shootFireball() {
    if (fireballs.filter(f => !f.dead).length >= 3) return;   // no máx. 3 na tela
    const p = player;
    const dir = p.face;
    fireballs.push({
      x: p.x + (dir > 0 ? p.w : -12),
      y: p.y + p.h * 0.35,
      w: 12, h: 12, vx: dir * 6.2, vy: -1.5, dead: false
    });
    snd("shoot");
  }

  function updateFireballs() {
    for (const f of fireballs) {
      if (f.dead) continue;
      f.vy += 0.4;
      // horizontal
      f.x += f.vx;
      for (const s of solids) {
        if (rectsOverlap(f, s)) { f.dead = true; break; }   // bate na parede
      }
      // vertical (quica no chão)
      f.y += f.vy;
      for (const s of solids) {
        if (rectsOverlap(f, s)) {
          if (f.vy > 0) { f.y = s.y - f.h; f.vy = -5.2; }    // quica
          else { f.y = s.y + s.h; f.vy = 0; }
        }
      }
      if (f.x < 0 || f.x > levelW || f.y > levelH + 40) f.dead = true;

      // acerta inimigos
      if (!f.dead) {
        for (const e of enemies) {
          if (e.alive && rectsOverlap(f, e)) {
            e.alive = false; e.squash = 16;
            score += 150; updateHUD();
            spawnPop(e.x + e.w/2, e.y + e.h/2);
            snd("kick");
            f.dead = true;
            break;
          }
        }
      }
    }
    fireballs = fireballs.filter(f => !f.dead);
  }

  // ---- particles ----
  function spawnDust(x, y) {
    for (let i = 0; i < 5; i++)
      particles.push({ x, y, vx:(i-2)*0.6, vy:-Math.random()*1.5, life:22, col:"#e9d7a0", r:3 });
  }
  function spawnPop(x, y) {
    for (let i = 0; i < 10; i++)
      particles.push({ x, y, vx:(Math.random()-0.5)*4, vy:-Math.random()*3-1, life:26, col:"#b06a3a", r:3 });
  }
  function spawnSpark(x, y) {
    for (let i = 0; i < 10; i++)
      particles.push({ x, y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:24, col:"#ffe15a", r:3 });
  }
  function updateParticles() {
    for (const pt of particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.18; pt.life--; }
    particles = particles.filter(pt => pt.life > 0);
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function drawBackground() {
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5c94fc"); g.addColorStop(1, "#a8e0ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // parallax hills
    const off = cameraX * 0.3;
    ctx.fillStyle = "#6fae54";
    for (let i = -1; i < 6; i++) {
      const hx = i * 260 - (off % 260);
      hillArc(hx, H - 70, 150, 90);
    }
    ctx.fillStyle = "#5a9945";
    const off2 = cameraX * 0.5;
    for (let i = -1; i < 8; i++) {
      const hx = i * 200 - (off2 % 200);
      hillArc(hx, H - 55, 110, 70);
    }
    // clouds
    ctx.fillStyle = "rgba(255,255,255,.85)";
    const co = cameraX * 0.15;
    for (let i = -1; i < 6; i++) cloud(i * 240 - (co % 240) + 60, 60 + (i % 2) * 30);
  }
  function hillArc(x, y, w, h) {
    ctx.beginPath(); ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - h, x + w, y);
    ctx.closePath(); ctx.fill();
  }
  function cloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, 7); ctx.arc(x + 20, y + 4, 22, 0, 7);
    ctx.arc(x + 44, y, 16, 0, 7); ctx.arc(x + 22, y - 8, 16, 0, 7);
    ctx.fill();
  }

  function drawSolids() {
    for (const s of solids) {
      const sx = s.x - cameraX;
      if (sx + s.w < 0 || sx > W) continue;
      if (s.type === "ground") {
        ctx.fillStyle = "#8a5a2b"; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = "#5fa83d"; ctx.fillRect(sx, s.y, s.w, 10);
        ctx.fillStyle = "#4d8a30"; ctx.fillRect(sx, s.y + 8, s.w, 4);
        ctx.fillStyle = "rgba(0,0,0,.12)";
        ctx.fillRect(sx + 6, s.y + 18, 5, 5); ctx.fillRect(sx + 24, s.y + 28, 5, 5);
      } else {
        ctx.fillStyle = "#c96f2e"; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = "#a9551d"; ctx.fillRect(sx, s.y, s.w, 4); ctx.fillRect(sx, s.y + s.h - 4, s.w, 4);
        ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(sx + s.w/2 - 1, s.y, 2, s.h);
        ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.strokeRect(sx + .5, s.y + .5, s.w - 1, s.h - 1);
      }
    }
  }

  function drawCoins() {
    for (const c of coins) {
      if (c.taken) continue;
      const cx = c.x - cameraX + c.w/2;
      if (cx < -20 || cx > W + 20) continue;
      const cy = c.y + c.h/2 + Math.sin(c.phase) * 3;
      const wobble = Math.abs(Math.cos(c.phase)); // fake spin
      // apple
      ctx.fillStyle = "#e63b2e";
      ctx.beginPath(); ctx.ellipse(cx, cy, 9 * (0.4 + 0.6 * wobble), 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#7a3b12"; ctx.fillRect(cx - 1, cy - 12, 2, 5);
      ctx.fillStyle = "#4caf50";
      ctx.beginPath(); ctx.ellipse(cx + 5, cy - 10, 5, 3, -0.5, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath(); ctx.ellipse(cx - 3, cy - 3, 2, 3, 0, 0, 7); ctx.fill();
    }
  }

  function drawPowerups() {
    for (const it of powerups) {
      if (it.taken) continue;
      const x = it.x - cameraX, y = it.y;
      if (x + it.w < 0 || x > W) continue;
      const cx = x + it.w/2, cy = y + it.h/2;
      const bob = Math.sin(it.phase) * 2;

      if (it.type === "mushroom") {
        // caule
        ctx.fillStyle = "#f2e2c4";
        roundRect(cx - 8, cy, 16, it.h/2 - 2, 4); ctx.fill();
        // olhinhos
        ctx.fillStyle = "#000";
        ctx.fillRect(cx - 5, cy + 4, 3, 5); ctx.fillRect(cx + 2, cy + 4, 3, 5);
        // chapéu vermelho
        ctx.fillStyle = "#e23b2e";
        ctx.beginPath(); ctx.arc(cx, cy, it.w/2, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillRect(cx - it.w/2, cy, it.w, 3);
        // pintas brancas
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(cx, cy - 6, 4, 0, 7); ctx.arc(cx - 8, cy - 2, 3, 0, 7); ctx.arc(cx + 8, cy - 2, 3, 0, 7); ctx.fill();
      } else {
        // FLOR (fogo = laranja/vermelho, voo = azul/branco)
        const fire = it.type === "fire";
        const petal = fire ? "#ff8a2b" : "#7fd1ff";
        const petal2 = fire ? "#ffcf33" : "#d4ecff";
        // caule + folha
        ctx.strokeStyle = "#3fa64d"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, cy + 2 + bob); ctx.lineTo(cx, y + it.h); ctx.stroke();
        ctx.fillStyle = "#3fa64d";
        ctx.beginPath(); ctx.ellipse(cx + 7, y + it.h - 6, 6, 3, -0.6, 0, 7); ctx.fill();
        // pétalas
        ctx.save(); ctx.translate(cx, cy - 4 + bob);
        ctx.fillStyle = petal;
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath(); ctx.ellipse(0, -9, 5, 8, 0, 0, 7); ctx.fill();
        }
        // asinhas na flor voadora
        if (!fire) {
          ctx.fillStyle = "rgba(255,255,255,.9)";
          const flap = Math.sin(it.phase * 3) * 0.3;
          ctx.save(); ctx.rotate(-0.5 + flap); ctx.beginPath(); ctx.ellipse(-14, -6, 7, 4, 0, 0, 7); ctx.fill(); ctx.restore();
          ctx.save(); ctx.rotate(0.5 - flap); ctx.beginPath(); ctx.ellipse(14, -6, 7, 4, 0, 0, 7); ctx.fill(); ctx.restore();
        }
        // miolo
        ctx.fillStyle = petal2;
        ctx.beginPath(); ctx.arc(0, -4, 6, 0, 7); ctx.fill();
        ctx.fillStyle = fire ? "#e23b2e" : "#4a90e2";
        ctx.beginPath(); ctx.arc(0, -4, 3, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFireballs() {
    for (const f of fireballs) {
      const x = f.x - cameraX + f.w/2, y = f.y + f.h/2;
      // brilho
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#ffb02e";
      ctx.beginPath(); ctx.arc(x, y, f.w * 0.9, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      // núcleo
      ctx.fillStyle = "#e23b2e";
      ctx.beginPath(); ctx.arc(x, y, f.w/2, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(tick * 0.4);
      ctx.fillStyle = "#ffe15a";
      ctx.beginPath(); ctx.arc(0, 0, f.w/3.4, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function drawFlag() {
    if (!flag) return;
    const fx = flag.x - cameraX;
    if (fx < -60 || fx > W + 60) return;
    // pole
    ctx.fillStyle = "#ddd"; ctx.fillRect(fx, flag.y, 6, flag.h);
    ctx.fillStyle = "#bbb"; ctx.fillRect(fx, flag.y, 2, flag.h);
    // ball on top
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(fx + 3, flag.y, 8, 0, 7); ctx.fill();
    // waving flag
    const t = performance.now() / 200;
    ctx.fillStyle = "#e63b2e";
    ctx.beginPath();
    ctx.moveTo(fx + 6, flag.y + 8);
    ctx.lineTo(fx + 6 + 42, flag.y + 14 + Math.sin(t) * 3);
    ctx.lineTo(fx + 6, flag.y + 30);
    ctx.closePath(); ctx.fill();
  }

  function drawEnemies() {
    for (const e of enemies) {
      const ex = e.x - cameraX;
      if (ex + e.w < 0 || ex > W) continue;
      if (!e.alive) {
        if (e.squash > 0) {
          ctx.fillStyle = "#7a4a8a";
          ctx.beginPath(); ctx.ellipse(ex + e.w/2, e.y + e.h - 4, e.w/2, 6, 0, 0, 7); ctx.fill();
        }
        continue;
      }
      drawEnemy(ex, e.y, e.w, e.h, e.vx);
    }
  }

  // A grumpy spiky snail-beetle enemy
  function drawEnemy(x, y, w, h, vx) {
    const cx = x + w/2, by = y + h;
    const wig = Math.sin(performance.now() / 120) * 1.5;
    // body
    ctx.fillStyle = "#8e44ad";
    ctx.beginPath(); ctx.ellipse(cx, by - h*0.35, w*0.5, h*0.38, 0, 0, 7); ctx.fill();
    // shell top
    ctx.fillStyle = "#6c3483";
    ctx.beginPath(); ctx.ellipse(cx, by - h*0.5 + wig, w*0.42, h*0.3, 0, Math.PI, 0); ctx.fill();
    // spikes
    ctx.fillStyle = "#4a235a";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i*10 - 4, y + 6 + wig);
      ctx.lineTo(cx + i*10, y - 2 + wig);
      ctx.lineTo(cx + i*10 + 4, y + 6 + wig);
      ctx.closePath(); ctx.fill();
    }
    // feet
    ctx.fillStyle = "#4a235a";
    const fp = Math.sin(performance.now()/100) * 2;
    ctx.fillRect(cx - 12, by - 5 + fp, 7, 6);
    ctx.fillRect(cx + 5, by - 5 - fp, 7, 6);
    // eyes (angry)
    const dir = vx < 0 ? -1 : 1;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx - 6*dir, by - h*0.42, 5, 0, 7); ctx.arc(cx + 6*dir, by - h*0.42, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(cx - 6*dir + dir*2, by - h*0.42, 2.4, 0, 7); ctx.arc(cx + 6*dir + dir*2, by - h*0.42, 2.4, 0, 7); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 11, by - h*0.55); ctx.lineTo(cx - 2, by - h*0.48);
    ctx.moveTo(cx + 11, by - h*0.55); ctx.lineTo(cx + 2, by - h*0.48);
    ctx.stroke();
  }

  // ---------- PLAYER DINO ----------
  // Player is rendered from the extracted photo sprite. The physics hitbox
  // (w,h) is smaller than the drawn sprite; the sprite is bottom-centered on
  // the hitbox so the feet line up with the ground.
  function drawDino(x, y, w, h, face, walk, ch, dead) {
    const c = CHARACTERS[ch];
    if (!c.ready) return;
    const dispH = h + 24;                 // draw a bit taller than the hitbox
    const cx = x + w/2, midY = y + h * 0.45;

    // efeitos ATRÁS do personagem
    if (!dead && player.power === "fly") {
      // asas batendo (mais rápido ao subir)
      const asc = keys.jumpHeld ? 1 : 0.4;
      const flap = Math.sin(tick * (0.25 + 0.2 * asc)) * (0.5 + 0.3 * asc);
      ctx.save(); ctx.translate(cx, midY);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.strokeStyle = "rgba(150,200,255,.9)"; ctx.lineWidth = 1.5;
      for (const sgn of [-1, 1]) {
        ctx.save(); ctx.scale(sgn, 1); ctx.rotate(-0.5 + flap);
        ctx.beginPath(); ctx.ellipse(-w*0.55, 0, 16, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    if (!dead && player.power === "fire") {
      // brilho quente ao redor
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(tick * 0.2)) * 0.15;
      const g = ctx.createRadialGradient(cx, midY, 4, cx, midY, w);
      g.addColorStop(0, "#ffd23f"); g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, midY, w, 0, 7); ctx.fill();
      ctx.restore();
    }

    drawSprite(ctx, ch, cx, y + h + 2, dispH, face, walk, dead);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawParticles() {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / 26);
      ctx.fillStyle = pt.col;
      ctx.beginPath(); ctx.arc(pt.x - cameraX, pt.y, pt.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground();
    drawSolids();
    drawCoins();
    drawPowerups();
    drawFlag();
    drawEnemies();
    drawFireballs();
    drawParticles();
    if (state === "play" || state === "dead") {
      // pisca durante a invulnerabilidade
      const blink = player.invuln > 0 && (Math.floor(tick / 4) % 2 === 0);
      if (!blink) {
        drawDino(player.x - cameraX, player.y, player.w, player.h, player.face, player.walk, chosen, player.dead);
      }
    }
  }

  // Draw a character sprite (from the photo) into the given 2D context,
  // bottom-centered on (cx, footY), scaled to display height dispH.
  function drawSprite(g, ch, cx, footY, dispH, faceDir, walk, dead) {
    const c = CHARACTERS[ch];
    if (!c.ready) return;
    const ar = c.img.width / c.img.height;
    const dh = dispH;
    const dw = dh * ar;
    const bob = Math.abs(Math.sin(walk)) * 2;            // little walk bounce
    const tilt = Math.sin(walk) * 0.05;                  // subtle body sway
    const flip = (faceDir !== c.nativeFacing) ? -1 : 1;

    g.save();
    g.translate(cx, footY - bob);
    if (dead) {
      g.globalAlpha = 0.9;
      g.rotate(Math.PI);                                 // flip over when defeated
      g.drawImage(c.img, -dw/2, 0, dw, dh);
    } else {
      g.rotate(tilt);
      g.scale(flip, 1);
      g.drawImage(c.img, -dw/2, -dh, dw, dh);
    }
    g.restore();
  }

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  let last = 0, acc = 0;
  const STEP = 1000 / 60;
  function loop(t) {
    if (!last) last = t;
    acc += Math.min(50, t - last); last = t;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ============================================================
  //  UI WIRING
  // ============================================================
  const continueBtn = document.getElementById("continueBtn");
  const infiniteChk = document.getElementById("infiniteChk");

  // Reflete um save existente na tela inicial (personagem, modo e botão continuar)
  function refreshStartScreen() {
    const s = readSave();
    // botão continuar só aparece se há um jogo em andamento salvo
    if (s && s.inProgress) {
      continueBtn.classList.remove("hidden");
      continueBtn.textContent = `⏵ Continuar (Fase ${(s.levelIdx ?? 0) + 1})`;
    } else {
      continueBtn.classList.add("hidden");
    }
    // restaura personagem e modo escolhidos anteriormente
    if (s) {
      chosen = s.chosen ?? chosen;
      infinite = !!s.infinite;
      applyMute(!!s.muted);
    }
    infiniteChk.checked = infinite;
    charEls.forEach(e => e.classList.toggle("sel", parseInt(e.dataset.char, 10) === chosen));
  }

  startBtn.addEventListener("click", () => startGame(true));   // novo jogo (mantém só as preferências)
  continueBtn.addEventListener("click", () => startGame(false));

  infiniteChk.addEventListener("change", () => {
    infinite = infiniteChk.checked;
    if (state === "play") {
      if (infinite) lives = Infinity;
      else if (!isFinite(lives)) lives = START_LIVES;   // volta a um valor finito
      updateHUD();
    }
    saveProgress();
  });

  // ---- Botão de mudo (🔊 / 🔇) ----
  function applyMute(m) {
    audioMuted = m;
    if (window.Sound) window.Sound.setMuted(m);
    if ($muteBtn) {
      $muteBtn.textContent = m ? "🔇" : "🔊";
      $muteBtn.classList.toggle("off", m);
    }
    if (!m && state === "play") musicStart();
    saveProgress();
  }
  function toggleMute() { if (window.Sound) window.Sound.resume(); applyMute(!audioMuted); }
  if ($muteBtn) {
    $muteBtn.addEventListener("click", toggleMute);
    $muteBtn.addEventListener("touchstart", (e) => { e.preventDefault(); toggleMute(); }, { passive:false });
  }

  msgBtn.addEventListener("click", () => {
    if (state === "levelend") {
      loadLevel(levelIdx);
      msgScreen.classList.add("hidden");
      state = "play";
      updateHUD();
      musicStart();
    } else if (state === "win" || state === "gameover") {
      msgScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
      state = "start";
      musicStop();
      refreshStartScreen();
    }
  });

  // Character selection + preview thumbnails
  const charEls = document.querySelectorAll("#charPick .char");
  charEls.forEach(el => {
    el.addEventListener("click", () => {
      charEls.forEach(e => e.classList.remove("sel"));
      el.classList.add("sel");
      chosen = parseInt(el.dataset.char, 10);
      saveProgress();
    });
    // draw preview
    const idx = parseInt(el.dataset.char, 10);
    const pc = el.querySelector("canvas");
    const pctx = pc.getContext("2d");
    drawPreview(pctx, idx);
  });

  // aplica qualquer save/preferência ao abrir
  refreshStartScreen();

  // Hook de depuração (só com ?debug=1 na URL) — usado em testes automatizados.
  if (typeof location !== "undefined" && /[?&]debug=1/.test(location.search)) {
    window.__DINO = {
      player,
      give: (t) => collectPower(t),
      fireballs: () => fireballs,
      powerups: () => powerups,
      coins: () => coins,
      enemies: () => enemies,
      solids: () => solids,
      get state() { return state; },
      get levelH() { return levelH; },
    };
  }

  function drawPreview(pctx, idx) {
    const c = CHARACTERS[idx];
    const W2 = pctx.canvas.width, H2 = pctx.canvas.height;
    const render = () => {
      pctx.clearRect(0, 0, W2, H2);
      const ar = c.img.width / c.img.height;
      const dh = H2 - 6;
      const dw = dh * ar;
      pctx.drawImage(c.img, (W2 - dw) / 2, H2 - dh - 3, dw, dh);
    };
    if (c.ready) render();
    else c.img.addEventListener("load", render, { once:true });
  }

})();
