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
  // Áudio do subterrâneo: música de terror + uivos de lobo
  const caveAudioStart = () => { if (window.Sound) { window.Sound.stopMusic(); window.Sound.startHorror && window.Sound.startHorror(); window.Sound.startWolves && window.Sound.startWolves(); } };
  const caveAudioStop  = () => { if (window.Sound) { window.Sound.stopHorror && window.Sound.stopHorror(); window.Sound.stopWolves && window.Sound.stopWolves(); } };

  // ---- Screens ----
  const startScreen = document.getElementById("startScreen");
  const msgScreen   = document.getElementById("msgScreen");
  const msgTitle    = document.getElementById("msgTitle");
  const msgText     = document.getElementById("msgText");
  const msgBtn      = document.getElementById("msgBtn");
  const startBtn    = document.getElementById("startBtn");
  const touchLayer  = document.getElementById("touch");
  const pauseScreen = document.getElementById("pauseScreen");
  const resumeBtn   = document.getElementById("resumeBtn");
  const menuBtn     = document.getElementById("menuBtn");
  const pauseBtn    = document.getElementById("pauseBtn");
  const homeBtn     = document.getElementById("homeBtn");
  const hud         = document.getElementById("hud");

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
`................................................................................
................................................................................
................................................................................
................................................................................
............???...........????..............???.................................
............BBB....???....BBBB..................................................
.....................................???........................................
.............................BBB................................................
..P..................................................E...E................F.....
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
.................................?????..........................................
.................................BBBBB..................?????...................
................BBB............BBBB..............????...........................
..................................................???...........................
..................................................BBB...........................
..P...........E..E................E.......................................F.....
GGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGG...GGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
................................................................................
..............................???.............................BBBB..............
..........................BBB..............????...............?????.............
...........................................BBB...........???..BB???.............
................................................................BBB.............
..P................E..........E............E..............................F.....
GGGGGGGGGGGGGGG...GGGGGG...GGGGGGGGGGGGGG..GGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
....................???.....???.................................................
....................BBB.........???.............................................
....................BBB.....???.................................................
........................???....???................???......BBB..................
................................................................................
..P...................E..........E........................................F.....
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
................................................................................
..............???..........................................???..................
..............................................???....?????......................
.........................????.......???...........???BBBBB......................
.........................BBBB.......BBB...........BBB...........................
..P...................E..........E..............E.........................F.....
GGGGGGGGGGGGG...GGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
............................................???..????...........................
..............................???....?????..BBB..BBBB...........................
...........................???.......BBBBB......................................
...........????.....???..........................BBBB...........................
...........BBBB.................................................................
..P.....................E...........E..E..................................F.....
GGGGGGGGGGGGGGGGGGGG...GGGGGGG..GGGGGGGG...GGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
........................?????.....??????........................................
........................BBBBB.???...............................................
.................................................BBBBB..???...???...............
................................................................................
..............BBBB..............................................................
..P............E.......................................E..................F.....
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
....................................???......???????............................
.............???.............................BBBBB..........???.................
.................................????.................BBBB......................
.............................BBBBBBBB...........................................
................................................................................
..P.................E.....................E.......E.......................F.....
GGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGG..GGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
...........?????.????...................................???.....................
...........BBB????BBB.............????.???......................................
..............BBBB................BBBB..........................................
.................................................???............................
................................................................................
..P...........................E..........E...............E................F.....
GGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGG...GGGGGG...GGGGGG..GGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
..............................???.................???...........................
.....................???........................................................
..................................................???.BBBB......................
........................................BBBBB...................................
...................BBBBB........................................................
..P...............................E....................E..................F.....
GGGGGGGGGGGGGGG..GGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
................................................................................
...............????..................???........................................
............???BBBB.............................................................
............BBB.....???..............BBBB......???.....???.???..................
.......................BBB......................................................
..P.............E.......................................E..E..............F.....
GGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGG..GGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
.........................???.........???.............???........................
...............????...................???............BBB........................
...............BBBB..............?BBBBB..................BBB....................
.................................???...............????.........................
...................................................BBBB.........................
..P................E...E.....................E...........E................F.....
GGGGGGGGGGGGGGG...GGGGGGGGGGGGG...GGGGGGG..GGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGG`,
  ];

  // Posições dos power-ups por fase (em coordenadas de tile: col, row),
  // colocadas sobre chão sólido. Desacoplado do desenho ASCII acima.
  const POWERUPS_BY_LEVEL = [
    [ {type:"mushroom", col:6,  row:8}, {type:"fire", col:46, row:8}, {type:"fly", col:72, row:8} ],
    [ {type:"mushroom", col:5,  row:8}, {type:"fire", col:30, row:8}, {type:"fly", col:66, row:8} ],
    [ {type:"mushroom", col:6,  row:8}, {type:"fire", col:40, row:8}, {type:"fly", col:70, row:8} ],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":34,"row":8},{"type":"fly","col":62,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":36,"row":8},{"type":"fly","col":63,"row":8}],
    [{"type":"mushroom","col":12,"row":8},{"type":"fire","col":36,"row":8},{"type":"fly","col":61,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":34,"row":8},{"type":"fly","col":62,"row":8}],
    [{"type":"mushroom","col":12,"row":8},{"type":"fire","col":39,"row":8},{"type":"fly","col":64,"row":8}],
    [{"type":"mushroom","col":16,"row":8},{"type":"fire","col":38,"row":8},{"type":"fly","col":64,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":38,"row":8},{"type":"fly","col":62,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":37,"row":8},{"type":"fly","col":62,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":33,"row":8},{"type":"fly","col":63,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":41,"row":8},{"type":"fly","col":63,"row":8}],
    [{"type":"mushroom","col":13,"row":8},{"type":"fire","col":36,"row":8},{"type":"fly","col":63,"row":8}],
    [{"type":"mushroom","col":12,"row":8},{"type":"fire","col":35,"row":8},{"type":"fly","col":64,"row":8}]
  ];
  function spawnPowerup(type, x, y) {
    if (type === "mushroom")
      powerups.push({ x:x+6, y:y+8, w:28, h:28, type:"mushroom", vx:1.1, vy:0, taken:false, phase:0 });
    else
      powerups.push({ x:x+6, y:y+6, w:28, h:30, type, vx:0, vy:0, taken:false, phase:Math.random()*6.28 });
  }

  // Blocos "?" por fase: soltam um item quando o jogador dá uma cabeçada por baixo.
  // Posições validadas: bloco flutuando com espaço vazio embaixo (acessível
  // por cabeçada). Nunca colocar sobre outro bloco (ficaria inacessível).
  const QBLOCKS_BY_LEVEL = [
    [ {col:6,  row:6, item:"mushroom"}, {col:37, row:6, item:"fire"} ],
    [ {col:11, row:5, item:"mushroom"}, {col:39, row:5, item:"fly"} ],
    [ {col:6,  row:5, item:"mushroom"}, {col:37, row:5, item:"fire"} ],
    [{"col":8,"row":6,"item":"mushroom"},{"col":41,"row":6,"item":"fire"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":48,"row":6,"item":"fly"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":55,"row":6,"item":"fire"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":54,"row":6,"item":"fly"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":59,"row":6,"item":"fire"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":57,"row":6,"item":"fly"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":47,"row":6,"item":"fire"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":50,"row":6,"item":"fly"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":41,"row":6,"item":"fire"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":53,"row":6,"item":"fly"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":51,"row":6,"item":"fire"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":43,"row":6,"item":"fly"}]
  ];
  // Canos gigantes por fase: o jogador entra (seta para baixo) para o subterrâneo.
  // Posições validadas: base no chão, espaço livre acima (subir/entrar/pular por cima).
  const PIPES_BY_LEVEL = [
    [ {col:59, row:7} ],
    [ {col:62, row:6} ],
    [ {col:46, row:6} ],
    [{"col":46,"row":7}],
    [{"col":43,"row":7}],
    [{"col":47,"row":7}],
    [{"col":44,"row":7}],
    [{"col":42,"row":7}],
    [{"col":45,"row":7}],
    [{"col":42,"row":7}],
    [{"col":45,"row":7}],
    [{"col":59,"row":7}],
    [{"col":47,"row":7}],
    [{"col":44,"row":7}],
    [{"col":48,"row":7}]
  ];

  // Cenário subterrâneo especial (acessado pelos canos): escuro, com morcegos,
  // moedas e um cano de saída. 'X' = cano de saída (volta à fase).
  const UNDERGROUND_MAP =
`GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
G......................................................................G
G...................b..................................................G
G.............b.........................b.................b............G
G...........................b...................................b......G
G...................................................b..................G
G........????...??....????...??....????...??....????...??...????.......G
G........BBBB.........BBBB.........BBBB.........BBBB........BBBB.......G
G.P..?............?............?............?............?..........X..G
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`;


  // ============================================================
  //  WORLD STATE
  // ============================================================
  let state = "start"; // start | map | play | paused | dead | win | gameover | levelend
  let levelIdx = 0;
  let unlocked = 0;              // maior fase desbloqueada no mapa (0-based)
  let mapSel = 0;                // nó selecionado no mapa
  let score = 0, lives = 3;
  let infinite = false;          // modo vidas infinitas
  let invincible = false;        // modo invencível (não morre nunca)
  let audioMuted = false;        // som ligado/desligado
  const START_LIVES = 3;
  const SAVE_KEY = "sapobros_save_v1";
  let solids = [];   // {x,y,w,h,type}
  let coins = [];    // {x,y,w,h,taken,phase}
  let enemies = [];  // {x,y,w,h,vx,alive,squash,type}
  let powerups = []; // {x,y,w,h,type,vx,vy,taken,phase} type: mushroom|fire|fly
  let fireballs = []; // {x,y,w,h,vx,vy,dead}
  let pipes = [];    // {x,y,w,h} canos gigantes (entrada p/ subterrâneo)
  let flag = null;   // {x,y,w,h}
  let flagAnim = null;          // animação de descida no mastro ao fim da fase
  let exitPipe = null;          // cano de saída (no subterrâneo)
  let underground = false;      // cena subterrânea ativa?
  let pipeReturn = null;        // {levelIdx, x, y} para voltar do subterrâneo
  let levelW = 0, levelH = 0;
  let cameraX = 0;
  let particles = [];
  let tick = 0;               // contador global de quadros (animação/piscar)
  let pipeCd = 0;             // recarga após entrar/sair de cano (evita re-entrar na hora)

  const player = {
    x:0, y:0, w:30, h:38, vx:0, vy:0,
    onGround:false, face:1, walk:0, dead:false, deadT:0, blink:0, spawnX:0, spawnY:0,
    power:"small",            // small | big | fire | fly
    invuln:0,                 // quadros de invulnerabilidade após tomar dano
    fireCd:0,                 // recarga do tiro de fogo
    safeX:0, safeY:0          // última posição segura no chão (modo invencível)
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
  const keys = { left:false, right:false, down:false, jump:false, jumpHeld:false, fire:false };

  addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") { keys.left = true; if (state === "map" && !e.repeat) mapMove(-1); }
    if (e.key === "ArrowRight") { keys.right = true; if (state === "map" && !e.repeat) mapMove(1); }
    if (e.key === "ArrowDown") keys.down = true;
    if (e.key === "ArrowUp" || e.key === " ") {
      if (!keys.jumpHeld) { keys.jump = true; if (state === "map") mapEnter(); }
      keys.jumpHeld = true;
    }
    const k = e.key.toLowerCase();
    if (k === "f" || k === "x") { if (!e.repeat) keys.fire = true; }
    if (k === "m") { if (!e.repeat) toggleMute(); }
    if (k === "p" || e.key === "Escape") { if (!e.repeat) togglePause(); }
  });
  addEventListener("keyup", e => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
    if (e.key === "ArrowDown") keys.down = false;
    if (e.key === "ArrowUp" || e.key === " ") keys.jumpHeld = false;
  });

  // Touch buttons
  function bindTouch(id, on, off) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = e => { e.preventDefault(); on(); };
    const end   = e => { e.preventDefault(); off(); };
    el.addEventListener("touchstart", start, {passive:false});
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", end);
    el.addEventListener("mouseleave", end);
  }
  bindTouch("btnLeft",  () => { keys.left = true; if (state === "map") mapMove(-1); },  () => keys.left = false);
  bindTouch("btnRight", () => { keys.right = true; if (state === "map") mapMove(1); }, () => keys.right = false);
  bindTouch("btnDown",  () => { keys.down = true; }, () => keys.down = false);
  bindTouch("btnJump",  () => { keys.jump = true; keys.jumpHeld = true; if (state === "map") mapEnter(); }, () => keys.jumpHeld = false);
  bindTouch("btnFire",  () => { keys.fire = true; }, () => {});

  if ("ontouchstart" in window) touchLayer.classList.add("on");

  // ============================================================
  //  LEVEL LOADING
  // ============================================================
  // Zera todas as listas de uma cena
  function clearScene() {
    solids = []; coins = []; enemies = []; particles = []; flag = null;
    powerups = []; fireballs = []; pipes = []; exitPipe = null; flagAnim = null;
  }

  function loadLevel(idx) {
    const map = LEVELS[idx].split("\n");
    clearScene();
    underground = false;
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
          enemies.push({ x:x+4, y:y+6, w:32, h:32, vx:-0.9, alive:true, squash:0, type:"beetle" });
        } else if (ch === "M") { spawnPowerup("mushroom", x, y);
        } else if (ch === "R") { spawnPowerup("fire", x, y);
        } else if (ch === "V") { spawnPowerup("fly", x, y);
        } else if (ch === "F") {
          flag = { x:x+16, y:y - TILE*2, w:8, h:TILE*3 };
        } else if (ch === "P") {
          player.spawnX = x; player.spawnY = y;
        }
      }
    }
    (POWERUPS_BY_LEVEL[idx] || []).forEach(pu => spawnPowerup(pu.type, pu.col * TILE, pu.row * TILE));
    // blocos "?" (soltam item na cabeçada). Proteção: nunca colocar sobre
    // outro sólido (embaixo deve estar vazio, senão a cabeçada é impossível).
    (QBLOCKS_BY_LEVEL[idx] || []).forEach(q => {
      const bx = q.col * TILE, by = q.row * TILE;
      const belowBlocked = solids.some(s =>
        (bx + TILE/2) > s.x && (bx + TILE/2) < s.x + s.w && Math.abs(s.y - (by + TILE)) < 2);
      if (belowBlocked) return;   // sem espaço embaixo -> ignora (inacessível)
      solids.push({ x:bx, y:by, w:TILE, h:TILE, type:"question", item:q.item, used:false, bump:0 });
    });
    // canos gigantes (2x2 tiles) que levam ao subterrâneo. Proteção: não
    // colocar se o corpo do cano se sobrepõe a algum bloco existente (viraria
    // parede/entrada bloqueada).
    (PIPES_BY_LEVEL[idx] || []).forEach(p => {
      const px = p.col*TILE, py = p.row*TILE;
      const body = { x:px, y:py, w:TILE*2, h:TILE*2 };
      if (solids.some(s => rectsOverlap(body, s))) return;   // sobreposto -> ignora
      pipes.push(body);
      solids.push({ x:px, y:py, w:TILE*2, h:TILE*2, type:"pipe" });
    });
    respawnPlayer(false);   // mantém o poder atual ao entrar numa fase nova
    cameraX = 0;
  }

  // Cena subterrânea especial (acessada por um cano). Guarda de onde voltar.
  function loadUnderground(fromLevel, retX, retY) {
    const map = UNDERGROUND_MAP.split("\n");
    clearScene();
    underground = true;
    pipeReturn = { levelIdx: fromLevel, x: retX, y: retY };
    levelH = map.length * TILE;
    levelW = map[0].length * TILE;
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const ch = map[r][c];
        const x = c * TILE, y = r * TILE;
        if (ch === "G" || ch === "B") {
          solids.push({ x, y, w:TILE, h:TILE, type: ch === "G" ? "cave" : "cavebrick" });
        } else if (ch === "?") {
          coins.push({ x:x+10, y:y+8, w:20, h:24, taken:false, phase:Math.random()*6.28 });
        } else if (ch === "b") {
          // morcego (voa em padrão senoidal)
          enemies.push({ x:x+4, y:y+6, w:30, h:24, vx:(Math.random()<.5?-1:1)*1.3, vy:0, baseY:y+6, alive:true, squash:0, type:"bat", ph:Math.random()*6.28 });
        } else if (ch === "X") {
          exitPipe = { x, y:y - TILE, w:TILE, h:TILE*2 };       // cano de saída
          solids.push({ x, y:y - TILE, w:TILE, h:TILE*2, type:"pipe" });
        } else if (ch === "P") {
          player.spawnX = x; player.spawnY = y;
        }
      }
    }
    respawnPlayer(false);
    cameraX = 0;
    caveAudioStart();
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
    player.safeX = player.spawnX; player.safeY = player.spawnY;
    fireballs = [];
  }

  // ============================================================
  //  SAVE / LOAD  (localStorage)
  // ============================================================
  function saveProgress() {
    const inProgress = (state === "play" || state === "dead" || state === "levelend" || state === "paused");
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        chosen, infinite, invincible, muted: audioMuted,   // preferências (sempre)
        inProgress,                       // há um jogo em andamento?
        levelIdx, unlocked, score, lives: isFinite(lives) ? lives : START_LIVES,
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
      unlocked = 0; player.power = "small";
    } else {
      const s = readSave();
      if (s) {
        chosen   = s.chosen ?? chosen;
        infinite = !!s.infinite;
        invincible = !!s.invincible;
        levelIdx = s.levelIdx ?? 0;
        unlocked = s.unlocked ?? 0;
        score    = s.score ?? 0;
        lives    = infinite ? Infinity : (s.lives ?? START_LIVES);
        player.power = s.power || "small";
      } else {
        levelIdx = 0; unlocked = 0; score = 0; lives = infinite ? Infinity : START_LIVES;
        player.power = "small";
      }
    }
    if (window.Sound) window.Sound.resume();   // desbloqueia áudio no gesto
    openMap(Math.min(levelIdx, unlocked));
  }

  // Abre o mapa de fases (hub do jogo)
  function openMap(sel) {
    startScreen.classList.add("hidden");
    msgScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    caveAudioStop();
    musicStop();
    mapSel = Math.max(0, Math.min(sel ?? 0, unlocked));
    state = "map";
    updateHUD();
    saveProgress();
  }

  // Entra na fase selecionada no mapa
  function enterLevel(idx) {
    levelIdx = idx;
    loadLevel(levelIdx);
    state = "play";
    updateHUD();
    saveProgress();
    if (window.Sound) { window.Sound.resume(); musicStart(); }
  }

  // Navegação do mapa (setas) e confirmação (pular)
  function mapMove(dir) {
    if (state !== "map") return;
    mapSel = Math.max(0, Math.min(mapSel + dir, unlocked));
  }
  function mapEnter() {
    if (state !== "map") return;
    if (window.Sound) window.Sound.resume();
    enterLevel(mapSel);
  }

  function showMsg(title, text, btn) {
    msgTitle.textContent = title;
    msgText.textContent = text;
    msgBtn.textContent = btn;
    msgScreen.classList.remove("hidden");
  }

  // Pausa/retoma o jogo (só faz sentido durante a partida)
  function togglePause() {
    if (state === "play") {
      state = "paused";
      if (underground) caveAudioStop(); else musicStop();
      pauseScreen.classList.remove("hidden");
    } else if (state === "paused") {
      state = "play";
      pauseScreen.classList.add("hidden");
      if (underground) caveAudioStart(); else musicStart();
    }
  }

  // Volta ao menu inicial, salvando o progresso (Continuar fica disponível)
  function goToMenu() {
    if (state !== "play" && state !== "paused" && state !== "map") return;
    saveProgress();
    musicStop();
    caveAudioStop();
    state = "start";
    pauseScreen.classList.add("hidden");
    msgScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    refreshStartScreen();
  }

  // Entra no cano gigante -> cena subterrânea especial
  function enterPipe(pipe) {
    const retX = pipe.x + pipe.w/2 - player.w/2;
    const retY = pipe.y - player.h;
    snd("suck");                        // som de cano sugando
    loadUnderground(levelIdx, retX, retY);
    pipeCd = 30;                        // trava re-entrada/saída por um instante
    state = "play";
    updateHUD();
  }

  // Sai do subterrâneo pelo cano de saída -> volta à fase de origem
  function exitUnderground() {
    snd("suck");
    caveAudioStop();
    const ret = pipeReturn || { levelIdx: 0, x: 80, y: 320 };
    loadLevel(ret.levelIdx);
    player.x = ret.x; player.y = ret.y;
    player.vx = 0; player.vy = 0;
    player.safeX = ret.x; player.safeY = ret.y;
    pipeCd = 30;                        // evita ser sugado de volta ao aparecer no cano
    state = "play";
    updateHUD();
    musicStart();
  }

  // Fim da fase: agarra o mastro e desliza até a base (estilo Mario)
  function startFlagpole() {
    const p = player;
    const poleBase = flag.y + flag.h;
    // bônus por altura do agarre (quanto mais alto, mais pontos)
    const frac = Math.max(0, Math.min(1, (poleBase - (p.y + p.h)) / flag.h));
    const bonus = Math.round(frac * 10) * 100;   // 0..1000
    score += 500 + bonus;
    updateHUD();
    p.x = flag.x - p.w + 4;     // encosta no mastro
    p.vx = 0; p.vy = 0; p.face = 1; p.walk = 0; p.invuln = 0;
    flagAnim = { phase: "slide", t: 0, bannerY: Math.max(flag.y + 8, Math.min(p.y - 4, poleBase - 34)) };
    musicStop();
    snd("flag");
  }

  function updateFlagpole() {
    const p = player;
    const poleBase = flag.y + flag.h;
    if (flagAnim.phase === "slide") {
      p.y += 3.4;
      flagAnim.bannerY = Math.max(flag.y + 8, Math.min(p.y - 4, poleBase - 34));
      if (p.y + p.h >= poleBase) {
        p.y = poleBase - p.h;
        flagAnim.phase = "hop"; flagAnim.t = 0;
        p.x = flag.x + 8; p.face = 1;      // pula para o outro lado do mastro
        snd("stomp");
      }
    } else if (flagAnim.phase === "hop") {
      flagAnim.t++;
      p.x += 1.8; p.walk += 0.25;
      p.vy += GRAVITY; p.y += p.vy;
      for (const s of solids) { if (rectsOverlap(p, s) && p.vy > 0) { p.y = s.y - p.h; p.vy = 0; } }
      if (flagAnim.t > 42) { flagAnim = null; completeLevel(); }
    }
    updateParticles();
    const target = p.x + p.w/2 - W/2;
    cameraX += (target - cameraX) * 0.12;
    cameraX = Math.max(0, Math.min(cameraX, levelW - W));
  }

  function completeLevel() {
    musicStop();
    snd("levelclear");
    unlocked = Math.max(unlocked, Math.min(levelIdx + 1, LEVELS.length - 1));
    if (levelIdx + 1 >= LEVELS.length) {
      state = "win";
      saveProgress();   // jogo concluído
      showMsg("🏆 Você venceu!", `Parabéns! ${CHARACTERS[chosen].name} atravessou todo o bosque. Pontuação final: ${score} 🍎`, "🔁 Jogar de novo");
    } else {
      state = "levelend";
      saveProgress();
      showMsg("✔ Fase concluída!", `Fase ${levelIdx + 2} desbloqueada no mapa! Pontuação: ${score} 🍎`, "🗺️ Ir ao mapa");
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
    // No mapa, esconde os dados da partida (mantém só o botão de som no canto)
    const onMap = state === "map";
    if (hud) hud.style.justifyContent = onMap ? "flex-end" : "space-between";
    [$score.closest(".box"), $level.closest(".box"), $powerBox, $lives.closest(".box"), pauseBtn, homeBtn]
      .forEach(el => { if (el) el.style.display = onMap ? "none" : ""; });
    $score.textContent = score;
    $level.textContent = levelIdx + 1;
    $lives.textContent = invincible ? "🛡️" : (infinite ? "∞" : lives);
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

    if (flagAnim) { updateFlagpole(); return; }   // deslizando no mastro

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

    // Guarda a última posição segura no chão (usada no modo invencível)
    if (p.onGround && p.y < levelH - TILE) { p.safeX = p.x; p.safeY = p.y; }

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
    for (const s of solids) if (s.bump > 0) s.bump--;   // animação da cabeçada no "?"
    if (pipeCd > 0) pipeCd--;                            // recarga do cano

    // Encostou no mastro da bandeira -> inicia a descida
    if (flag && !flagAnim && rectsOverlap(p, flag)) {
      startFlagpole();
      return;
    }

    // Entrar no cano gigante (seta para baixo em cima da boca do cano)
    if (keys.down && p.onGround && pipeCd <= 0) {
      for (const pipe of pipes) {
        const mouth = pipe.x + pipe.w / 2;
        if (Math.abs((p.x + p.w/2) - mouth) < TILE * 0.6 && Math.abs((p.y + p.h) - pipe.y) < 6) {
          enterPipe(pipe);
          return;
        }
      }
    }
    // Sair do subterrâneo pelo cano de saída: basta chegar perto e apertar ↓
    // (o cano fica no chão, então não exige subir em cima).
    if (underground && exitPipe && keys.down && p.onGround && pipeCd <= 0) {
      const mouth = exitPipe.x + exitPipe.w / 2;
      if (Math.abs((p.x + p.w/2) - mouth) < TILE) {
        exitUnderground();
        return;
      }
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
        else if (o.vy < 0) {
          o.y = s.y + s.h; o.vy = 0;
          if (s.type === "question" && o === player) hitQuestionBlock(s);   // cabeçada
        }
      }
    }
  }

  // Cabeçada no bloco "?": solta o item por cima e "gasta" o bloco.
  function hitQuestionBlock(s) {
    if (s.used) return;
    s.used = true; s.bump = 8;
    snd("bump");
    const px = s.x + (TILE - 28) / 2;
    spawnPowerup(s.item || "mushroom", px, s.y - TILE);   // aparece por cima
    const pu = powerups[powerups.length - 1];
    if (pu) pu.vy = -4;                                    // pula para fora do bloco
  }

  function updateEnemies() {
    const p = player;
    for (const e of enemies) {
      if (!e.alive) { e.squash = Math.max(0, e.squash - 1); continue; }

      if (e.type === "bat") {
        // Morcego: voa em padrão senoidal, sem gravidade, vira nas paredes
        e.ph += 0.08;
        e.x += e.vx;
        for (const s of solids) {
          if (rectsOverlap(e, s)) {
            if (e.vx > 0) e.x = s.x - e.w; else e.x = s.x + s.w;
            e.vx *= -1;
          }
        }
        e.y = e.baseY + Math.sin(e.ph) * 26;
        if (e.x < TILE) { e.x = TILE; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > levelW - TILE) { e.x = levelW - TILE - e.w; e.vx = -Math.abs(e.vx); }
      } else {
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
      }

      // Collision with player
      if (rectsOverlap(p, e) && !p.dead) {
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 20;
        if (stomping) {
          e.alive = false; e.squash = 16;
          p.vy = JUMP_VY * 0.62;
          score += 100; updateHUD();
          spawnPop(e.x + e.w/2, e.y + e.h/2);
          snd("stomp");
        } else if (p.invuln <= 0 && !invincible) {
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
    if (invincible) {
      // modo invencível: não morre — volta ao último chão seguro
      player.x = player.safeX; player.y = player.safeY - 2;
      player.vx = 0; player.vy = 0;
      spawnDust(player.x + player.w/2, player.y + player.h);
      return;
    }
    player.dead = true;
    player.deadT = 0;
    player.vy = -9;
    musicStop();
    snd("die");
    // voz do Jones ao morrer (reusa o clipe de voz do Jones)
    if (chosen === 0) voice("jones");
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
  const THEME_LIST = ["bosque", "selva", "praia", "castelo", "ceu"];
  const GROUND_COLORS = {
    bosque:  { top:"#5fa83d", top2:"#4d8a30", dirt:"#8a5a2b" },
    selva:   { top:"#4f9a34", top2:"#3f7f28", dirt:"#6b4a24" },
    praia:   { top:"#ecd79a", top2:"#dcc47a", dirt:"#cdb06a" },
    castelo: { top:"#5fa83d", top2:"#4d8a30", dirt:"#9a6a3a" },
    ceu:     { top:"#8fd0a0", top2:"#e6eef5", dirt:"#b8c8d8" },
  };
  function curTheme() { return underground ? "cave" : (THEME_LIST[Math.floor(levelIdx / 3)] || "bosque"); }

  function drawBackground() {
    const th = curTheme();
    if (th === "cave") return drawCaveBackground();
    if (th === "selva") return drawSelvaBG();
    if (th === "praia") return drawPraiaBG();
    if (th === "castelo") return drawCasteloBG();
    if (th === "ceu") return drawCeuBG();
    return drawBosqueBG();
  }

  function skyGrad(top, bot) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function parallaxHills(c1, c2) {
    ctx.fillStyle = c1;
    const off = cameraX * 0.3;
    for (let i = -1; i < 6; i++) hillArc(i * 260 - (off % 260), H - 70, 150, 90);
    ctx.fillStyle = c2;
    const off2 = cameraX * 0.5;
    for (let i = -1; i < 8; i++) hillArc(i * 200 - (off2 % 200), H - 55, 110, 70);
  }
  function clouds(alpha) {
    ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
    const co = cameraX * 0.15;
    for (let i = -1; i < 6; i++) cloud(i * 240 - (co % 240) + 60, 60 + (i % 2) * 30);
  }

  // BOSQUE — floresta ensolarada (padrão)
  function drawBosqueBG() {
    skyGrad("#5c94fc", "#a8e0ff");
    parallaxHills("#6fae54", "#5a9945");
    clouds(0.85);
  }

  // SELVA — verde denso, céu esverdeado e cipós ao fundo
  function drawSelvaBG() {
    skyGrad("#2f7d63", "#a6e0b0");
    parallaxHills("#2f7a3c", "#245f2e");
    // cipós pendurados
    ctx.strokeStyle = "rgba(30,90,45,.5)"; ctx.lineWidth = 4;
    const off = cameraX * 0.4;
    for (let i = -1; i < 8; i++) {
      const vx = i * 130 - (off % 130) + 40;
      ctx.beginPath(); ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + 10, 60, vx, 120 + (i % 3) * 30); ctx.stroke();
      ctx.fillStyle = "rgba(40,120,60,.5)";
      ctx.beginPath(); ctx.arc(vx, 120 + (i % 3) * 30, 7, 0, 7); ctx.fill();
    }
    clouds(0.35);
  }

  // PRAIA — céu claro, mar com ondas e dunas de areia
  function drawPraiaBG() {
    skyGrad("#6db3ff", "#cdecff");
    clouds(0.8);
    // mar
    const seaY = H - 96;
    ctx.fillStyle = "#2f8fd6"; ctx.fillRect(0, seaY, W, H - seaY);
    ctx.fillStyle = "#57a9e6"; ctx.fillRect(0, seaY, W, 10);
    // ondas
    const t = performance.now() / 400;
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (let i = -1; i < 14; i++) {
      const wx = i * 70 - ((cameraX * 0.5) % 70);
      ctx.beginPath();
      ctx.ellipse(wx, seaY + 8 + Math.sin(t + i) * 3, 22, 5, 0, 0, 7); ctx.fill();
    }
    // dunas de areia
    ctx.fillStyle = "#e9d29a";
    const off = cameraX * 0.35;
    for (let i = -1; i < 7; i++) hillArc(i * 220 - (off % 220), H - 50, 130, 55);
  }

  // CASTELO — campo com um castelo (silhueta genérica) ao fundo
  function drawCasteloBG() {
    skyGrad("#5c94fc", "#bfe0ff");
    clouds(0.8);
    // castelo genérico ao longe (parallax lento)
    const cx = W * 0.5 - (cameraX * 0.12) % (W + 300);
    ctx.fillStyle = "#c9a26b";
    const bx = cx, by = H - 130, bw = 150, bh = 90;
    ctx.fillRect(bx, by, bw, bh);                         // corpo
    for (const tx of [bx - 18, bx + bw - 12]) ctx.fillRect(tx, by - 40, 30, bh + 40);  // torres
    ctx.fillStyle = "#8a6a3e";
    ctx.fillRect(bx + bw/2 - 16, by + 30, 32, bh - 30);  // portão
    // ameias
    ctx.fillStyle = "#c9a26b";
    for (let i = 0; i < 6; i++) ctx.fillRect(bx + 6 + i*24, by - 12, 12, 12);
    // bandeirinhas nas torres
    ctx.fillStyle = "#e63b2e";
    for (const tx of [bx - 3, bx + bw + 3]) { ctx.fillRect(tx, by - 60, 2, 20); ctx.beginPath(); ctx.moveTo(tx+2,by-60); ctx.lineTo(tx+16,by-55); ctx.lineTo(tx+2,by-50); ctx.fill(); }
    parallaxHills("#6fae54", "#5a9945");
  }

  // CÉU — nível nas nuvens, azul claro e muitas nuvens em camadas
  function drawCeuBG() {
    skyGrad("#7fb8ff", "#dff0ff");
    // nuvens distantes
    ctx.fillStyle = "rgba(255,255,255,.55)";
    const c0 = cameraX * 0.08;
    for (let i = -1; i < 7; i++) cloud(i * 210 - (c0 % 210), H - 90 + (i % 2) * 40);
    // nuvens médias como "colinas"
    ctx.fillStyle = "rgba(255,255,255,.9)";
    const c1 = cameraX * 0.3;
    for (let i = -1; i < 7; i++) { const hx = i * 240 - (c1 % 240); ctx.beginPath(); ctx.ellipse(hx, H - 40, 120, 46, 0, Math.PI, 0); ctx.fill(); }
    clouds(0.95);
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
  // Fundo do cenário subterrâneo (escuro, com estalactites e uma lua)
  function drawCaveBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0e1a"); g.addColorStop(1, "#1a2138");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // lua pálida ao fundo
    ctx.fillStyle = "rgba(210,220,255,.15)";
    ctx.beginPath(); ctx.arc(W - 120, 70, 40, 0, 7); ctx.fill();
    // estalactites no teto
    ctx.fillStyle = "#141a2c";
    const off = cameraX * 0.4;
    for (let i = -1; i < 10; i++) {
      const sx = i * 120 - (off % 120);
      ctx.beginPath();
      ctx.moveTo(sx, 0); ctx.lineTo(sx + 24, 0); ctx.lineTo(sx + 12, 46 + (i % 3) * 16);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawSolids() {
    for (const s of solids) {
      const sx = s.x - cameraX;
      if (sx + s.w < 0 || sx > W) continue;
      if (s.type === "pipe") {
        drawPipe(sx, s.y, s.w, s.h);
      } else if (s.type === "question") {
        drawQuestionBlock(sx, s.y, s);
      } else if (s.type === "ground") {
        const gc = GROUND_COLORS[curTheme()] || GROUND_COLORS.bosque;
        ctx.fillStyle = gc.dirt; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = gc.top;  ctx.fillRect(sx, s.y, s.w, 10);
        ctx.fillStyle = gc.top2; ctx.fillRect(sx, s.y + 8, s.w, 4);
        ctx.fillStyle = "rgba(0,0,0,.12)";
        ctx.fillRect(sx + 6, s.y + 18, 5, 5); ctx.fillRect(sx + 24, s.y + 28, 5, 5);
      } else if (s.type === "cave") {
        ctx.fillStyle = "#2b3552"; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = "#3a4670"; ctx.fillRect(sx, s.y, s.w, 8);
        ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(sx + 8, s.y + 16, 5, 5); ctx.fillRect(sx + 26, s.y + 26, 4, 4);
      } else if (s.type === "cavebrick") {
        ctx.fillStyle = "#3d3450"; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.strokeRect(sx + .5, s.y + .5, s.w - 1, s.h - 1);
      } else {
        ctx.fillStyle = "#c96f2e"; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = "#a9551d"; ctx.fillRect(sx, s.y, s.w, 4); ctx.fillRect(sx, s.y + s.h - 4, s.w, 4);
        ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(sx + s.w/2 - 1, s.y, 2, s.h);
        ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.strokeRect(sx + .5, s.y + .5, s.w - 1, s.h - 1);
      }
    }
  }

  // Bloco "?" (dourado, com "?"; some vira bloco usado marrom). Anima na cabeçada.
  function drawQuestionBlock(sx, y, s) {
    const off = s.bump ? -Math.sin((s.bump / 8) * Math.PI) * 8 : 0;
    const by = y + off;
    if (s.used) {
      ctx.fillStyle = "#9a6a34"; ctx.fillRect(sx, by, TILE, TILE);
      ctx.fillStyle = "#7c5228"; ctx.fillRect(sx, by, TILE, 4); ctx.fillRect(sx, by + TILE - 4, TILE, 4);
      ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.strokeRect(sx + .5, by + .5, TILE - 1, TILE - 1);
      return;
    }
    ctx.fillStyle = "#f4b400"; ctx.fillRect(sx, by, TILE, TILE);
    ctx.fillStyle = "#d99400"; ctx.fillRect(sx, by, TILE, 5); ctx.fillRect(sx, by + TILE - 5, TILE, 5);
    ctx.strokeStyle = "#7a5200"; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, by + 1, TILE - 2, TILE - 2);
    // rebites
    ctx.fillStyle = "#7a5200";
    for (const [dx, dy] of [[4,4],[TILE-6,4],[4,TILE-6],[TILE-6,TILE-6]]) ctx.fillRect(sx + dx, by + dy, 3, 3);
    // "?"
    ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", sx + TILE / 2, by + TILE / 2 + 1);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  // Cano verde gigante (rim + corpo)
  function drawPipe(sx, y, w, h) {
    ctx.fillStyle = "#2ea043"; ctx.fillRect(sx + 4, y + 14, w - 8, h - 14);       // corpo
    ctx.fillStyle = "#3fd35b"; ctx.fillRect(sx + 8, y + 14, 6, h - 14);           // brilho
    ctx.fillStyle = "#1f7a33"; ctx.fillRect(sx + w - 12, y + 14, 6, h - 14);      // sombra
    ctx.fillStyle = "#2ea043"; ctx.fillRect(sx, y, w, 16);                        // borda
    ctx.fillStyle = "#3fd35b"; ctx.fillRect(sx + 2, y + 2, w - 4, 5);
    ctx.strokeStyle = "#14431f"; ctx.lineWidth = 2;
    ctx.strokeRect(sx + .5, y + .5, w - 1, 15);
    ctx.strokeRect(sx + 4.5, y + 14, w - 9, h - 14);
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
    // bandeira (desce junto com o jogador durante a animação)
    const by = flagAnim ? flagAnim.bannerY : flag.y + 8;
    const wave = flagAnim ? 0 : Math.sin(performance.now() / 200) * 3;
    ctx.fillStyle = "#e63b2e";
    ctx.beginPath();
    ctx.moveTo(fx + 6, by);
    ctx.lineTo(fx + 6 + 42, by + 6 + wave);
    ctx.lineTo(fx + 6, by + 22);
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
      if (e.type === "bat") drawBat(ex, e.y, e.w, e.h);
      else drawEnemy(ex, e.y, e.w, e.h, e.vx);
    }
  }

  // Morcego: corpo escuro, asas batendo, olhinhos vermelhos
  function drawBat(x, y, w, h) {
    const cx = x + w/2, cy = y + h/2;
    const flap = Math.sin(performance.now() / 90) * 0.7;
    ctx.fillStyle = "#2b2140";
    for (const sgn of [-1, 1]) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sgn, 1); ctx.rotate(-0.2 + flap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w * 0.5, -h * 0.4, w * 0.7, 0);
      ctx.quadraticCurveTo(w * 0.55, h * 0.1, w * 0.35, h * 0.05);
      ctx.quadraticCurveTo(w * 0.5, h * 0.25, 0, h * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#3a2d54";
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.34, 0, 7); ctx.fill();
    // orelhas
    ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx - 9, cy - 13); ctx.lineTo(cx - 2, cy - 8);
    ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx + 9, cy - 13); ctx.lineTo(cx + 2, cy - 8); ctx.closePath(); ctx.fill();
    // olhos
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath(); ctx.arc(cx - 4, cy, 2.2, 0, 7); ctx.arc(cx + 4, cy, 2.2, 0, 7); ctx.fill();
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
    if (state === "map") { drawMap(); return; }
    drawBackground();
    drawSolids();
    drawCoins();
    drawPowerups();
    drawFlag();
    drawEnemies();
    drawFireballs();
    drawParticles();
    if (state === "play" || state === "dead" || state === "paused") {
      // pisca durante a invulnerabilidade
      const blink = player.invuln > 0 && (Math.floor(tick / 4) % 2 === 0);
      if (!blink) {
        drawDino(player.x - cameraX, player.y, player.w, player.h, player.face, player.walk, chosen, player.dead);
      }
    }
    // dica de entrada no cano
    if (state === "play") drawPipeHint();
  }

  // Dica "↓ entrar" quando o jogador está sobre um cano
  function drawPipeHint() {
    const p = player;
    if (!p.onGround) return;
    // canos de entrada: dica ao ficar em cima; cano de saída: ao chegar perto
    const list = pipes.map(pp => ({ pipe: pp, exit: false })).concat(exitPipe ? [{ pipe: exitPipe, exit: true }] : []);
    for (const { pipe, exit } of list) {
      const mouth = pipe.x + pipe.w / 2;
      const near = exit
        ? Math.abs((p.x + p.w/2) - mouth) < TILE
        : (Math.abs((p.x + p.w/2) - mouth) < TILE * 0.6 && Math.abs((p.y + p.h) - pipe.y) < 8);
      if (near) {
        const hx = mouth - cameraX, hy = (exit ? pipe.y : pipe.y) - 26;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        roundRect(hx - 34, hy - 14, 68, 22, 6); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("↓ entrar", hx, hy - 2);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        break;
      }
    }
  }

  // ---------- MAPA DE FASES (overworld) ----------
  // 15 nós em serpentina (3 fileiras de 5), agrupados em 5 mundos (temas)
  const MAP_NODES = (() => {
    const nodes = [], perRow = 5, ys = [120, 235, 350], x0 = 78, x1 = 722;
    for (let r = 0; r < 3; r++) for (let k = 0; k < perRow; k++) {
      const idx = r * perRow + k;
      const kk = (r % 2 === 0) ? k : (perRow - 1 - k);
      nodes.push({ x: x0 + (x1 - x0) * (kk / (perRow - 1)), y: ys[r], world: Math.floor(idx / 3) });
    }
    return nodes;
  })();
  const WORLD_COLOR = ["#5fa83d", "#2f9a58", "#e0b866", "#8a6ad6", "#7fb8ff"];  // por tema
  const WORLD_NAME  = ["🌳 Bosque", "🌴 Selva", "🏖️ Praia", "🏰 Castelo", "☁️ Céu"];

  // Decorações do mapa: posições fixas escolhidas nos "vãos" da grade de nós
  // (nós ficam em y=120/235/350; a decoração usa y=82/177/292/400 e fica longe
  //  do caminho). Arte 100% original desenhada abaixo.
  const MAP_DECOR = [
    { t: "mtn",   x: 150, y: 84,  s: 1.0 },
    { t: "mtn",   x: 470, y: 82,  s: 1.25 },
    { t: "tree",  x: 320, y: 80,  s: 0.9 },
    { t: "tree2", x: 645, y: 82,  s: 1.0 },
    { t: "tree",  x: 78,  y: 177, s: 1.0 },
    { t: "tree2", x: 239, y: 177, s: 1.1 },
    { t: "pond",  x: 400, y: 182, s: 1.0 },
    { t: "tree",  x: 561, y: 177, s: 1.0 },
    { t: "bush",  x: 239, y: 294, s: 1.0 },
    { t: "tree2", x: 400, y: 292, s: 1.0 },
    { t: "castle",x: 561, y: 298, s: 1.0 },
    { t: "tree",  x: 722, y: 292, s: 1.0 },
    { t: "palm",  x: 150, y: 402, s: 1.0 },
    { t: "bush",  x: 320, y: 404, s: 1.0 },
    { t: "bush",  x: 480, y: 404, s: 1.0 },
    { t: "palm",  x: 645, y: 402, s: 1.0 },
  ];

  // Forma orgânica fechada (litoral irregular) centrada em (cx,cy)
  function mapBlob(cx, cy, rx, ry, wob, ph) {
    const N = 46;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 1 + Math.sin(a * 3 + ph) * wob + Math.sin(a * 5 + ph * 1.7) * (wob * 0.5);
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function mapShadow(x, footY, w) {
    ctx.fillStyle = "rgba(20,60,20,.16)";
    ctx.beginPath(); ctx.ellipse(x, footY, w, w * 0.38, 0, 0, 7); ctx.fill();
  }
  function mapTree(x, footY, s, dark) {
    mapShadow(x, footY, 15 * s);
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(x - 3 * s, footY - 16 * s, 6 * s, 16 * s);
    ctx.fillStyle = dark ? "#276a34" : "#3f9a3c";
    ctx.beginPath(); ctx.arc(x, footY - 24 * s, 15 * s, 0, 7); ctx.fill();
    ctx.fillStyle = dark ? "#2f7a3e" : "#57b04b";
    ctx.beginPath();
    ctx.arc(x - 9 * s, footY - 19 * s, 11 * s, 0, 7);
    ctx.arc(x + 9 * s, footY - 19 * s, 11 * s, 0, 7);
    ctx.arc(x, footY - 31 * s, 12 * s, 0, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.20)";
    ctx.beginPath(); ctx.arc(x - 4 * s, footY - 31 * s, 5 * s, 0, 7); ctx.fill();
  }
  function mapBush(x, footY, s) {
    mapShadow(x, footY, 16 * s);
    ctx.fillStyle = "#3f9a3c";
    ctx.beginPath();
    ctx.arc(x - 9 * s, footY - 6 * s, 9 * s, 0, 7);
    ctx.arc(x + 9 * s, footY - 6 * s, 9 * s, 0, 7);
    ctx.arc(x, footY - 11 * s, 11 * s, 0, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath(); ctx.arc(x - 3 * s, footY - 12 * s, 4 * s, 0, 7); ctx.fill();
  }
  function mapPalm(x, footY, s) {
    mapShadow(x, footY, 15 * s);
    ctx.strokeStyle = "#a9762f"; ctx.lineWidth = 5 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, footY); ctx.quadraticCurveTo(x - 6 * s, footY - 18 * s, x - 2 * s, footY - 30 * s); ctx.stroke();
    const top = { x: x - 2 * s, y: footY - 30 * s };
    ctx.fillStyle = "#3f9a3c";
    for (const [dx, dy] of [[-18, -4], [-10, -12], [10, -12], [18, -4], [0, 6]]) {
      ctx.beginPath();
      ctx.ellipse(top.x + dx * s, top.y + dy * s, 12 * s, 5 * s, Math.atan2(dy, dx), 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = "#7a4a24";
    for (const dx of [-3, 3]) { ctx.beginPath(); ctx.arc(top.x + dx * s, top.y + 4 * s, 2.4 * s, 0, 7); ctx.fill(); }
  }
  function mapMountain(x, footY, s) {
    mapShadow(x, footY, 26 * s);
    ctx.fillStyle = "#8a8f9a";
    ctx.beginPath(); ctx.moveTo(x - 30 * s, footY); ctx.lineTo(x, footY - 42 * s); ctx.lineTo(x + 30 * s, footY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#a7abb4";
    ctx.beginPath(); ctx.moveTo(x, footY - 42 * s); ctx.lineTo(x + 30 * s, footY); ctx.lineTo(x + 8 * s, footY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";  // neve
    ctx.beginPath(); ctx.moveTo(x, footY - 42 * s); ctx.lineTo(x - 10 * s, footY - 26 * s); ctx.lineTo(x - 3 * s, footY - 30 * s); ctx.lineTo(x + 3 * s, footY - 26 * s); ctx.lineTo(x + 10 * s, footY - 28 * s); ctx.closePath(); ctx.fill();
  }
  function mapPond(x, y, s) {
    ctx.fillStyle = "#e7d29a";  // margem de areia
    ctx.beginPath(); ctx.ellipse(x, y, 34 * s, 20 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2f8fd6";
    ctx.beginPath(); ctx.ellipse(x, y, 27 * s, 14 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.ellipse(x - 8 * s, y - 4 * s, 8 * s, 3 * s, -0.4, 0, 7); ctx.fill();
  }
  function mapCastle(x, footY, s) {
    mapShadow(x, footY, 26 * s);
    const bw = 44 * s, bh = 34 * s, bx = x - bw / 2, by = footY - bh;
    ctx.fillStyle = "#c9a26b"; ctx.fillRect(bx, by, bw, bh);           // corpo
    for (const tx of [bx - 8 * s, bx + bw - 6 * s]) ctx.fillRect(tx, by - 16 * s, 14 * s, bh + 16 * s); // torres
    ctx.fillStyle = "#b48a52";                                        // ameias
    for (let i = 0; i < 5; i++) ctx.fillRect(bx + 2 * s + i * 9 * s, by - 6 * s, 5 * s, 6 * s);
    ctx.fillStyle = "#6e4c22"; ctx.fillRect(x - 7 * s, by + 12 * s, 14 * s, bh - 12 * s); // portão
    ctx.fillStyle = "#e63b2e";                                        // bandeirinhas
    for (const tx of [bx - 1 * s, bx + bw + 5 * s]) {
      ctx.fillRect(tx, by - 30 * s, 1.6 * s, 14 * s);
      ctx.beginPath(); ctx.moveTo(tx + 1.6 * s, by - 30 * s); ctx.lineTo(tx + 11 * s, by - 26 * s); ctx.lineTo(tx + 1.6 * s, by - 22 * s); ctx.fill();
    }
  }
  function mapBird(x, y, s) {
    ctx.strokeStyle = "rgba(40,60,80,.55)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y); ctx.quadraticCurveTo(x - 2 * s, y - 4 * s, x, y);
    ctx.quadraticCurveTo(x + 2 * s, y - 4 * s, x + 6 * s, y); ctx.stroke();
  }

  function drawMap() {
    const T = performance.now() / 1000;
    // --- oceano ---
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2f7fc0"); g.addColorStop(1, "#57a9e6");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ondinhas animadas sobre o mar (cobertas depois pelo continente)
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
      const x = 30 + c * 82 + (r % 2) * 40, y = 30 + r * 78, ph = Math.sin(T * 1.4 + r + c * 0.7) * 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x - 4, y - 3 - ph, x, y);
      ctx.quadraticCurveTo(x + 4, y + 3 + ph, x + 9, y); ctx.stroke();
    }
    // nuvens e aves decorando o mar (nas bordas)
    ctx.fillStyle = "rgba(255,255,255,.8)";
    cloud(40 + Math.sin(T * 0.3) * 6, 34); cloud(690 + Math.cos(T * 0.25) * 6, 30);
    mapBird(120, 46, 1); mapBird(140, 52, 0.8); mapBird(700, 410, 1); mapBird(725, 418, 0.8);

    // --- continente (praia + grama) ---
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ecd79a"; mapBlob(400, 236, 366, 168, 0.045, 0.6); ctx.fill();   // areia/litoral
    ctx.restore();
    ctx.fillStyle = "#6fae54"; mapBlob(400, 236, 344, 150, 0.05, 0.6); ctx.fill();    // grama
    ctx.fillStyle = "rgba(255,255,255,.08)"; mapBlob(400, 222, 320, 128, 0.05, 0.6); ctx.fill(); // luz no topo

    // --- caminho ligando os nós (com contorno) ---
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(120,86,30,.55)"; ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(MAP_NODES[0].x, MAP_NODES[0].y);
    for (let i = 1; i < MAP_NODES.length; i++) ctx.lineTo(MAP_NODES[i].x, MAP_NODES[i].y);
    ctx.stroke();
    ctx.strokeStyle = "#efdca6"; ctx.lineWidth = 10; ctx.stroke();
    // trecho já concluído em tom mais quente
    if (unlocked > 0) {
      ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(MAP_NODES[0].x, MAP_NODES[0].y);
      for (let i = 1; i <= Math.min(unlocked, MAP_NODES.length - 1); i++) ctx.lineTo(MAP_NODES[i].x, MAP_NODES[i].y);
      ctx.stroke();
    }
    // pontilhado central
    ctx.strokeStyle = "rgba(150,110,40,.5)"; ctx.lineWidth = 2; ctx.setLineDash([2, 12]);
    ctx.beginPath(); ctx.moveTo(MAP_NODES[0].x, MAP_NODES[0].y);
    for (let i = 1; i < MAP_NODES.length; i++) ctx.lineTo(MAP_NODES[i].x, MAP_NODES[i].y);
    ctx.stroke(); ctx.setLineDash([]);

    // --- decorações ---
    for (const d of MAP_DECOR) {
      if (d.t === "tree")   mapTree(d.x, d.y, d.s, false);
      else if (d.t === "tree2") mapTree(d.x, d.y, d.s, true);
      else if (d.t === "bush")  mapBush(d.x, d.y, d.s);
      else if (d.t === "palm")  mapPalm(d.x, d.y, d.s);
      else if (d.t === "mtn")   mapMountain(d.x, d.y, d.s);
      else if (d.t === "pond")  mapPond(d.x, d.y, d.s);
      else if (d.t === "castle")mapCastle(d.x, d.y, d.s);
    }

    // --- nós (medalhões das fases) ---
    for (let i = 0; i < MAP_NODES.length; i++) {
      const n = MAP_NODES[i], open = i <= unlocked, done = i < unlocked, cur = i === unlocked, sel = i === mapSel;
      const R = 20;
      // sombra
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath(); ctx.ellipse(n.x, n.y + R - 2, R * 0.9, R * 0.42, 0, 0, 7); ctx.fill();
      // disco
      ctx.fillStyle = done ? "#39c463" : (open ? WORLD_COLOR[n.world] : "#8a8f9a");
      ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, 7); ctx.fill();
      // brilho superior
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.beginPath(); ctx.ellipse(n.x, n.y - R * 0.4, R * 0.62, R * 0.32, 0, 0, 7); ctx.fill();
      // anel
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, 7); ctx.stroke();
      // fase atual: anel dourado pulsante
      if (cur) {
        const p = 2 + Math.sin(T * 4) * 1.5;
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(n.x, n.y, R + 4 + p, 0, 7); ctx.stroke();
      }
      // rótulo
      ctx.fillStyle = open ? "#fff" : "#e8e8e8";
      ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(open ? String(i + 1) : "🔒", n.x, n.y + 1);
      if (done) {
        ctx.fillStyle = "#0a5"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x + 15, n.y - 15, 8, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.fillText("✓", n.x + 15, n.y - 14);
      }
      // seleção: contorno branco grosso
      if (sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(n.x, n.y, R + 2, 0, 7); ctx.stroke(); }
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";

    // --- personagem no nó selecionado (com pulinho) + seta ---
    const sn = MAP_NODES[mapSel];
    const hop = Math.abs(Math.sin(T * 3)) * 6;
    if (CHARACTERS[chosen].ready) drawSprite(ctx, chosen, sn.x, sn.y - 22 - hop, 44, 1, tick * 0.05 % 6.28, false);
    ctx.fillStyle = "#ffd23f";
    const ay = sn.y - 74 - hop;
    ctx.beginPath(); ctx.moveTo(sn.x, ay + 8); ctx.lineTo(sn.x - 7, ay); ctx.lineTo(sn.x + 7, ay); ctx.closePath(); ctx.fill();

    // --- título + instrução ---
    ctx.fillStyle = "rgba(0,0,0,.5)"; roundRect(W / 2 - 176, 12, 352, 38, 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🗺️ Fase " + (mapSel + 1) + "/15 · " + WORLD_NAME[MAP_NODES[mapSel].world], W / 2, 31);
    ctx.fillStyle = "rgba(0,0,0,.4)"; roundRect(W / 2 - 150, H - 34, 300, 26, 9); ctx.fill();
    ctx.font = "14px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillText("← →  escolher fase   ·   ↑ / ▲  entrar", W / 2, H - 20);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
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

  // Tocar num nó do mapa seleciona/entra na fase (se desbloqueada)
  function onMapTap(clientX, clientY) {
    if (state !== "map") return;
    const rect = canvas.getBoundingClientRect();
    const cx = (clientX - rect.left) * (canvas.width / rect.width);
    const cy = (clientY - rect.top) * (canvas.height / rect.height);
    for (let i = 0; i < MAP_NODES.length; i++) {
      const n = MAP_NODES[i];
      if (i <= unlocked && Math.hypot(cx - n.x, cy - n.y) < 24) {
        if (window.Sound) window.Sound.resume();
        mapSel = i; enterLevel(i); return;
      }
    }
  }
  canvas.addEventListener("click", (e) => onMapTap(e.clientX, e.clientY));
  canvas.addEventListener("touchstart", (e) => {
    if (state === "map" && e.touches[0]) { e.preventDefault(); onMapTap(e.touches[0].clientX, e.touches[0].clientY); }
  }, { passive: false });

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
  const invincibleChk = document.getElementById("invincibleChk");

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
      invincible = !!s.invincible;
      unlocked = s.unlocked ?? unlocked;   // preserva o progresso do mapa ao salvar
      levelIdx = s.levelIdx ?? levelIdx;
      applyMute(!!s.muted);
    }
    infiniteChk.checked = infinite;
    invincibleChk.checked = invincible;
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

  invincibleChk.addEventListener("change", () => {
    invincible = invincibleChk.checked;
    if (state === "play" || state === "paused") updateHUD();
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

  // ---- Botões de pausa e menu inicial ----
  function bindTap(el, fn) {
    if (!el) return;
    el.addEventListener("click", fn);
    el.addEventListener("touchstart", (e) => { e.preventDefault(); fn(); }, { passive:false });
  }
  bindTap(pauseBtn, togglePause);
  bindTap(homeBtn, goToMenu);
  bindTap(resumeBtn, () => { if (state === "paused") togglePause(); });
  bindTap(menuBtn, goToMenu);

  msgBtn.addEventListener("click", () => {
    if (state === "levelend") {
      msgScreen.classList.add("hidden");
      openMap(unlocked);                // volta ao mapa (próxima fase desbloqueada)
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
      enterLevel: (i) => enterLevel(i),
      enterPipeNow: () => { if (pipes[0]) enterPipe(pipes[0]); },
      hitBlock: () => { const q = solids.find(s => s.type === "question" && !s.used); if (q) hitQuestionBlock(q); },
      fireballs: () => fireballs,
      powerups: () => powerups,
      coins: () => coins,
      enemies: () => enemies,
      solids: () => solids,
      pipes: () => pipes,
      flag: () => flag,
      get sliding() { return !!flagAnim; },
      get state() { return state; },
      get levelH() { return levelH; },
      get levelW() { return levelW; },
      get underground() { return underground; },
      get unlocked() { return unlocked; },
      setUnlocked: (n) => { unlocked = n; },
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
