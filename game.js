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
  // Escolhe a faixa: arena de chefao toca Castle Theme; demais tocam Ground Theme.
  const musicStart = () => {
    if (!window.Sound) return;
    if (stageIsBoss(levelIdx) && window.Sound.startCastleMusic) window.Sound.startCastleMusic();
    else window.Sound.startMusic();
  };
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
.........?...................................BBB.B..............................
......BBB..........E...............BB..............................F.............
...........................?..............E...............BBB.....G.............
..P.....E..........BBB.........E.......?.......E....?.....E.......G..............
GGGGGGGGGGGGGGGGGG....GGGGGGGGGGGGGGG..GGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGG`,

`................................................................................
.............?..?..?..?.........................................................
............B.BB.BB...................?.?.?.....................................
.......................................B.B......................................
....?...............E.....E.......................E.....E.......F...............
...B.......?.................B............?.?.........BBBB......G................
.........B..B.....................E..............B.............G................
..P..E..........BB.....?.....E..........BB..E.........?...E....G................
GGGGGGGGGG..GGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
................................................................................
............???...........????..............???.................................
...................???..........................................................
.....................................???........................................
.............................BBB................................................
..P..................................................E...E................F.....
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
.................................?????..........................................
........................................................?????...................
................BBB............BBBB..............????...........................
..................................................???...........................
................................................................................
..P...........E..E................E.......................................F.....
GGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGG...GGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
................................................................................
..............................???.............................BBBB..............
...........................BB..............????...............?????.............
.........................................................???....???.............
................................................................................
..P................E..........E............E..............................F.....
GGGGGGGGGGGGGGG...GGGGGG...GGGGGGGGGGGGGG..GGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
....................???.....???.................................................
................................???.............................................
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
.........................????.......???...........???...........................
................................................................................
..P...................E..........E..............E.........................F.....
GGGGGGGGGGGGG...GGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
............................................???..????...........................
..............................???....?????......................................
...........................???..................................................
...........????.....???..........................BBBB...........................
................................................................................
..P.....................E...........E..E..................................F.....
GGGGGGGGGGGGGGGGGGGG...GGGGGGG..GGGGGGGG...GGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
........................?????.....??????........................................
..............................???...............................................
.................................................BBBBB..???...???...............
................................................................................
..............BBBB..............................................................
..P............E.......................................E..................F.....
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
....................................???......???????............................
.............???............................................???.................
.................................????.................BBBB......................
.............................BBBB...............................................
................................................................................
..P.................E.....................E.......E.......................F.....
GGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGG..GGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
...........?????.????...................................???.....................
..............????................????.???......................................
................................................................................
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
............???.................................................................
....................???..............BBB.......???.....???.???..................
.......................BBB......................................................
..P.............E.......................................E..E..............F.....
GGGGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGG..GGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGG`,
`................................................................................
................................................................................
................................................................................
.........................???.........???.............???........................
...............????...................???.......................................
.................................?BBBB...................B......................
.................................???...............????.........................
................................................................................
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
    else if (type === "egg")
      // ovo de avestruz: fica parado até ser tocado; chocando quando coletado
      powerups.push({ x:x+8, y:y+8, w:24, h:28, type:"egg", vx:0, vy:0, taken:false, phase:Math.random()*6.28 });
    else
      // fire | fly | star — flores estaticas (a coleta cuida do efeito)
      powerups.push({ x:x+6, y:y+6, w:28, h:30, type, vx:0, vy:0, taken:false, phase:Math.random()*6.28 });
  }

  // Blocos "?" por fase: soltam um item quando o jogador dá uma cabeçada por baixo.
  // Posições validadas: bloco flutuando com espaço vazio embaixo (acessível
  // por cabeçada). Nunca colocar sobre outro bloco (ficaria inacessível).
  const QBLOCKS_BY_LEVEL = [
    [ {col:6,  row:6, item:"mushroom"}, {col:22, row:6, item:"star"}, {col:37, row:6, item:"fire"}, {col:27, row:6, item:"egg"} ],
    [ {col:11, row:5, item:"mushroom"}, {col:22, row:5, item:"star"}, {col:39, row:5, item:"fly"},  {col:16, row:5, item:"egg"} ],
    [ {col:6,  row:5, item:"mushroom"}, {col:21, row:5, item:"star"}, {col:37, row:5, item:"fire"}, {col:15, row:5, item:"egg"} ],
    [{"col":8,"row":6,"item":"mushroom"},{"col":24,"row":6,"item":"star"},{"col":41,"row":6,"item":"fire"},{"col":18,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":26,"row":6,"item":"star"},{"col":48,"row":6,"item":"fly"}, {"col":18,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":28,"row":6,"item":"star"},{"col":55,"row":6,"item":"fire"},{"col":19,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":27,"row":6,"item":"star"},{"col":54,"row":6,"item":"fly"}, {"col":19,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":29,"row":6,"item":"star"},{"col":59,"row":6,"item":"fire"},{"col":20,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":28,"row":6,"item":"star"},{"col":57,"row":6,"item":"fly"}, {"col":20,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":25,"row":6,"item":"star"},{"col":47,"row":6,"item":"fire"},{"col":18,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":26,"row":6,"item":"star"},{"col":50,"row":6,"item":"fly"}, {"col":18,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":23,"row":6,"item":"star"},{"col":41,"row":6,"item":"fire"},{"col":17,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":27,"row":6,"item":"star"},{"col":53,"row":6,"item":"fly"}, {"col":15,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":26,"row":6,"item":"star"},{"col":51,"row":6,"item":"fire"},{"col":19,"row":6,"item":"egg"}],
    [{"col":8,"row":6,"item":"mushroom"},{"col":24,"row":6,"item":"star"},{"col":43,"row":6,"item":"fly"}, {"col":17,"row":6,"item":"egg"}]
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
G.....................................................................G
G.P..?............?............?............?............?..........X..G
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`;

  // ============================================================
  //  FASES E CHEFÕES  (20 estágios: 3 fases temáticas + 1 chefão por mundo)
  // ============================================================
  const STAGES_PER_WORLD = 4;               // 3 fases + 1 arena de chefão
  const NUM_STAGES = 20;
  const BOSS_TYPES = ["brutao", "bocao", "assombro", "cavucao", "dragao"];
  const BOSS_NAMES = {
    brutao: "Brutão", bocao: "Bocão", assombro: "Assombro",
    cavucao: "Cavucão", dragao: "Rei Dragão",
  };
  function worldOf(i)     { return Math.floor(i / STAGES_PER_WORLD); }
  function stageIsBoss(i) { return i % STAGES_PER_WORLD === STAGES_PER_WORLD - 1; }
  function themedIndex(i) { return worldOf(i) * 3 + (i % STAGES_PER_WORLD); }  // só p/ fases normais

  // Fase do chefão (castelo): trecho de travessia com perigos (poças de lava,
  // gêiseres de lava saltitante, espinhos no teto/chão em zigue-zague, inimigos)
  // e, ao final, a sala do chefão. Legenda:
  //   L lava (mortal) · J gêiser de lava (dispara jatos p/ cima)
  //   ^ espinho no chão · v espinho no teto · E inimigo · B tijolo · G chão
  //   P início · Z chefão
  function buildArena(opts) {
    opts = opts || {};
    const AW = 62, AH = 10, g = AH - 1;
    const rows = Array.from({ length: AH }, () => Array(AW).fill("."));
    // teto e paredes
    for (let c = 0; c < AW; c++) rows[0][c] = "B";
    for (let r = 0; r < AH; r++) { rows[r][0] = "B"; rows[r][AW - 1] = "B"; }
    // chão inteiro
    for (let c = 0; c < AW; c++) rows[g][c] = "G";

    // ---- Travessia (cols 1..44) ----
    // poças de lava no chão (mortais, exigem pulo)
    for (const c of [9, 10, 24, 25, 38, 39]) rows[g][c] = "L";
    // gêiseres de lava saltitante (jatos periódicos p/ cima)
    for (const c of [15, 32]) rows[g - 1][c] = "J";
    // espinhos no teto em zigue-zague (alternando alturas, sem ficar acima
    // de lava, plataforma segura ou gêiser — dá margem para o pulo do jogador)
    for (const c of [6, 22, 36])  rows[2][c] = "v";
    for (const c of [14, 30, 44]) rows[3][c] = "v";
    // espinhos no chão espalhados pela rota
    for (const c of [19, 28, 43])         rows[g - 1][c] = "^";
    // plataformas seguras (pedras de passagem sobre as lavas)
    for (const c of [11, 12])             rows[5][c] = "B";
    for (const c of [26, 27])             rows[5][c] = "B";
    for (const c of [40, 41])             rows[5][c] = "B";
    // inimigos ao longo da travessia
    for (const c of [7, 22, 36])          rows[g - 1][c] = "E";

    // ---- Sala do chefão (cols 45..AW-2) ----
    // fosso de lava separa a travessia da arena do chefão
    rows[g][45] = "L"; rows[g][46] = "L";
    // lava nas laterais da arena (contém o chefão)
    rows[g][AW - 3] = "L"; rows[g][AW - 2] = "L";
    // espinhos na parede do fundo
    for (const r of [5, 6]) rows[r][AW - 2] = "^";
    // plataformas na arena (para chefões que exigem manobra vertical)
    if (opts.platforms) {
      for (const c of [50, 51, 52]) rows[5][c] = "B";
      for (const c of [55, 56, 57]) rows[5][c] = "B";
    }

    rows[g - 1][2] = "P";
    rows[g - 1][opts.bossCol || 55] = "Z";
    return rows.map(r => r.join("")).join("\n");
  }
  const BOSS_ARENAS = [
    buildArena({ bossCol: 55 }),                    // Brutão
    buildArena({ bossCol: 53, platforms: true }),   // Bocão
    buildArena({ bossCol: 56, platforms: true }),   // Assombro
    buildArena({ bossCol: 55 }),                    // Cavucão
    buildArena({ bossCol: 57 }),                    // Rei Dragão
  ];



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
  // Invencibilidade temporária (flor roxa): expira automaticamente.
  let starUntil = 0;             // timestamp ms; enquanto Date.now() < starUntil, esta ativo
  let starTimeoutId = null;      // handle do timeout que retoma a musica normal
  const STAR_MS = 10000;         // duracao do power-up
  const starActive = () => Date.now() < starUntil;
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
  let enemyShots = [];          // projéteis dos inimigos atiradores
  let _enemyIdx = 0;            // contador p/ variar o tipo de inimigo na fase
  let boss = null;              // chefão da arena (um por estágio de chefão)
  let bossShots = [];           // projéteis do chefão {type,x,y,w,h,vx,vy,g,...}
  let lavas = [];               // poças de lava (mortais) na arena de chefão
  let spikes = [];              // espinhos {x,y,w,h,dir:"left"|"right"|"up"|"down"}
  let geysers = [];             // gêiseres de lava saltitante (dispara jatos p/ cima)
  let lavaShots = [];           // jatos de lava lançados por gêiseres (dano/morte)
  let bossStage = false;        // o estágio atual é uma arena de chefão?
  let levelW = 0, levelH = 0;
  let cameraX = 0;
  let particles = [];
  let tick = 0;               // contador global de quadros (animação/piscar)
  let pipeCd = 0;             // recarga após entrar/sair de cano (evita re-entrar na hora)

  const player = {
    x:0, y:0, w:30, h:38, vx:0, vy:0,
    onGround:false, face:1, walk:0, dead:false, deadT:0, blink:0, spawnX:0, spawnY:0,
    power:"small",            // small | big | fire | fly
    mount:null,               // null | { peck, peckCd, fart, fartCd, walk } — avestruz
    invuln:0,                 // quadros de invulnerabilidade após tomar dano
    fireCd:0,                 // recarga do tiro de fogo
    safeX:0, safeY:0          // última posição segura no chão (modo invencível)
  };

  // Tamanho do jogador quando montado no avestruz (independe do poder).
  const MOUNT_SIZE = { w:44, h:74 };
  const OSTRICH_JUMP = -14.8;   // pulo mais alto montado
  const OSTRICH_MAX_VX = 5.4;   // corre um pouco mais rápido
  const PECK_RANGE = 30;        // alcance da bicada (à frente)
  const FART_RANGE = 16;        // alcance do "pum" (atrás) — ~1cm na tela
  const FART_LIFE  = 130;       // duração da nuvem (frames) — quase 2s
  let fartClouds = [];          // {x,y,w,h,life,maxLife,vx} nuvens tóxicas atrás
  let ostrichRunaways = [];     // {x,y,vx,vy,life} avestruzes que fugiram após dano
  let shakeT = 0;               // frames restantes de tremor de tela
  let shakeMag = 0;             // magnitude atual do tremor (pixels)

  // Troca o poder ajustando o tamanho, mantendo os pés no chão e o centro.
  function setPower(np) {
    const s = player.mount ? MOUNT_SIZE : sizeFor(np);
    player.y += player.h - s.h;
    player.x += (player.w - s.w) / 2;
    player.w = s.w; player.h = s.h; player.power = np;
  }
  // Sobe no avestruz (aumenta o hitbox mantendo os pés no chão).
  function mountUp() {
    const p = player;
    if (p.mount) { score += 500; updateHUD(); return; }   // já montado: bônus
    const oldW = p.w, oldH = p.h;
    p.y -= (MOUNT_SIZE.h - oldH);
    p.x += (oldW - MOUNT_SIZE.w) / 2;
    p.w = MOUNT_SIZE.w; p.h = MOUNT_SIZE.h;
    p.mount = { peck:0, peckCd:0, fart:0, fartCd:0, walk:0 };
    snd("powerup");
  }
  // Desce do avestruz. Se runAway=true, ele foge assustado (após levar dano).
  function dismount(runAway) {
    const p = player;
    if (!p.mount) return;
    const s = sizeFor(p.power);
    const centerX = p.x + p.w/2;
    const feetY = p.y + p.h;
    p.mount = null;
    p.w = s.w; p.h = s.h;
    p.x = centerX - s.w/2;
    p.y = feetY - s.h;
    if (runAway) {
      ostrichRunaways.push({ x:p.x - 10, y:p.y, vx:-p.face * 3.6, vy:-6, life:80 });
    }
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
    boss = null; bossShots = []; lavas = []; spikes = []; geysers = []; lavaShots = []; bossStage = false;
    fartClouds = []; ostrichRunaways = [];
    if (player.mount) dismount(false);   // avestruz não persiste entre fases/morte
    enemyShots = [];   // _enemyIdx acumula entre fases p/ variar melhor os tipos
  }

  // Cria um inimigo com tipo/velocidade conforme a dificuldade da fase.
  // O elenco cresce por mundo: andarilho → pulador → atirador → voador → espinho.
  // Elenco de inimigos por mundo (vai ganhando tipos e dificuldade).
  // 16 tipos, cada um com um comportamento diferente (anda, pula, atira, voa…).
  const ENEMY_BY_WORLD = [
    ["walker", "hopper", "roller"],                    // mundo 1
    ["jumper", "lobber", "splitter"],                  // mundo 2
    ["shooter", "charger", "drifter"],                 // mundo 3
    ["flyer", "diver", "zigzag", "turret"],            // mundo 4
    ["spiker", "bomber", "spitter"],                   // mundo 5
  ];
  function enemyPool(stageIdx) {
    let pool = [];
    for (let i = 0; i <= worldOf(stageIdx); i++) pool = pool.concat(ENEMY_BY_WORLD[i]);
    return pool;
  }
  function makeEnemy(x, y, stageIdx) {
    // Metade dos inimigos vem do mundo atual (garante que os tipos novos
    // apareçam) e metade do acervo acumulado (variedade).
    const full = enemyPool(stageIdx), cur = ENEMY_BY_WORLD[worldOf(stageIdx)];
    const list = (_enemyIdx % 2 === 0) ? cur : full;
    const type = list[_enemyIdx % list.length];
    _enemyIdx++;
    const mul = 1 + stageIdx * 0.03;                 // fica mais rápido a cada fase
    const dir = Math.random() < 0.5 ? -1 : 1;
    const gy = y + 6;
    const e = { x:x+4, y:gy, w:32, h:32, vx:0, vy:0, alive:true, squash:0, t:(_enemyIdx*17) % 60, type };
    switch (type) {
      case "walker":   e.vx = dir*0.9*mul; break;
      case "hopper":   Object.assign(e, { w:28, h:28, vx:dir*0.7*mul, jump:true, jumpEvery: Math.max(34, 56 - stageIdx), jumpVy:-7 }); break;
      case "roller":   Object.assign(e, { w:30, h:30, vx:dir*1.9*mul, roller:true }); break;
      case "jumper":   Object.assign(e, { w:30, h:30, vx:dir*0.8*mul, jump:true, chase:true, jumpEvery: Math.max(56, 118 - stageIdx*3), jumpVy:-10 }); break;
      case "lobber":   Object.assign(e, { w:34, h:30, lob:true, shootEvery: Math.max(66, 150 - stageIdx*4), scd:60 }); break;
      case "splitter": Object.assign(e, { w:34, h:30, vx:dir*0.8*mul, split:true }); break;
      case "shooter":  Object.assign(e, { vx:dir*0.5*mul, shoot:true, shootEvery: Math.max(60, 150 - stageIdx*5), shotSpeed: 3 + stageIdx*0.14, scd:70 }); break;
      case "charger":  Object.assign(e, { w:34, h:30, vx:dir*0.7*mul, patrolVx:dir*0.7*mul, charger:true, range:220, cd:60, charge:0 }); break;
      case "drifter":  Object.assign(e, { w:30, h:30, fly:true, hover:true }); break;
      case "flyer":    Object.assign(e, { w:30, h:26, y:gy - TILE*2, baseY:gy - TILE*2, vx:dir*1.3*mul, fly:true, ph:Math.random()*6.28, amp:24 }); break;
      case "diver":    Object.assign(e, { w:30, h:28, y:gy - TILE*3, baseY:gy - TILE*3, vx:dir*1.2*mul, fly:true, diver:true, phase:"cruise", amp:14 }); break;
      case "zigzag":   Object.assign(e, { w:28, h:26, y:gy - TILE*2, baseY:gy - TILE*2, vx:dir*1.4*mul, fly:true, zig:true }); break;
      case "turret":   Object.assign(e, { w:32, h:28, spiky:true, shoot:true, shootEvery: Math.max(56, 140 - stageIdx*4), shotSpeed: 3.4 + stageIdx*0.14, scd:50 }); break;
      case "spiker":   Object.assign(e, { w:32, h:30, vx:dir*0.8*mul, spiky:true }); break;
      case "bomber":   Object.assign(e, { w:34, h:26, y:gy - TILE*3, baseY:gy - TILE*3, vx:dir*1.5*mul, fly:true, bomber:true, amp:10, scd:70, shootEvery: Math.max(48, 110 - stageIdx*3) }); break;
      case "spitter":  Object.assign(e, { w:34, h:30, spread:true, shootEvery: Math.max(70, 150 - stageIdx*4), scd:80 }); break;
    }
    return e;
  }

  function loadLevel(idx) {
    const isBoss = stageIsBoss(idx);
    const map = (isBoss ? BOSS_ARENAS[worldOf(idx)] : LEVELS[themedIndex(idx)]).split("\n");
    clearScene();
    underground = false;
    bossStage = isBoss;
    levelH = map.length * TILE;
    levelW = map[0].length * TILE;
    let bossSpawn = null;

    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const ch = map[r][c];
        const x = c * TILE, y = r * TILE;
        if (ch === "G" || ch === "B") {
          solids.push({ x, y, w:TILE, h:TILE, type: ch === "G" ? "ground" : "brick" });
        } else if (ch === "?") {
          coins.push({ x:x+10, y:y+8, w:20, h:24, taken:false, phase:Math.random()*6.28 });
        } else if (ch === "E") {
          enemies.push(makeEnemy(x, y, idx));
        } else if (ch === "M") { spawnPowerup("mushroom", x, y);
        } else if (ch === "R") { spawnPowerup("fire", x, y);
        } else if (ch === "V") { spawnPowerup("fly", x, y);
        } else if (ch === "L") {
          lavas.push({ x, y:y + 10, w:TILE, h:TILE - 10 });      // poça de lava (mortal)
        } else if (ch === "^") {
          // Espinho na parede/chão: se estiver colado a uma parede, aponta p/ dentro;
          // caso contrário, aponta p/ cima (chão). O dir é decidido pela vizinhança.
          const onLeftWall  = c === 0;
          const onRightWall = c === map[r].length - 1;
          const dir = onLeftWall ? "left" : onRightWall ? "right" : "up";
          spikes.push({ x, y, w:TILE, h:TILE, dir });
        } else if (ch === "v") {
          spikes.push({ x, y, w:TILE, h:TILE, dir:"down" });     // espinho no teto
        } else if (ch === "J") {
          // Gêiser: dispara jatos de lava para cima em intervalos regulares.
          geysers.push({ x:x + TILE/2, y:y + TILE, t: (geysers.length*37) % 90, cd: 130 });
        } else if (ch === "Z") {
          bossSpawn = { x, y };
        } else if (ch === "F") {
          flag = { x:x+16, y:y - TILE*2, w:8, h:TILE*3 };
        } else if (ch === "P") {
          player.spawnX = x; player.spawnY = y;
        }
      }
    }
    if (isBoss) {
      if (bossSpawn) spawnBoss(BOSS_TYPES[worldOf(idx)], bossSpawn.x);
      respawnPlayer(false);
      cameraX = 0;
      return;   // arenas de chefão não têm power-ups/blocos/canos
    }
    (POWERUPS_BY_LEVEL[themedIndex(idx)] || []).forEach(pu => spawnPowerup(pu.type, pu.col * TILE, pu.row * TILE));
    // blocos "?" (soltam item na cabeçada). Proteção dupla:
    //  (a) nunca colocar SOBRE outro sólido — a colisão hit-the-brick vence
    //      antes da cabeçada no "?", deixando o bloco visualmente ativo mas
    //      sem responder à cabeçada.
    //  (b) nunca colocar com sólido DIRETAMENTE ABAIXO — o jogador não teria
    //      espaço para pular por baixo e a cabeçada é impossível.
    (QBLOCKS_BY_LEVEL[themedIndex(idx)] || []).forEach(q => {
      const bx = q.col * TILE, by = q.row * TILE;
      const atRect    = { x:bx, y:by,          w:TILE, h:TILE };
      const belowRect = { x:bx, y:by + TILE,   w:TILE, h:2    };
      const bad = solids.some(s => rectsOverlap(atRect, s) || rectsOverlap(belowRect, s));
      if (bad) return;
      solids.push({ x:bx, y:by, w:TILE, h:TILE, type:"question", item:q.item, used:false, bump:0 });
    });
    // canos gigantes (2x2 tiles) que levam ao subterrâneo. Proteção: não
    // colocar se o corpo do cano se sobrepõe a algum bloco existente (viraria
    // parede/entrada bloqueada).
    (PIPES_BY_LEVEL[themedIndex(idx)] || []).forEach(p => {
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
          enemies.push({ x:x+4, y:y+6, w:30, h:24, vx:(Math.random()<.5?-1:1)*1.3, vy:0, baseY:y+6, alive:true, squash:0, type:"bat", fly:true, amp:26, ph:Math.random()*6.28 });
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
    // Music de fim de fase — substitui a musica normal a partir daqui e continua
    // tocando durante o slide, o hop e a tela de mensagem (nao chamamos musicStop
    // em completeLevel pra deixar o mp3 terminar naturalmente).
    if (window.Sound && window.Sound.startLevelCompleteMusic) window.Sound.startLevelCompleteMusic();
    else musicStop();
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
    // Nao paramos a musica aqui: a Level Complete Theme comecou em startFlagpole
    // e deve tocar ate o fim (ou ate o proximo stage carregar via musicStart).
    // Tambem removemos o snd("levelclear") pra nao conflitar com o mp3.
    unlocked = Math.max(unlocked, Math.min(levelIdx + 1, NUM_STAGES - 1));
    const wasBoss = stageIsBoss(levelIdx);
    if (levelIdx + 1 >= NUM_STAGES) {
      state = "win";
      saveProgress();   // jogo concluído
      showMsg("🏆 Você venceu!", `Parabéns! ${CHARACTERS[chosen].name} derrotou o Rei Dragão e salvou o reino. Pontuação final: ${score} 🍎`, "🔁 Jogar de novo");
    } else {
      state = "levelend";
      saveProgress();
      const t = wasBoss ? "👑 Chefão derrotado!" : "✔ Fase concluída!";
      showMsg(t, `Fase ${levelIdx + 2} desbloqueada no mapa! Pontuação: ${score} 🍎`, "🗺️ Ir ao mapa");
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
    if ($btnFire) $btnFire.classList.toggle("hidden", player.power !== "fire" && !player.mount);
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  function update() {
    if (state !== "play") return;
    tick++;
    if (shakeT > 0) { shakeT--; shakeMag *= 0.9; if (shakeT === 0) shakeMag = 0; }

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
    const maxVx = p.mount ? OSTRICH_MAX_VX : MAX_VX;
    p.vx = Math.max(-maxVx, Math.min(maxVx, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    // Jump (mais alto quando com power-up; ainda mais alto montado)
    if (keys.jump && p.onGround) {
      p.vy = p.mount ? OSTRICH_JUMP : ((p.power === "small") ? JUMP_VY : POWER_JUMP);
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

    // Tiro de fogo (flor de fogo 🔥) OU bicada do avestruz (F/X)
    if (p.fireCd > 0) p.fireCd--;
    if (keys.fire) {
      if (p.mount && p.mount.peckCd <= 0) {
        ostrichPeck();
        p.mount.peckCd = 22;
      } else if (p.power === "fire" && p.fireCd <= 0) {
        shootFireball();
        p.fireCd = FIRE_COOLDOWN;
      }
    }
    keys.fire = false;
    if (p.invuln > 0) p.invuln--;
    if (p.mount) updateMount(p);

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
    updateEnemyShots();
    if (bossStage) { updateBoss(); updateBossShots(); updateGeysers(); updateLavaShots(); checkHazards(); }
    updateCoins();
    updatePowerups();
    updateFireballs();
    updateFartClouds();
    updateOstrichRunaways();
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
    if (!pu) return;
    if (pu.type === "star") {
      // Brota do bloco: comeca escondida atras dele e sobe suave ate pousar em cima.
      pu.y = s.y;                            // inicia dentro/atras do bloco
      pu.emerging = 24;                      // frames restantes de "sprout"
      pu.emergeFromY = s.y;
      pu.emergeToY = s.y - pu.h;
    } else {
      pu.vy = -4;                            // demais itens: pulam pra fora
    }
  }

  function updateEnemies() {
    const p = player, pcx = p.x + p.w/2, pcy = p.y + p.h/2, floorTop = levelH - TILE;
    for (const e of enemies) {
      if (!e.alive) { e.squash = Math.max(0, e.squash - 1); continue; }
      e.t = (e.t || 0) + 1;

      if (e.fly) enemyFly(e, pcx, pcy, floorTop);
      else       enemyGround(e, pcx);

      // ataques à distância
      if (e.shoot || e.lob || e.spread) {
        e.scd = (e.scd || 0) - 1;
        if (e.scd <= 0 && Math.abs(pcx - (e.x + e.w/2)) < 380) {
          if (e.lob) lobEnemy(e); else if (e.spread) spreadEnemy(e); else shootEnemy(e);
          e.scd = e.shootEvery || 120;
        }
      }

      // Colisão com o jogador
      if (rectsOverlap(p, e) && !p.dead) {
        if (starActive()) {
          // Flor roxa: mata qualquer inimigo (inclusive espinhos) no toque.
          e.alive = false; e.squash = 16;
          score += 200; updateHUD();
          spawnPop(e.x + e.w/2, e.y + e.h/2);
          snd("stomp");
          if (e.split) spawnSplit(e);
          continue;
        }
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 20;
        if (stomping && !e.spiky) {
          e.alive = false; e.squash = 16;
          p.vy = JUMP_VY * 0.62;
          score += 100; updateHUD();
          spawnPop(e.x + e.w/2, e.y + e.h/2);
          snd("stomp");
          if (e.split) spawnSplit(e);      // divisor: vira dois pequenos
        } else {
          damagePlayer();                  // espinho (não pisável) ou toque comum
        }
      }
    }
  }

  // Física de piso + comportamentos terrestres (anda, pula, rola, investe)
  function enemyGround(e, pcx) {
    e.vy = (e.vy || 0) + GRAVITY; if (e.vy > 14) e.vy = 14;
    // investida: acelera em direção ao jogador por um instante
    if (e.charger) {
      if (e.charge > 0) { e.charge--; if (e.charge === 0) e.vx = e.patrolVx; }
      else if (e.grounded && (e.cd = (e.cd || 0) - 1) <= 0 && Math.abs(pcx - (e.x + e.w/2)) < e.range) {
        e.charge = 42; e.cd = 130; e.vx = (pcx < e.x + e.w/2 ? -1 : 1) * 4.6;
      }
    }
    e.x += e.vx;
    for (const s of solids) if (rectsOverlap(e, s)) { if (e.vx > 0) e.x = s.x - e.w; else e.x = s.x + s.w; e.vx *= -1; }
    e.y += e.vy;
    let grounded = false;
    for (const s of solids) if (rectsOverlap(e, s)) { if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; grounded = true; } else { e.y = s.y + s.h; e.vy = 0; } }
    e.grounded = grounded;
    if (e.jump && grounded && e.t % (e.jumpEvery || 100) === 0) {
      e.vy = e.jumpVy || -9.5;
      if (e.chase) e.vx = Math.abs(e.vx || 0.8) * (pcx < e.x + e.w/2 ? -1 : 1);
    }
    // vira nas beiras (o "roller" NÃO — ele despenca; e não vira durante a investida)
    const canLedgeTurn = grounded && e.vy === 0 && !e.roller && !(e.charger && e.charge > 0);
    if (canLedgeTurn) {
      const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2, footY = e.y + e.h + 4;
      let floor = false;
      for (const s of solids) if (aheadX >= s.x && aheadX <= s.x + s.w && footY >= s.y && footY <= s.y + s.h) { floor = true; break; }
      if (!floor && e.vx) e.vx *= -1;
    }
    if (e.y > levelH + 80) e.alive = false;
  }

  // Comportamentos aéreos (senoidal, pairar/perseguir, mergulhar, zigue-zague, bombardear)
  function enemyFly(e, pcx, pcy, floorTop) {
    if (e.hover) {                          // pairador: persegue o jogador pelo ar
      const dx = pcx - (e.x + e.w/2), dy = pcy - (e.y + e.h/2), d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * 1.15; e.y += dy / d * 0.95;
    } else if (e.diver) {                   // mergulhador: cruza e mergulha no jogador
      e.x += e.vx;
      if (e.x < TILE) { e.x = TILE; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > levelW - TILE) { e.x = levelW - TILE - e.w; e.vx = -Math.abs(e.vx); }
      if (e.phase === "cruise") {
        e.y = e.baseY + Math.sin(e.t * 0.08) * e.amp;
        if (e.t % 150 === 120 && Math.abs(pcx - (e.x + e.w/2)) < 180) { e.phase = "dive"; e.dy = 2; }
      } else if (e.phase === "dive") {
        e.dy += 0.55; e.y += e.dy;
        if (e.y >= floorTop - e.h - 2) { e.y = floorTop - e.h - 2; e.phase = "rise"; }
      } else {                              // rise
        e.y -= 3; if (e.y <= e.baseY) { e.y = e.baseY; e.phase = "cruise"; }
      }
    } else if (e.zig) {                      // zigue-zague (onda triangular)
      e.x += e.vx;
      if (e.x < TILE) { e.x = TILE; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > levelW - TILE) { e.x = levelW - TILE - e.w; e.vx = -Math.abs(e.vx); }
      const tri = Math.abs(((e.t * 0.05) % 2) - 1) * 2 - 1;   // -1..1 triangular
      e.y = e.baseY + tri * 22;
    } else {                                 // voador/bombardeiro: senoidal
      e.ph = (e.ph || 0) + 0.08; e.x += e.vx;
      if (e.x < TILE) { e.x = TILE; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > levelW - TILE) { e.x = levelW - TILE - e.w; e.vx = -Math.abs(e.vx); }
      e.y = e.baseY + Math.sin(e.ph) * (e.amp || 26);
      if (e.bomber) {                        // bombardeiro: solta bombas em cima do jogador
        e.scd = (e.scd || 0) - 1;
        if (e.scd <= 0 && Math.abs(pcx - (e.x + e.w/2)) < 130) { dropBomb(e); e.scd = e.shootEvery || 90; }
      }
    }
    // pairador/zigue mantêm dentro da arena
    e.x = Math.max(TILE, Math.min(e.x, levelW - TILE - e.w));
    if (e.hover) e.y = Math.max(TILE, Math.min(e.y, floorTop - e.h + 8));
  }

  function spawnSplit(e) {   // divisor: gera dois "filhotes" andarilhos
    for (const d of [-1, 1]) enemies.push({ x:e.x + e.w/2 - 10, y:e.y, w:20, h:20, vx:d*1.7, vy:-3, alive:true, squash:0, t:0, type:"mini" });
  }

  // Projéteis de inimigos (dano ao jogador; somem em parede/limite)
  function shootEnemy(e) {   // bolt reto em direção ao jogador
    const ox = e.x + e.w/2, dir = player.x + player.w/2 < ox ? -1 : 1;
    enemyShots.push({ x:ox - 7, y:e.y + e.h*0.3, w:14, h:14, vx:dir * (e.shotSpeed || 3), vy:-0.6, t:0, kind:"bolt" });
    snd("shoot");
  }
  function lobEnemy(e) {      // arco alto (morteiro)
    const ox = e.x + e.w/2, dir = player.x + player.w/2 < ox ? -1 : 1;
    enemyShots.push({ x:ox - 8, y:e.y, w:16, h:16, vx:dir * 2.2, vy:-6.4, t:0, kind:"bomb" });
    snd("shoot");
  }
  function spreadEnemy(e) {   // leque de 3 projéteis
    const ox = e.x + e.w/2;
    for (const a of [-0.5, 0, 0.5]) enemyShots.push({ x:ox - 7, y:e.y + 2, w:14, h:14, vx:Math.sin(a) * 3.2, vy:-4.6 + Math.abs(a) * 0.6, t:0, kind:"bolt" });
    snd("shoot");
  }
  function dropBomb(e) {      // bomba que cai (bombardeiro)
    enemyShots.push({ x:e.x + e.w/2 - 7, y:e.y + e.h, w:14, h:16, vx:0, vy:0.6, t:0, kind:"bomb" });
    snd("shoot");
  }
  function updateEnemyShots() {
    for (const s of enemyShots) {
      s.t++; s.vy += 0.18; s.x += s.vx; s.y += s.vy;
      for (const so of solids) if (rectsOverlap(s, so)) { s.dead = true; break; }
      if (s.x < -30 || s.x > levelW + 30 || s.y > levelH + 40) s.dead = true;
      if (!s.dead && !player.dead && rectsOverlap(player, s)) { s.dead = true; damagePlayer(); }
    }
    enemyShots = enemyShots.filter(s => !s.dead);
  }

  // ============================================================
  //  CHEFÕES  (comportamentos inspirados nos clássicos do gênero)
  //  Arte 100% original desenhada no canvas — sem personagens de terceiros.
  // ============================================================
  function spawnBoss(type, tileX) {
    const floorTop = levelH - TILE;
    const cfg = {
      brutao:   { w:62, h:56, hp:3 },
      bocao:    { w:56, h:66, hp:3 },
      assombro: { w:60, h:60, hp:3 },
      cavucao:  { w:56, h:50, hp:3 },
      dragao:   { w:80, h:82, hp:5 },
    }[type];
    boss = {
      type, w:cfg.w, h:cfg.h, hp:cfg.hp, maxHp:cfg.hp,
      x: tileX + TILE/2 - cfg.w/2, y: floorTop - cfg.h,
      vx:0, vy:0, onFloor:false, face:-1,
      t:0, phase:"idle", pcd:0, hitFlash:0, invT:0,
      dying:false, dieT:0, frozen:false, shot:false, floorTop,
      homeY: floorTop - cfg.h,
    };
    if (type === "bocao")   { boss.phase = "down"; boss.y = floorTop + 6; }   // começa retraído
    if (type === "cavucao") { boss.phase = "under"; boss.y = floorTop + 6; }  // começa enterrado
  }

  // Física de piso para chefões que andam (gravidade + parede + beira/lava)
  function bossGround(b) {
    b.vy += GRAVITY; if (b.vy > 14) b.vy = 14;
    b.x += b.vx;
    for (const s of solids) if (rectsOverlap(b, s)) { if (b.vx > 0) b.x = s.x - b.w; else b.x = s.x + s.w; b.vx *= -1; b.face *= -1; }
    b.y += b.vy; b.onFloor = false;
    for (const s of solids) if (rectsOverlap(b, s)) { if (b.vy > 0) { b.y = s.y - b.h; b.vy = 0; b.onFloor = true; } else { b.y = s.y + s.h; b.vy = 0; } }
    if (b.onFloor) {
      const aheadX = b.vx > 0 ? b.x + b.w + 2 : b.x - 2, footY = b.y + b.h + 4;
      const solid = solids.some(s => aheadX >= s.x && aheadX <= s.x + s.w && footY >= s.y && footY <= s.y + s.h);
      const lava = lavas.some(L => aheadX >= L.x && aheadX <= L.x + L.w);
      if (!solid || lava) { b.vx *= -1; b.face *= -1; }
    }
  }

  function updateBoss() {
    const b = boss; if (!b) return;
    const p = player, pcx = p.x + p.w/2;
    b.t++; if (b.hitFlash > 0) b.hitFlash--; if (b.invT > 0) b.invT--;

    if (b.dying) {                            // derrotado: sobe e some
      b.dieT++; b.y -= 1.2;
      if (b.dieT > 80) { boss = null; completeLevel(); }
      return;
    }

    switch (b.type) {
      // Brutão (Goomba): anda e, de tempos em tempos, dá uma investida
      case "brutao": {
        if (b.phase === "idle") { b.phase = "patrol"; b.vx = (b.x + b.w/2 > pcx ? -1 : 1) * 1.4; }
        if (b.phase === "patrol") {
          if (!b.vx) b.vx = 1.4;
          bossGround(b);
          if (b.t % 200 === 190) { b.phase = "windup"; b.pcd = 26; b.vx = 0; b.face = pcx < b.x + b.w/2 ? -1 : 1; }
        } else if (b.phase === "windup") {
          b.vx = 0; bossGround(b); if (--b.pcd <= 0) { b.phase = "charge"; b.pcd = 44; b.vx = b.face * 4.6; }
        } else if (b.phase === "charge") {
          bossGround(b);
          if (--b.pcd <= 0) { b.phase = "patrol"; b.vx = b.face * 1.4; }
        }
        break;
      }
      // Bocão (planta): sobe do chão, abre a boca e cospe sementes
      case "bocao": {
        if (b.phase === "down") { b.y = b.floorTop + 6; if (b.t % 150 === 130) b.phase = "rise"; }
        else if (b.phase === "rise") { b.y -= 3; if (b.y <= b.homeY) { b.y = b.homeY; b.phase = "up"; b.pcd = 48; } }
        else if (b.phase === "up") { if (--b.pcd <= 0) { b.phase = "spit"; b.pcd = 38; b.shot = false; } }
        else if (b.phase === "spit") { if (!b.shot && b.pcd < 20) { b.shot = true; bossSpit(); } if (--b.pcd <= 0) b.phase = "retract"; }
        else if (b.phase === "retract") { b.y += 3; if (b.y >= b.floorTop + 6) { b.y = b.floorTop + 6; b.phase = "down"; b.t -= b.t % 150; } }
        break;
      }
      // Assombro (Boo): só avança quando o jogador está de costas
      case "assombro": {
        const bcx = b.x + b.w/2;
        b.frozen = ((bcx > pcx) === (p.face === 1));    // jogador olhando p/ ele -> congela
        if (b.frozen) { b.vx *= 0.7; b.vy *= 0.7; }
        else {
          const dx = pcx - bcx, dy = (p.y + p.h/2) - (b.y + b.h/2), d = Math.hypot(dx, dy) || 1;
          b.vx = dx/d * 1.5; b.vy = dy/d * 1.0;
        }
        b.x += b.vx; b.y += b.vy + Math.sin(b.t * 0.08) * 0.4;
        b.x = Math.max(TILE, Math.min(b.x, levelW - TILE - b.w));
        b.y = Math.max(TILE, Math.min(b.y, b.floorTop - b.h + 10));
        break;
      }
      // Cavucão (toupeira): cava até o jogador e salta para fora
      case "cavucao": {
        if (b.phase === "under") {
          b.y = b.floorTop + 6;
          b.x += (pcx > b.x + b.w/2 ? 1 : -1) * 1.7;
          b.x = Math.max(TILE, Math.min(b.x, levelW - TILE - b.w));
          if (b.t % 150 === 130) { b.phase = "pop"; b.vy = -12; }
        } else if (b.phase === "pop") {
          b.vy += GRAVITY; b.y += b.vy;
          if (b.y >= b.floorTop - b.h) { b.y = b.floorTop - b.h; b.vy = 0; b.phase = "out"; b.pcd = 44; }
        } else if (b.phase === "out") { if (--b.pcd <= 0) { b.phase = "under"; b.t -= b.t % 150; } }
        break;
      }
      // Rei Dragão (chefe final): pula, cospe fogo, arremessa martelos e avança
      case "dragao": {
        bossGround(b);
        if (b.onFloor) b.vx = (pcx < b.x + b.w/2 ? -0.5 : 0.5);
        if (b.onFloor && b.t % 150 === 140) b.vy = -11;
        if (b.t % 110 === 60) bossBreatheFire();
        if (b.t % 200 === 120) bossThrowHammer();
        break;
      }
    }
    bossPlayerCollide();
  }

  function bossStompable(b) {
    switch (b.type) {
      case "brutao":   return true;
      case "bocao":    return b.phase === "up" || b.phase === "rise";
      case "assombro": return b.frozen;
      case "cavucao":  return b.phase === "pop" || b.phase === "out";
      case "dragao":   return true;
    }
    return false;
  }
  function bossFireVulnerable(b) {
    switch (b.type) {
      case "assombro": return b.frozen;
      case "bocao":    return b.phase !== "down" && b.phase !== "retract";
      case "cavucao":  return b.phase === "pop" || b.phase === "out";
      default:         return true;
    }
  }
  function bossHurt(n) {
    const b = boss;
    if (!b || b.invT > 0 || b.dying) return false;
    b.hp -= n; b.hitFlash = 12; b.invT = 45; snd("bump");
    spawnSpark(b.x + b.w/2, b.y + b.h/2);
    if (b.hp <= 0) {
      b.dying = true; b.dieT = 0; snd("stomp"); score += 2000; updateHUD(); spawnPop(b.x + b.w/2, b.y + b.h/2);
      // Toca a Castle Complete Theme durante a animacao de morte do chefao e
      // segue tocando pela tela de "Chefao derrotado" (completeLevel nao para a musica).
      if (window.Sound && window.Sound.startCastleCompleteMusic) window.Sound.startCastleCompleteMusic();
    }
    return true;
  }
  function bossPlayerCollide() {
    const b = boss, p = player;
    if (!b || b.dying || p.dead || !rectsOverlap(p, b)) return;
    const stomping = p.vy > 0 && (p.y + p.h) - b.y < 26;
    if (stomping && bossStompable(b)) { p.vy = JUMP_VY * 0.72; bossHurt(1); }
    else damagePlayer();
  }

  // Dano ao jogador (perde poder ou morre) — usado por espinhos, lava e chefões
  function damagePlayer() {
    const p = player;
    if (invincible || starActive() || p.invuln > 0 || p.dead) return;
    if (chosen === 1) voice("minja_trouble");
    // Montado: o avestruz foge assustado no lugar do dano ao jogador.
    if (p.mount) {
      dismount(true);
      p.invuln = 100; p.vy = -6;
      spawnSpark(p.x + p.w/2, p.y + p.h/2); updateHUD(); snd("powerdown");
      return;
    }
    if (p.power !== "small") {
      setPower("small"); p.invuln = 100; p.vy = -6;
      spawnSpark(p.x + p.w/2, p.y + p.h/2); updateHUD(); snd("powerdown");
    } else killPlayer();
  }

  // Perigos da arena (só nos estágios de chefão)
  function checkHazards() {
    const p = player; if (p.dead) return;
    for (const L of lavas) if (rectsOverlap(p, L)) { killPlayer(); return; }
    for (const s of spikes) if (rectsOverlap(p, s)) { damagePlayer(); return; }
    for (const s of lavaShots) if (rectsOverlap(p, s)) { killPlayer(); return; }
  }
  // Gêiseres: acumulam tempo e disparam um jato de lava vertical periodicamente.
  function updateGeysers() {
    for (const g of geysers) {
      g.t++;
      if (g.t >= g.cd) {
        g.t = 0;
        // jato principal + duas gotas leves para os lados
        lavaShots.push({ x: g.x - 8, y: g.y - 16, w:16, h:20, vx:0,    vy:-11, life:180 });
        lavaShots.push({ x: g.x - 8, y: g.y - 16, w:12, h:14, vx:-1.4, vy:-9,  life:150 });
        lavaShots.push({ x: g.x - 8, y: g.y - 16, w:12, h:14, vx: 1.4, vy:-9,  life:150 });
      }
    }
  }
  function updateLavaShots() {
    for (const s of lavaShots) {
      s.life--;
      s.vy += 0.42;                 // gravidade
      s.x += s.vx; s.y += s.vy;
      if (s.y > levelH || s.life <= 0) s.dead = true;
    }
    lavaShots = lavaShots.filter(s => !s.dead);
  }

  // Projéteis dos chefões
  function bossSpit() {
    const b = boss, ox = b.x + b.w/2, oy = b.y + 10, dir = player.x + player.w/2 > ox ? 1 : -1;
    for (const a of [-1, 0, 1])
      bossShots.push({ type:"seed", x:ox-8, y:oy-8, w:16, h:16, vx:dir*2.2 + a*0.9, vy:-4 - Math.abs(a)*0.6, g:0.25, t:0 });
    snd("shoot");
  }
  function bossBreatheFire() {
    const b = boss, dir = player.x + player.w/2 < b.x + b.w/2 ? -1 : 1, oy = b.y + b.h*0.42;
    for (let i = 0; i < 3; i++)
      bossShots.push({ type:"fire", x:b.x + b.w/2, y:oy, w:22, h:15, vx:dir*(3 + i*0.6), vy:(i-1)*0.35, g:0, t:0, life:120 });
    snd("shoot");
  }
  function bossThrowHammer() {
    const b = boss, dir = player.x + player.w/2 < b.x + b.w/2 ? -1 : 1;
    bossShots.push({ type:"hammer", x:b.x + b.w/2, y:b.y + 4, w:16, h:16, vx:dir*2.4, vy:-6, g:0.3, t:0, spin:0 });
    snd("kick");
  }
  function updateBossShots() {
    for (const s of bossShots) {
      s.t++; s.vy += (s.g || 0); s.x += s.vx; s.y += s.vy;
      if (s.type === "hammer") s.spin = (s.spin || 0) + 0.4;
      if (s.type !== "fire" && s.y + s.h >= levelH - TILE) s.dead = true;   // toca o chão
      if (s.x < -30 || s.x > levelW + 30 || s.y > levelH + 40) s.dead = true;
      if (s.life && s.t > s.life) s.dead = true;
      if (!s.dead && !player.dead && rectsOverlap(player, s)) { s.dead = true; damagePlayer(); }
    }
    bossShots = bossShots.filter(s => !s.dead);
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
    // Cancela invencibilidade temporaria pra nao vazar musica/estado entre vidas.
    if (starTimeoutId) { clearTimeout(starTimeoutId); starTimeoutId = null; }
    starUntil = 0;
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

      // "Brotando" do bloco: sobe suave, sem gravidade nem colisao (o bloco esta
      // logo abaixo — nao queremos que a fisica normal pare a subida no meio).
      if (it.emerging && it.emerging > 0) {
        it.emerging -= 1;
        const t = 1 - (it.emerging / 24);           // 0 -> 1
        it.y = it.emergeFromY + (it.emergeToY - it.emergeFromY) * t;
        if (it.emerging <= 0) { it.vy = 0; it.emerging = 0; }
        // coleta ja rola durante o sprout (caso o jogador esteja em cima)
        if (rectsOverlap(p, it)) {
          it.taken = true;
          collectPower(it.type);
          spawnSpark(it.x + it.w/2, it.y + it.h/2);
        }
        continue;
      }

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
    } else if (type === "egg") {
      mountUp();
      score += 300;
      updateHUD();
    } else if (type === "star") {
      // Invencibilidade temporaria: mantem o poder atual, so ativa timer.
      starUntil = Date.now() + STAR_MS;
      score += 500;
      snd("powerup");
      if (window.Sound && window.Sound.startInvincibilityMusic) window.Sound.startInvincibilityMusic();
      // Ao expirar, retomar a musica adequada (se ainda estivermos jogando).
      if (starTimeoutId) clearTimeout(starTimeoutId);
      starTimeoutId = setTimeout(() => {
        starTimeoutId = null;
        starUntil = 0;
        if (state === "play" && !underground && !player.dead) musicStart();
      }, STAR_MS);
    }
    // voz do personagem ao pegar cogumelo/flor
    voice(CHARACTERS[chosen].voice);
    updateHUD();
  }

  // ---- FIREBALLS ----
  // Bicada do avestruz: hitbox curta na direção que o jogador olha.
  function ostrichPeck() {
    const p = player, m = p.mount; if (!m) return;
    m.peck = 12;
    const hb = { x: p.face > 0 ? p.x + p.w - 4 : p.x - PECK_RANGE + 4,
                 y: p.y + 10, w: PECK_RANGE, h: 26 };
    for (const e of enemies) {
      if (!e.alive || e.spiky) continue;
      if (rectsOverlap(hb, e)) {
        e.alive = false; e.squash = 16;
        score += 150; updateHUD();
        spawnPop(e.x + e.w/2, e.y + e.h/2);
        snd("kick");
        if (e.split) spawnSplit(e);
      }
    }
    // acerta o chefão se vulnerável ao contato
    if (boss && !boss.dying && rectsOverlap(hb, boss) && bossStompable(boss)) bossHurt(1);
    snd("shoot");
  }
  // Atualização por quadro do avestruz: cooldowns, fart automático,
  // detecção de inimigo atrás -> solta uma nuvem tóxica que fica curto no ar.
  function updateMount(p) {
    const m = p.mount; if (!m) return;
    if (m.peck > 0) m.peck--;
    if (m.fart > 0) m.fart--;
    if (m.peckCd > 0) m.peckCd--;
    if (m.fartCd > 0) m.fartCd--;
    m.walk = (m.walk + Math.abs(p.vx) * 0.06) % 6.283;
    if (m.fartCd <= 0) {
      // Só solta o "pum" quando o inimigo está BEM próximo (~1cm atrás).
      const zone = { x: p.face > 0 ? p.x - FART_RANGE : p.x + p.w,
                     y: p.y + 4, w: FART_RANGE, h: p.h - 8 };
      let target = null;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(zone, e)) { target = e; break; }
      }
      if (target) {
        m.fart = 24; m.fartCd = FART_LIFE + 20;
        // Nuvem densa e demorada: começa grande e escura, dissipa lentamente.
        const cx = p.face > 0 ? p.x - 20 : p.x + p.w - 40;
        fartClouds.push({
          x: cx, y: p.y + p.h*0.55 - 18,
          w: 60, h: 44, vx: -p.face * 0.45,
          life: FART_LIFE, maxLife: FART_LIFE,
        });
        snd("fart");
        triggerShake(8, 22);   // magnitude, frames
      }
    }
  }
  function triggerShake(mag, frames) {
    if (mag > shakeMag) shakeMag = mag;
    if (frames > shakeT) shakeT = frames;
  }
  function updateFartClouds() {
    for (const c of fartClouds) {
      c.life--;
      c.x += c.vx; c.vx *= 0.94;         // desacelera com o tempo (viscoso)
      c.w += 0.35; c.h += 0.22;          // expansão suave, cloud permanece denso
      if (c.life <= 0) c.dead = true;
      if (!c.dead) {
        for (const e of enemies) {
          if (!e.alive || e.spiky) continue;
          if (rectsOverlap(c, e)) {
            e.alive = false; e.squash = 16;
            score += 100; updateHUD();
            spawnPop(e.x + e.w/2, e.y + e.h/2);
            snd("kick");
            if (e.split) spawnSplit(e);
          }
        }
      }
    }
    fartClouds = fartClouds.filter(c => !c.dead);
  }
  function updateOstrichRunaways() {
    for (const o of ostrichRunaways) {
      o.life--; o.vy += 0.5; o.x += o.vx; o.y += o.vy;
      if (o.life <= 0) o.dead = true;
    }
    ostrichRunaways = ostrichRunaways.filter(o => !o.dead);
  }

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

      // acerta o chefão (quando vulnerável ao fogo)
      if (!f.dead && boss && !boss.dying && bossFireVulnerable(boss) && rectsOverlap(f, boss)) {
        f.dead = true; bossHurt(1);
      }
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
    casteloBoss: { top:"#6b6f7a", top2:"#565a63", dirt:"#3d414a" },   // pedra da arena
  };
  function curTheme() {
    if (underground) return "cave";
    if (stageIsBoss(levelIdx)) return "casteloBoss";
    return THEME_LIST[worldOf(levelIdx)] || "bosque";
  }

  function drawBackground() {
    const th = curTheme();
    if (th === "cave") return drawCaveBackground();
    if (th === "casteloBoss") return drawBossCastleBG();
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
      } else if (bossStage) {
        // tijolo de pedra do castelo (arena de chefão)
        ctx.fillStyle = "#5a5e68"; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = "#6d717c"; ctx.fillRect(sx, s.y, s.w, 5);
        ctx.fillStyle = "#3d414a"; ctx.fillRect(sx, s.y + s.h - 5, s.w, 5);
        ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.strokeRect(sx + .5, s.y + .5, s.w - 1, s.h - 1);
        ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(sx + s.w/2 - 1, s.y + 5, 2, s.h - 10);
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

      // Enquanto brota, corta o desenho na altura do topo do bloco pra parecer
      // que a flor esta emergindo (a metade dentro do bloco fica invisivel).
      let clipped = false;
      if (it.emerging && it.emerging > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, it.emergeFromY);   // so pinta acima do topo do bloco
        ctx.clip();
        clipped = true;
      }

      if (it.type === "egg") {
        // Ovo de avestruz: forma oval creme com pintinhas
        ctx.save(); ctx.translate(cx, cy + bob);
        ctx.fillStyle = "#f3e2b6";
        ctx.beginPath(); ctx.ellipse(0, 0, it.w/2, it.h/2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#e0c98a";
        ctx.beginPath(); ctx.ellipse(-3, -2, it.w/2 - 4, it.h/2 - 4, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#6a4a1d";
        for (const [dx, dy, r] of [[-4,-3,1.4],[3,2,1.2],[-2,4,1.1],[5,-4,1.0],[0,-6,1.1]]) {
          ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.beginPath(); ctx.ellipse(-4, -6, 3, 2, -0.6, 0, 7); ctx.fill();
        ctx.restore();
      } else if (it.type === "mushroom") {
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
        // FLOR (fogo = laranja/vermelho, voo = azul/branco, star = roxo)
        const fire = it.type === "fire";
        const star = it.type === "star";
        let petal, petal2, core;
        if (fire)      { petal = "#ff8a2b"; petal2 = "#ffcf33"; core = "#e23b2e"; }
        else if (star) { petal = "#b26bff"; petal2 = "#f0d5ff"; core = "#6a1fbf"; }
        else           { petal = "#7fd1ff"; petal2 = "#d4ecff"; core = "#4a90e2"; }
        // caule + folha
        ctx.strokeStyle = "#3fa64d"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, cy + 2 + bob); ctx.lineTo(cx, y + it.h); ctx.stroke();
        ctx.fillStyle = "#3fa64d";
        ctx.beginPath(); ctx.ellipse(cx + 7, y + it.h - 6, 6, 3, -0.6, 0, 7); ctx.fill();
        // brilho pulsante ao redor da flor roxa (chama atencao)
        if (star) {
          const pulse = 0.35 + Math.abs(Math.sin(it.phase * 2)) * 0.35;
          ctx.save();
          ctx.globalAlpha = pulse * 0.5;
          const g = ctx.createRadialGradient(cx, cy - 4 + bob, 2, cx, cy - 4 + bob, 22);
          g.addColorStop(0, "#e0b0ff"); g.addColorStop(1, "rgba(178,107,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy - 4 + bob, 22, 0, 7); ctx.fill();
          ctx.restore();
        }
        // pétalas
        ctx.save(); ctx.translate(cx, cy - 4 + bob);
        ctx.fillStyle = petal;
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath(); ctx.ellipse(0, -9, 5, 8, 0, 0, 7); ctx.fill();
        }
        // asinhas na flor voadora
        if (!fire && !star) {
          ctx.fillStyle = "rgba(255,255,255,.9)";
          const flap = Math.sin(it.phase * 3) * 0.3;
          ctx.save(); ctx.rotate(-0.5 + flap); ctx.beginPath(); ctx.ellipse(-14, -6, 7, 4, 0, 0, 7); ctx.fill(); ctx.restore();
          ctx.save(); ctx.rotate(0.5 - flap); ctx.beginPath(); ctx.ellipse(14, -6, 7, 4, 0, 0, 7); ctx.fill(); ctx.restore();
        }
        // miolo
        ctx.fillStyle = petal2;
        ctx.beginPath(); ctx.arc(0, -4, 6, 0, 7); ctx.fill();
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, -4, 3, 0, 7); ctx.fill();
        ctx.restore();
      }

      if (clipped) ctx.restore();
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

  // ---------- ARENA DE CHEFÃO (castelo, lava, espinhos) ----------
  function drawBossCastleBG() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#241a22"); g.addColorStop(1, "#3a2630");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // blocos de pedra ao fundo
    ctx.fillStyle = "rgba(255,255,255,.04)";
    for (let y = 24, row = 0; y < H - 70; y += 44, row++)
      for (let x = (row % 2 ? 22 : -10); x < W; x += 64) ctx.fillRect(x, y, 60, 40);
    // brilho da lava embaixo
    const lg = ctx.createLinearGradient(0, H - 80, 0, H);
    lg.addColorStop(0, "rgba(255,90,20,0)"); lg.addColorStop(1, "rgba(255,120,30,.35)");
    ctx.fillStyle = lg; ctx.fillRect(0, H - 80, W, 80);
    // tochas
    const t = performance.now() / 120;
    for (const tx of [120, 400, 680]) {
      ctx.fillStyle = "#4a2f1a"; ctx.fillRect(tx - 3, 96, 6, 42);
      const fl = 5 + Math.sin(t + tx) * 3;
      ctx.fillStyle = "#ffce54"; ctx.beginPath(); ctx.ellipse(tx, 92, 7, 11 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff7a1a"; ctx.beginPath(); ctx.ellipse(tx, 96, 4, 6 + fl * 0.5, 0, 0, 7); ctx.fill();
    }
  }
  function drawLava() {
    const t = performance.now() / 300;
    for (const L of lavas) {
      const x = L.x - cameraX; if (x + L.w < 0 || x > W) continue;
      ctx.fillStyle = "#e0451a"; ctx.fillRect(x, L.y, L.w, L.h);
      ctx.fillStyle = "rgba(255,220,120,.55)"; ctx.fillRect(x, L.y, L.w, 3);
      ctx.fillStyle = "#ff8a2a";
      for (let i = 0; i < 3; i++) { const bx = x + 6 + i * 12, by = L.y + 8 + Math.sin(t + i + L.x) * 3; ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, 7); ctx.fill(); }
    }
  }
  function drawSpikes() {
    for (const s of spikes) {
      const x = s.x - cameraX; if (x + s.w < 0 || x > W) continue;
      const dir = s.dir || (s.x < levelW / 2 ? "left" : "right");
      ctx.fillStyle = "#c9ccd4";
      if (dir === "left" || dir === "right") {
        ctx.fillStyle = "#8a8f9a";
        if (dir === "left") ctx.fillRect(x - 2, s.y, 4, s.h);
        else                ctx.fillRect(x + s.w - 2, s.y, 4, s.h);
        ctx.fillStyle = "#c9ccd4";
        for (let i = 0; i < 3; i++) {
          const yy = s.y + 5 + i * 11; ctx.beginPath();
          if (dir === "left") { ctx.moveTo(x, yy); ctx.lineTo(x + s.w * 0.75, yy + 5); ctx.lineTo(x, yy + 11); }
          else                { ctx.moveTo(x + s.w, yy); ctx.lineTo(x + s.w * 0.25, yy + 5); ctx.lineTo(x + s.w, yy + 11); }
          ctx.closePath(); ctx.fill();
        }
      } else {
        // up (chão): pontas p/ cima na base; down (teto): pontas p/ baixo no topo
        const up = dir === "up";
        ctx.fillStyle = "#8a8f9a";
        if (up) ctx.fillRect(x, s.y + s.h - 4, s.w, 4);
        else    ctx.fillRect(x, s.y, s.w, 4);
        ctx.fillStyle = "#c9ccd4";
        for (let i = 0; i < 3; i++) {
          const xx = s.x - cameraX + 5 + i * 11; ctx.beginPath();
          if (up) { ctx.moveTo(xx, s.y + s.h); ctx.lineTo(xx + 5, s.y + s.h * 0.25); ctx.lineTo(xx + 11, s.y + s.h); }
          else    { ctx.moveTo(xx, s.y);        ctx.lineTo(xx + 5, s.y + s.h * 0.75); ctx.lineTo(xx + 11, s.y); }
          ctx.closePath(); ctx.fill();
        }
      }
    }
  }
  function drawGeysers() {
    const t = performance.now() / 90;
    for (const g of geysers) {
      const x = g.x - cameraX; if (x < -20 || x > W + 20) continue;
      // Base: pequena rachadura fumegante no chão
      ctx.fillStyle = "#3a2214";
      ctx.beginPath(); ctx.ellipse(x, g.y - 4, 14, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#e0451a";
      ctx.beginPath(); ctx.ellipse(x, g.y - 6, 10, 3, 0, 0, 7); ctx.fill();
      // faíscas anunciando a próxima erupção
      const warn = g.cd - g.t;
      if (warn > 0 && warn < 20) {
        ctx.fillStyle = "rgba(255,180,60," + (0.4 + Math.sin(t) * 0.3) + ")";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(x + (i - 1) * 6, g.y - 10 - (Math.sin(t + i) + 1) * 2, 1.5, 0, 7); ctx.fill();
        }
      }
    }
  }
  function drawLavaShots() {
    for (const s of lavaShots) {
      const x = s.x - cameraX; if (x + s.w < 0 || x > W) continue;
      const cx = x + s.w/2, cy = s.y + s.h/2;
      ctx.fillStyle = "#ff6a1a";
      ctx.beginPath(); ctx.ellipse(cx, cy, s.w/2, s.h/2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffd06a";
      ctx.beginPath(); ctx.ellipse(cx, cy - 2, s.w/3, s.h/3, 0, 0, 7); ctx.fill();
      // rastro
      ctx.fillStyle = "rgba(255,120,40,.35)";
      ctx.beginPath(); ctx.ellipse(cx, cy + 8, s.w/3, s.h/4, 0, 0, 7); ctx.fill();
    }
  }
  function drawBossShots() {
    for (const s of bossShots) {
      const x = s.x - cameraX, cx = x + s.w/2, cy = s.y + s.h/2;
      if (x + s.w < 0 || x > W) continue;
      if (s.type === "seed") {
        ctx.fillStyle = "#6bd06b"; ctx.beginPath(); ctx.ellipse(cx, cy, s.w/2, s.h/2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#2f7a3c"; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 2, 0, 7); ctx.fill();
      } else if (s.type === "fire") {
        ctx.fillStyle = "#ffce54"; ctx.beginPath(); ctx.ellipse(cx, cy, s.w/2, s.h/2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#ff6a1a"; ctx.beginPath(); ctx.ellipse(cx, cy, s.w/3, s.h/3, 0, 0, 7); ctx.fill();
      } else { // hammer
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.spin || 0);
        ctx.fillStyle = "#8a6a3e"; ctx.fillRect(-2, -2, 4, 10);
        ctx.fillStyle = "#b9bcc4"; ctx.fillRect(-7, -8, 14, 7);
        ctx.restore();
      }
    }
  }

  // Cada chefão: arte original desenhada no canvas + barra de vida
  function drawBoss() {
    const b = boss; if (!b) return;
    const x = b.x - cameraX, y = b.y;
    ctx.save();
    if (b.dying) ctx.globalAlpha = Math.max(0, 1 - b.dieT / 80);
    if (b.type === "brutao")   drawBrutao(x, y, b);
    else if (b.type === "bocao")    drawBocao(x, y, b);
    else if (b.type === "assombro") drawAssombro(x, y, b);
    else if (b.type === "cavucao")  drawCavucao(x, y, b);
    else if (b.type === "dragao")   drawDragao(x, y, b);
    if (b.hitFlash > 0 && Math.floor(b.hitFlash / 2) % 2 === 0) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(x + b.w/2, y + b.h/2, b.w/2, b.h/2, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
    drawBossHealth();
  }
  function drawBrutao(x, y, b) {
    const cx = x + b.w/2, by = y + b.h;
    ctx.fillStyle = "#3d5a2a";
    ctx.beginPath(); ctx.ellipse(cx, by - b.h*0.36, b.w*0.5, b.h*0.42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2f4720";
    ctx.beginPath(); ctx.ellipse(cx, by - b.h*0.6, b.w*0.4, b.h*0.24, 0, Math.PI, 0); ctx.fill();
    // pés
    ctx.fillStyle = "#26381a"; const fp = Math.sin(performance.now()/90) * 2;
    ctx.fillRect(cx - 20, by - 8 + fp, 12, 8); ctx.fillRect(cx + 8, by - 8 - fp, 12, 8);
    // sobrancelhas bravas
    const dir = b.face;
    ctx.fillStyle = "#1c2a12";
    ctx.beginPath(); ctx.moveTo(cx - 18, by - b.h*0.55); ctx.lineTo(cx - 2, by - b.h*0.46); ctx.lineTo(cx - 18, by - b.h*0.44); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 18, by - b.h*0.55); ctx.lineTo(cx + 2, by - b.h*0.46); ctx.lineTo(cx + 18, by - b.h*0.44); ctx.fill();
    // olhos
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 9, by - b.h*0.42, 6, 0, 7); ctx.arc(cx + 9, by - b.h*0.42, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 9 + dir*2, by - b.h*0.42, 3, 0, 7); ctx.arc(cx + 9 + dir*2, by - b.h*0.42, 3, 0, 7); ctx.fill();
    // presas
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(cx - 8, by - b.h*0.26); ctx.lineTo(cx - 4, by - b.h*0.16); ctx.lineTo(cx - 12, by - b.h*0.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 8, by - b.h*0.26); ctx.lineTo(cx + 4, by - b.h*0.16); ctx.lineTo(cx + 12, by - b.h*0.2); ctx.fill();
  }
  function drawBocao(x, y, b) {
    const cx = x + b.w/2, by = y + b.h;
    // caule
    ctx.fillStyle = "#2f9a3c"; ctx.fillRect(cx - 6, by - b.h*0.5, 12, b.h*0.5);
    // folhas
    ctx.fillStyle = "#3fbf4c";
    ctx.beginPath(); ctx.ellipse(cx - 12, by - b.h*0.4, 12, 6, 0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 12, by - b.h*0.4, 12, 6, -0.5, 0, 7); ctx.fill();
    const open = b.phase === "spit";
    const headY = by - b.h*0.66;
    // cabeça (bulbo carnívoro roxo com pintas)
    ctx.fillStyle = "#a23bb0";
    ctx.beginPath(); ctx.ellipse(cx, headY, b.w*0.46, b.h*0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#f2f2f2";
    for (const [dx, dy] of [[-10,-6],[8,-8],[-4,4],[12,2]]) { ctx.beginPath(); ctx.arc(cx+dx, headY+dy, 3, 0, 7); ctx.fill(); }
    // boca
    ctx.fillStyle = "#3a0f2a";
    ctx.beginPath(); ctx.ellipse(cx, headY + (open ? 4 : 8), b.w*0.32, open ? b.h*0.2 : 4, 0, 0, 7); ctx.fill();
    if (open) { // dentes
      ctx.fillStyle = "#fff";
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i*8 - 3, headY - 2); ctx.lineTo(cx + i*8, headY + 4); ctx.lineTo(cx + i*8 + 3, headY - 2); ctx.fill(); }
    }
  }
  function drawAssombro(x, y, b) {
    const cx = x + b.w/2, cy = y + b.h/2;
    ctx.fillStyle = "rgba(230,240,255,.92)";
    ctx.beginPath(); ctx.arc(cx, cy - 4, b.w*0.44, Math.PI, 0); // topo redondo
    ctx.quadraticCurveTo(cx + b.w*0.44, cy + b.h*0.35, cx + b.w*0.2, cy + b.h*0.3);
    ctx.quadraticCurveTo(cx, cy + b.h*0.44, cx - b.w*0.2, cy + b.h*0.3);
    ctx.quadraticCurveTo(cx - b.w*0.44, cy + b.h*0.35, cx - b.w*0.44, cy - 4);
    ctx.fill();
    if (b.frozen) {  // tímido: cobre o rosto
      ctx.fillStyle = "#7aa0c8";
      ctx.beginPath(); ctx.arc(cx - 10, cy, 3, 0, 7); ctx.arc(cx + 10, cy, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = "#5a7ba0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy + 8, 6, Math.PI, 0); ctx.stroke();   // boca envergonhada
    } else {         // bravo: persegue
      ctx.fillStyle = "#2a3550";
      ctx.beginPath(); ctx.arc(cx - 10, cy - 2, 4, 0, 7); ctx.arc(cx + 10, cy - 2, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 16, cy - 10); ctx.lineTo(cx - 5, cy - 4); ctx.lineTo(cx - 16, cy - 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 16, cy - 10); ctx.lineTo(cx + 5, cy - 4); ctx.lineTo(cx + 16, cy - 4); ctx.fill();
      ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.ellipse(cx, cy + 10, 9, 6, 0, 0, 7); ctx.fill();  // boca aberta
    }
  }
  function drawCavucao(x, y, b) {
    const cx = x + b.w/2, by = y + b.h, under = b.phase === "under";
    if (under) {  // montinho de terra na superfície
      ctx.fillStyle = "#8a5a2b";
      ctx.beginPath(); ctx.ellipse(cx, b.floorTop, b.w*0.5, 10, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#6b4420";
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i*10, b.floorTop - 3, 3, 0, 7); ctx.fill(); }
      return;
    }
    ctx.fillStyle = "#7a5230";
    ctx.beginPath(); ctx.ellipse(cx, by - b.h*0.4, b.w*0.46, b.h*0.42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#e9c9a0"; ctx.beginPath(); ctx.ellipse(cx, by - b.h*0.28, b.w*0.28, b.h*0.24, 0, 0, 7); ctx.fill();
    // focinho/garras
    ctx.fillStyle = "#ffb0c0"; ctx.beginPath(); ctx.arc(cx, by - b.h*0.5, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#d9d9d9";
    for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + sgn*(b.w*0.4), by - 12 + i*5); ctx.lineTo(cx + sgn*(b.w*0.55), by - 14 + i*5); ctx.lineTo(cx + sgn*(b.w*0.4), by - 8 + i*5); ctx.fill(); }
    // olhos apertados
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 12, by - b.h*0.58); ctx.lineTo(cx - 4, by - b.h*0.56);
    ctx.moveTo(cx + 12, by - b.h*0.58); ctx.lineTo(cx + 4, by - b.h*0.56); ctx.stroke();
  }
  function drawDragao(x, y, b) {
    const cx = x + b.w/2, by = y + b.h, dir = b.face;
    // casco espinhoso
    ctx.fillStyle = "#3a7d2e";
    ctx.beginPath(); ctx.ellipse(cx, by - b.h*0.34, b.w*0.5, b.h*0.44, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#e9d29a"; ctx.beginPath(); ctx.ellipse(cx, by - b.h*0.24, b.w*0.3, b.h*0.3, 0, 0, 7); ctx.fill();  // barriga
    ctx.fillStyle = "#c9ccd4";  // espinhos nas costas
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i*14 - 5, by - b.h*0.62); ctx.lineTo(cx + i*14, by - b.h*0.82); ctx.lineTo(cx + i*14 + 5, by - b.h*0.62); ctx.fill(); }
    // cabeça
    ctx.fillStyle = "#3a7d2e"; ctx.beginPath(); ctx.arc(cx + dir*b.w*0.16, by - b.h*0.66, b.w*0.24, 0, 7); ctx.fill();
    // chifres
    ctx.fillStyle = "#f2eecb";
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + dir*b.w*0.16 + sgn*8, by - b.h*0.82); ctx.lineTo(cx + dir*b.w*0.16 + sgn*12, by - b.h*0.98); ctx.lineTo(cx + dir*b.w*0.16 + sgn*3, by - b.h*0.84); ctx.fill(); }
    // coroa
    ctx.fillStyle = "#ffd23f";
    const kx = cx + dir*b.w*0.16;
    ctx.beginPath(); ctx.moveTo(kx - 12, by - b.h*0.9); ctx.lineTo(kx - 12, by - b.h*1.02); ctx.lineTo(kx - 6, by - b.h*0.95); ctx.lineTo(kx, by - b.h*1.05); ctx.lineTo(kx + 6, by - b.h*0.95); ctx.lineTo(kx + 12, by - b.h*1.02); ctx.lineTo(kx + 12, by - b.h*0.9); ctx.fill();
    // olho
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(kx + dir*6, by - b.h*0.68, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(kx + dir*7, by - b.h*0.68, 2.5, 0, 7); ctx.fill();
  }
  function drawBossHealth() {
    const b = boss; if (!b) return;
    const bw = 230, x = (W - bw) / 2, y = 54;
    ctx.fillStyle = "rgba(0,0,0,.55)"; roundRect(x - 10, y - 6, bw + 20, 34, 8); ctx.fill();
    ctx.fillStyle = "#ff6b6b"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("👑 " + BOSS_NAMES[b.type], x, y + 2);
    const pipW = bw / b.maxHp;
    for (let i = 0; i < b.maxHp; i++) {
      ctx.fillStyle = i < b.hp ? "#ff3b3b" : "rgba(255,255,255,.18)";
      roundRect(x + i * pipW + 1, y + 14, pipW - 3, 7, 3); ctx.fill();
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
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
      const dir = e.vx < 0 ? -1 : 1;
      switch (e.type) {
        case "bat":     drawBat(ex, e.y, e.w, e.h); break;
        case "jumper":  drawJumper(ex, e.y, e.w, e.h, e); break;
        case "shooter": drawShooter(ex, e.y, e.w, e.h, e); break;
        case "flyer":   drawFlyer(ex, e.y, e.w, e.h, e); break;
        case "spiker":  drawSpiker(ex, e.y, e.w, e.h); break;
        case "hopper":  drawCritter(ex, e.y, e.w, e.h, { body:"#e08a2e", belly:"#f6c98a", feet:"#a5641c", dir }); break;
        case "roller":  drawRoller(ex, e.y, e.w, e.h, e); break;
        case "lobber":  drawCritter(ex, e.y, e.w, e.h, { body:"#2f7d55", belly:"#bfe3a0", feet:"#1f5a3a", mouth:true, dir }); break;
        case "splitter":drawCritter(ex, e.y, e.w, e.h, { body:"#3f8fd0", belly:"#cfeaff", feet:"#2a6aa0", dir }); break;
        case "mini":    drawCritter(ex, e.y, e.w, e.h, { body:"#3f8fd0", belly:"#cfeaff", dir }); break;
        case "charger": drawCritter(ex, e.y, e.w, e.h, { body:"#8a5a2b", belly:"#c9975a", feet:"#4a2c14", horn:"#f2eecb", brows:true, dir }); break;
        case "drifter": drawDrifter(ex, e.y, e.w, e.h, e); break;
        case "diver":   drawWinged(ex, e.y, e.w, e.h, "#3a4670", "rgba(200,210,255,.85)"); break;
        case "zigzag":  drawWinged(ex, e.y, e.w, e.h, "#c99a2e", "rgba(255,235,120,.9)"); break;
        case "turret":  drawCritter(ex, e.y, e.w, e.h, { body:"#5a5e68", belly:"#8a8f9a", spikes:"#3d414a", snout:"#3d414a", dir }); break;
        case "bomber":  drawWinged(ex, e.y, e.w, e.h, "#4a4a4a", "rgba(150,150,150,.85)", true); break;
        case "spitter": drawCritter(ex, e.y, e.w, e.h, { body:"#7a3fb0", belly:"#c9a6e6", feet:"#3a1c58", mouth:true, dir }); break;
        default:        drawEnemy(ex, e.y, e.w, e.h, e.vx);
      }
    }
  }

  // Projéteis dos inimigos: bolha de energia (bolt) ou bomba (bomb)
  function drawEnemyShots() {
    for (const s of enemyShots) {
      const cx = s.x - cameraX + s.w/2, cy = s.y + s.h/2;
      if (cx < -20 || cx > W + 20) continue;
      if (s.kind === "bomb") {
        ctx.fillStyle = "#2b2b2b"; ctx.beginPath(); ctx.arc(cx, cy, s.w/2, 0, 7); ctx.fill();
        ctx.strokeStyle = "#e0803a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 3, cy - s.h/2); ctx.lineTo(cx + 7, cy - s.h/2 - 4); ctx.stroke();
        ctx.fillStyle = "#ffce54"; ctx.beginPath(); ctx.arc(cx + 7, cy - s.h/2 - 4, 2, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = "#c07bff"; ctx.beginPath(); ctx.ellipse(cx, cy, s.w/2, s.h/2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#f0d6ff"; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 2.2, 0, 7); ctx.fill();
      }
    }
  }

  // Desenhador genérico de "bicho" terrestre (varia cor e adereços)
  function drawCritter(x, y, w, h, o) {
    const cx = x + w/2, by = y + h, dir = o.dir || 1;
    if (o.feet) { ctx.fillStyle = o.feet; const fp = Math.sin(performance.now()/100) * 2; ctx.fillRect(cx - 12, by - 5 + fp, 7, 6); ctx.fillRect(cx + 5, by - 5 - fp, 7, 6); }
    ctx.fillStyle = o.body; ctx.beginPath(); ctx.ellipse(cx, by - h*0.38, w*0.46, h*0.42, 0, 0, 7); ctx.fill();
    if (o.belly) { ctx.fillStyle = o.belly; ctx.beginPath(); ctx.ellipse(cx, by - h*0.28, w*0.26, h*0.26, 0, 0, 7); ctx.fill(); }
    if (o.spikes) { ctx.fillStyle = o.spikes; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i*8 - 4, by - h*0.6); ctx.lineTo(cx + i*8, by - h*0.82); ctx.lineTo(cx + i*8 + 4, by - h*0.6); ctx.fill(); } }
    if (o.horn) { ctx.fillStyle = o.horn; ctx.beginPath(); ctx.moveTo(cx - 4, by - h*0.66); ctx.lineTo(cx, by - h*0.92); ctx.lineTo(cx + 4, by - h*0.66); ctx.fill(); }
    if (o.snout) { ctx.fillStyle = o.snout; ctx.fillRect(cx + dir*w*0.18, by - h*0.5, dir*w*0.32, 8); }
    if (o.brows) { ctx.fillStyle = o.body; ctx.beginPath(); ctx.moveTo(cx - 12, by - h*0.6); ctx.lineTo(cx - 2, by - h*0.5); ctx.lineTo(cx - 12, by - h*0.47); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + 12, by - h*0.6); ctx.lineTo(cx + 2, by - h*0.5); ctx.lineTo(cx + 12, by - h*0.47); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 6, by - h*0.46, 5, 0, 7); ctx.arc(cx + 6, by - h*0.46, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 6 + dir, by - h*0.46, 2.4, 0, 7); ctx.arc(cx + 6 + dir, by - h*0.46, 2.4, 0, 7); ctx.fill();
    if (o.mouth) { ctx.fillStyle = "#3a0f2a"; ctx.beginPath(); ctx.ellipse(cx, by - h*0.2, w*0.16, 4, 0, 0, 7); ctx.fill(); }
  }
  // Rolador: bola listrada que gira
  function drawRoller(x, y, w, h, e) {
    const cx = x + w/2, cy = y + h - h*0.4, r = w*0.44, rot = (e.x || 0) * 0.12;
    ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 4, 0, 7); ctx.arc(cx + 5, cy - 3, 4, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 2, 0, 7); ctx.arc(cx + 5, cy - 3, 2, 0, 7); ctx.fill();
  }
  // Pairador fantasma (persegue pelo ar)
  function drawDrifter(x, y, w, h, e) {
    const cx = x + w/2, cy = y + h/2;
    ctx.fillStyle = "rgba(190,170,225,.9)";
    ctx.beginPath(); ctx.arc(cx, cy - 2, w*0.42, Math.PI, 0);
    ctx.quadraticCurveTo(cx + w*0.42, cy + h*0.36, cx + w*0.16, cy + h*0.3);
    ctx.quadraticCurveTo(cx, cy + h*0.44, cx - w*0.16, cy + h*0.3);
    ctx.quadraticCurveTo(cx - w*0.42, cy + h*0.36, cx - w*0.42, cy - 2); ctx.fill();
    ctx.fillStyle = "#3a2b52"; ctx.beginPath(); ctx.arc(cx - 6, cy - 2, 3, 0, 7); ctx.arc(cx + 6, cy - 2, 3, 0, 7); ctx.fill();
  }
  // Voador com asas (mergulhador/zigue/bombardeiro)
  function drawWinged(x, y, w, h, body, wing, bomb) {
    const cx = x + w/2, cy = y + h/2, flap = Math.sin(performance.now()/70) * 0.6;
    ctx.fillStyle = wing;
    for (const sg of [-1, 1]) { ctx.save(); ctx.translate(cx, cy - 2); ctx.scale(sg, 1); ctx.rotate(-0.2 + flap); ctx.beginPath(); ctx.ellipse(w*0.42, 0, w*0.4, h*0.26, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, cy, w*0.3, h*0.36, 0, 0, 7); ctx.fill();
    if (bomb) { ctx.fillStyle = "#2b2b2b"; ctx.beginPath(); ctx.arc(cx, cy + h*0.3, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 3, 0, 7); ctx.arc(cx + 4, cy - 3, 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 1.6, 0, 7); ctx.arc(cx + 4, cy - 3, 1.6, 0, 7); ctx.fill();
  }
  // Pulador: sapinho saltitante de patas grandes
  function drawJumper(x, y, w, h, e) {
    const cx = x + w/2, by = y + h, air = e && !e.grounded;
    ctx.fillStyle = "#3fae4a";
    ctx.beginPath(); ctx.ellipse(cx, by - h*0.34, w*0.46, h*0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2f8a3a";   // patas
    ctx.fillRect(cx - w*0.42, by - (air ? 12 : 6), 9, air ? 12 : 6);
    ctx.fillRect(cx + w*0.42 - 9, by - (air ? 12 : 6), 9, air ? 12 : 6);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 6, by - h*0.5, 5, 0, 7); ctx.arc(cx + 6, by - h*0.5, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 6, by - h*0.5, 2.5, 0, 7); ctx.arc(cx + 6, by - h*0.5, 2.5, 0, 7); ctx.fill();
  }
  // Atirador: criatura-tromba que cospe bolhas
  function drawShooter(x, y, w, h, e) {
    const cx = x + w/2, by = y + h, dir = (e && e.vx < 0) ? -1 : 1;
    ctx.fillStyle = "#7a3fb0";
    ctx.beginPath(); ctx.ellipse(cx, by - h*0.36, w*0.48, h*0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#5c2e88"; ctx.fillRect(cx + dir*w*0.2, by - h*0.5, dir*w*0.34, 8);  // tromba
    ctx.fillStyle = "#3a1c58";
    const fp = Math.sin(performance.now()/100) * 2;
    ctx.fillRect(cx - 12, by - 5 + fp, 7, 6); ctx.fillRect(cx + 5, by - 5 - fp, 7, 6);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 5, by - h*0.46, 5, 0, 7); ctx.arc(cx + 7, by - h*0.46, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 5 + dir, by - h*0.46, 2.4, 0, 7); ctx.arc(cx + 7 + dir, by - h*0.46, 2.4, 0, 7); ctx.fill();
  }
  // Voador de superfície: inseto de asas amarelas
  function drawFlyer(x, y, w, h) {
    const cx = x + w/2, cy = y + h/2, flap = Math.sin(performance.now()/70) * 0.6;
    ctx.fillStyle = "rgba(255,235,120,.9)";
    for (const sgn of [-1, 1]) { ctx.save(); ctx.translate(cx, cy); ctx.scale(sgn, 1); ctx.rotate(-0.2 + flap); ctx.beginPath(); ctx.ellipse(w*0.4, 0, w*0.4, h*0.28, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = "#c99a2e"; ctx.beginPath(); ctx.ellipse(cx, cy, w*0.28, h*0.34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 2.2, 0, 7); ctx.arc(cx + 4, cy - 2, 2.2, 0, 7); ctx.fill();
  }
  // Espinho: ouriço que não pode ser pisado
  function drawSpiker(x, y, w, h) {
    const cx = x + w/2, by = y + h;
    ctx.fillStyle = "#37506b";
    for (let i = 0; i < 8; i++) { const a = Math.PI + (i/7)*Math.PI, sx = cx + Math.cos(a)*w*0.5, sy = by - h*0.42 + Math.sin(a)*h*0.42; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*w*0.34, by - h*0.42 + Math.sin(a)*h*0.3); ctx.lineTo(sx, sy); ctx.lineTo(cx + Math.cos(a + 0.2)*w*0.34, by - h*0.42 + Math.sin(a + 0.2)*h*0.3); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#48688a"; ctx.beginPath(); ctx.ellipse(cx, by - h*0.34, w*0.4, h*0.34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 6, by - h*0.36, 4.5, 0, 7); ctx.arc(cx + 6, by - h*0.36, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx - 6, by - h*0.36, 2.2, 0, 7); ctx.arc(cx + 6, by - h*0.36, 2.2, 0, 7); ctx.fill();
  }

  // Morcego: corpo mauve claro com contorno pra contrastar contra o fundo escuro
  // da caverna. Sem o contorno, o corpo violeta escuro (#2b2140) desaparecia
  // contra o gradiente da caverna (#0a0e1a -> #1a2138).
  function drawBat(x, y, w, h) {
    const cx = x + w/2, cy = y + h/2;
    const flap = Math.sin(performance.now() / 90) * 0.7;
    // sombra atras (halo levemente claro pra silhueta se destacar)
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#c8b8e8";
    ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.85, h * 0.45, 0, 0, 7); ctx.fill();
    ctx.restore();
    // asas: preenchimento mauve claro + contorno escuro pra dar definicao
    ctx.fillStyle = "#8a6bb8";
    ctx.strokeStyle = "#2b1c40";
    ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sgn, 1); ctx.rotate(-0.2 + flap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w * 0.5, -h * 0.4, w * 0.7, 0);
      ctx.quadraticCurveTo(w * 0.55, h * 0.1, w * 0.35, h * 0.05);
      ctx.quadraticCurveTo(w * 0.5, h * 0.25, 0, h * 0.1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // corpo/cabeca com contorno
    ctx.fillStyle = "#a889d0";
    ctx.strokeStyle = "#2b1c40";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.34, 0, 7); ctx.fill(); ctx.stroke();
    // orelhas
    ctx.fillStyle = "#a889d0";
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx - 9, cy - 13); ctx.lineTo(cx - 2, cy - 8);
    ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx + 9, cy - 13); ctx.lineTo(cx + 2, cy - 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // presas brancas (leem contra o corpo escurinho)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + 3); ctx.lineTo(cx - 1, cy + 7); ctx.lineTo(cx - 1, cy + 3);
    ctx.moveTo(cx + 3, cy + 3); ctx.lineTo(cx + 1, cy + 7); ctx.lineTo(cx + 1, cy + 3);
    ctx.closePath(); ctx.fill();
    // olhos vermelhos brilhantes
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath(); ctx.arc(cx - 4, cy - 1, 2.4, 0, 7); ctx.arc(cx + 4, cy - 1, 2.4, 0, 7); ctx.fill();
    // brilho nos olhos
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx - 4.5, cy - 1.5, 0.8, 0, 7); ctx.arc(cx + 3.5, cy - 1.5, 0.8, 0, 7); ctx.fill();
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
    // aura roxa pulsante da invencibilidade temporaria (flor roxa)
    if (!dead && starActive()) {
      const remaining = starUntil - Date.now();
      // pisca mais rapido nos ultimos 2s pra avisar que vai acabar
      const speed = remaining < 2000 ? 0.6 : 0.3;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.abs(Math.sin(tick * speed)) * 0.35;
      const g = ctx.createRadialGradient(cx, midY, 4, cx, midY, w * 1.2);
      g.addColorStop(0, "#e0b0ff"); g.addColorStop(1, "rgba(120,40,200,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, midY, w * 1.2, 0, 7); ctx.fill();
      ctx.restore();
    }

    if (player.mount && !dead) {
      drawOstrich(x, y, w, h, face, player.mount);
      // cavaleiro (menor) sentado sobre as costas do avestruz
      const riderH = Math.round(h * 0.55);
      drawSprite(ctx, ch, cx - face * 4, y + h * 0.5 + 6, riderH, face, walk, dead);
    } else {
      drawSprite(ctx, ch, cx, y + h + 2, dispH, face, walk, dead);
    }
  }

  // Avestruz procedural: corpo escuro, ventre branco, pescoço/cabeça cor de
  // areia, bico vermelho (abre ao bicar), pernas rosadas.
  function drawOstrich(x, y, w, h, face, mount) {
    ctx.save();
    if (face < 0) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    const walk = (mount && mount.walk) || 0;
    const cx = x + w * 0.42;
    const bodyCy = y + h * 0.62;
    const bodyRx = w * 0.44, bodyRy = h * 0.20;
    const bob = Math.sin(walk) * 1.5;

    // pernas rosadas (uma p/ frente e outra atrás, alternando)
    ctx.strokeStyle = "#e0838b"; ctx.lineWidth = 4;
    const legTop = bodyCy + bodyRy - 4;
    const legFoot = y + h - 3;
    const swing = Math.sin(walk) * 4;
    ctx.beginPath();
    ctx.moveTo(cx - 5, legTop); ctx.lineTo(cx - 5 + swing, legFoot);
    ctx.moveTo(cx + 5, legTop); ctx.lineTo(cx + 5 - swing, legFoot);
    ctx.stroke();
    ctx.fillStyle = "#4a3a2b";
    ctx.fillRect(cx - 10 + swing, legFoot - 3, 10, 3);
    ctx.fillRect(cx + 2 - swing, legFoot - 3, 10, 3);

    // cauda cor de areia (plumas atrás)
    ctx.fillStyle = "#e5cc99";
    ctx.beginPath(); ctx.ellipse(cx - bodyRx + 2, bodyCy - bodyRy * 0.3 - bob, 11, 15, 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#c9ad78";
    ctx.beginPath(); ctx.ellipse(cx - bodyRx + 4, bodyCy - bodyRy * 0.1 - bob, 8, 10, 0.5, 0, 7); ctx.fill();

    // corpo escuro
    ctx.fillStyle = "#2c2621";
    ctx.beginPath(); ctx.ellipse(cx, bodyCy - bob, bodyRx, bodyRy, 0, 0, 7); ctx.fill();
    // ventre branco
    ctx.fillStyle = "#f4ede0";
    ctx.beginPath(); ctx.ellipse(cx - 4, bodyCy + 2 - bob, bodyRx * 0.55, bodyRy * 0.75, 0.15, 0, 7); ctx.fill();

    // pescoço longo cor de areia
    const neckX0 = cx + bodyRx * 0.55;
    const neckY0 = bodyCy - bodyRy * 0.4 - bob;
    const headX  = cx + bodyRx * 0.55 + 10;
    const headY  = y + h * 0.16;
    ctx.strokeStyle = "#e6d8b8"; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(neckX0, neckY0);
    ctx.quadraticCurveTo(neckX0 + 6, (neckY0 + headY) / 2, headX, headY);
    ctx.stroke();
    // sombra suave no pescoço
    ctx.strokeStyle = "rgba(160,140,90,.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(neckX0 + 3, neckY0);
    ctx.quadraticCurveTo(neckX0 + 8, (neckY0 + headY) / 2, headX + 1, headY);
    ctx.stroke();

    // cabeça
    ctx.fillStyle = "#e6d8b8";
    ctx.beginPath(); ctx.arc(headX, headY, 7, 0, 7); ctx.fill();
    // topete rebelde
    ctx.strokeStyle = "#c9ad78"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX - 3, headY - 5); ctx.lineTo(headX - 4, headY - 10);
    ctx.moveTo(headX,     headY - 6); ctx.lineTo(headX,     headY - 12);
    ctx.moveTo(headX + 3, headY - 5); ctx.lineTo(headX + 5, headY - 10);
    ctx.stroke();
    // olho
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(headX + 2, headY - 1, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(headX + 3, headY - 1, 1.2, 0, 7); ctx.fill();
    // bico vermelho (abre ao bicar)
    const pecking = mount && mount.peck > 0;
    ctx.fillStyle = "#d44536";
    const bx = headX + 6, by = headY;
    if (pecking) {
      ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.lineTo(bx + 15, by - 6); ctx.lineTo(bx + 14, by + 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx, by + 3); ctx.lineTo(bx + 14, by + 5); ctx.lineTo(bx + 12, by + 9); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(bx, by - 3); ctx.lineTo(bx + 13, by); ctx.lineTo(bx, by + 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawFartClouds() {
    const t = performance.now() / 220;
    for (const c of fartClouds) {
      const x = c.x - cameraX, cx = x + c.w/2, cy = c.y + c.h/2;
      // Curva de opacidade: densa no começo, fade-out no último terço.
      const k = c.life / c.maxLife;
      const alpha = Math.min(0.92, k < 0.33 ? k * 2.7 : 0.9);
      ctx.save(); ctx.globalAlpha = alpha;
      // Miolo escuro (verde musgo) — dá corpo à nuvem
      ctx.fillStyle = "#5c8a2b";
      ctx.beginPath(); ctx.ellipse(cx, cy, c.w * 0.55, c.h * 0.6, 0, 0, 7); ctx.fill();
      // Camadas de bolhas em torno pra parecer nuvem densa
      ctx.fillStyle = "#7fb043";
      const puffs = [
        [-c.w*0.35,  c.h*0.05, 0.42, 0.48, 0.0],
        [ c.w*0.30,  c.h*0.10, 0.44, 0.50, 0.6],
        [-c.w*0.15, -c.h*0.35, 0.34, 0.38, 0.3],
        [ c.w*0.10, -c.h*0.30, 0.36, 0.40, 0.9],
        [-c.w*0.28,  c.h*0.30, 0.30, 0.32, 1.2],
        [ c.w*0.32,  c.h*0.28, 0.32, 0.34, 1.5],
      ];
      for (const [dx, dy, rx, ry, ph] of puffs) {
        const wob = Math.sin(t + ph) * 2;
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + dy + wob, c.w * rx, c.h * ry, 0, 0, 7);
        ctx.fill();
      }
      // Reflexos amarelados (destaque no topo)
      ctx.fillStyle = "#c4dc7c";
      ctx.beginPath(); ctx.ellipse(cx - c.w*0.18, cy - c.h*0.35, c.w * 0.22, c.h * 0.22, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + c.w*0.22, cy - c.h*0.32, c.w * 0.18, c.h * 0.18, 0, 0, 7); ctx.fill();
      // Contorno tênue pra separar do fundo em áreas claras
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = "#3f5f1c"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, c.w * 0.58, c.h * 0.62, 0, 0, 7); ctx.stroke();
      // Umas "partículas" pontuais para dar textura
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = "#8fbf5a";
      for (let i = 0; i < 5; i++) {
        const a = t * 0.6 + i * 1.3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * c.w * 0.3, cy + Math.sin(a) * c.h * 0.35, 2 + (i % 2), 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawOstrichRunaways() {
    for (const o of ostrichRunaways) {
      const face = o.vx < 0 ? -1 : 1;
      drawOstrich(o.x - cameraX, o.y, MOUNT_SIZE.w, MOUNT_SIZE.h, face, { walk: performance.now() / 40, peck: 0 });
    }
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
    // Tremor de tela: aplica offset aleatório em todo o mundo enquanto shakeT > 0.
    const shaking = shakeT > 0 && shakeMag > 0.2;
    if (shaking) {
      const dx = (Math.random() * 2 - 1) * shakeMag;
      const dy = (Math.random() * 2 - 1) * shakeMag;
      ctx.save(); ctx.translate(dx, dy);
    }
    drawBackground();
    drawSolids();
    if (bossStage) { drawLava(); drawSpikes(); drawGeysers(); drawLavaShots(); }
    drawCoins();
    drawPowerups();
    drawFlag();
    drawEnemies();
    drawEnemyShots();
    if (bossStage) { drawBoss(); drawBossShots(); }
    drawFireballs();
    drawFartClouds();
    drawOstrichRunaways();
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
    if (shaking) ctx.restore();
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
  // 20 nós formando uma TRILHA sinuosa (serpenteia entre as montanhas),
  // agrupados em 5 mundos (3 fases + 1 chefão cada).
  const MAP_NODES = (() => {
    const nodes = [], perRow = 5, ys = [112, 201, 290, 374], x0 = 84, x1 = 716;
    for (let r = 0; r < 4; r++) for (let k = 0; k < perRow; k++) {
      const idx = r * perRow + k;
      const kk = (r % 2 === 0) ? k : (perRow - 1 - k);      // serpentina (vai e volta)
      const t = kk / (perRow - 1);
      // duas senoides somadas → curva bem sinuosa e pouco previsível
      const x = x0 + (x1 - x0) * t + Math.sin(kk * 1.7 + r * 2.1) * 22 + Math.sin(kk * 3.1 + r) * 9;
      const y = ys[r] + Math.sin(kk * 1.2 + r * 1.7) * 26 + Math.sin(kk * 2.6 + r * 0.6) * 12;
      nodes.push({ x, y, world: worldOf(idx), boss: stageIsBoss(idx) });
    }
    return nodes;
  })();
  // Segmentos (entre nó i e i+1) que atravessam água por uma ponte
  const BRIDGE_SEGS = [1, 6, 12, 17];
  function drawChannel(a, b) {   // canal d'água cruzando por baixo da ponte
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
    ctx.fillStyle = "#3f97da"; ctx.beginPath(); ctx.ellipse(0, 0, 62, 27, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#5aa9e6"; ctx.beginPath(); ctx.ellipse(0, 0, 62, 27, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.beginPath(); ctx.ellipse(-12, -7, 20, 5, 0.3, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawBridge(a, b) {     // ponte de madeira com corrimão
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), w = 15;
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, w - 1, len, 5);       // sombra
    ctx.fillStyle = "#b9822f";
    const n = Math.max(5, Math.floor(len / 9));
    for (let i = 0; i <= n; i++) { const px = len * (i / n); ctx.fillRect(px - 3, -w, 6, w * 2); }  // tábuas
    ctx.fillStyle = "#8a5a24"; ctx.fillRect(0, -w, len, 3); ctx.fillRect(0, w - 3, len, 3);          // travessas
    ctx.strokeStyle = "#caa06a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -w - 4); ctx.lineTo(len, -w - 4); ctx.moveTo(0, w + 4); ctx.lineTo(len, w + 4); ctx.stroke();
    ctx.fillStyle = "#6e4c22";
    for (const p of [0.16, 0.5, 0.84]) { const px = len * p; ctx.fillRect(px - 1.5, -w - 6, 3, 6); ctx.fillRect(px - 1.5, w, 3, 6); }
    ctx.restore();
  }
  // Traça uma curva suave passando pelos nós (pontos médios com quadráticas)
  function traceTrail(pts, count) {
    const N = (count == null ? pts.length : count);
    if (N < 1) return;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    if (N >= 2) ctx.lineTo(pts[N - 1].x, pts[N - 1].y);
  }
  const WORLD_COLOR = ["#5fa83d", "#2f9a58", "#e0b866", "#8a6ad6", "#7fb8ff"];  // por tema
  const WORLD_NAME  = ["🌳 Bosque", "🌴 Selva", "🏖️ Praia", "🏰 Castelo", "☁️ Céu"];

  // Decorações do mapa. As MONTANHAS são desenhadas atrás da trilha (que
  // serpenteia no meio delas); o resto preenche os vãos. Arte 100% original.
  const MAP_DECOR = [
    // cordilheira do topo
    { t: "mtn",   x: 128, y: 96,  s: 1.15 },
    { t: "mtn",   x: 300, y: 88,  s: 1.35 },
    { t: "mtn",   x: 470, y: 92,  s: 1.2 },
    { t: "mtn",   x: 636, y: 90,  s: 1.3 },
    // montanhas entre as fileiras (a trilha passa entre elas)
    { t: "mtn",   x: 205, y: 168, s: 1.0 },
    { t: "mtn",   x: 396, y: 158, s: 1.25 },
    { t: "mtn",   x: 585, y: 166, s: 1.05 },
    { t: "mtn",   x: 118, y: 252, s: 1.1 },
    { t: "mtn",   x: 500, y: 250, s: 1.15 },
    { t: "mtn",   x: 690, y: 256, s: 1.0 },
    { t: "mtn",   x: 260, y: 346, s: 1.05 },
    { t: "mtn",   x: 452, y: 344, s: 1.2 },
    // vegetação e marcos nos cantos livres
    { t: "tree",  x: 78,  y: 150, s: 1.0 },
    { t: "tree2", x: 700, y: 150, s: 1.0 },
    { t: "pond",  x: 360, y: 240, s: 1.0 },
    { t: "castle",x: 636, y: 336, s: 1.0 },
    { t: "tree",  x: 96,  y: 336, s: 1.0 },
    { t: "bush",  x: 330, y: 408, s: 1.0 },
    { t: "palm",  x: 150, y: 410, s: 1.0 },
    { t: "palm",  x: 600, y: 410, s: 1.0 },
    { t: "bush",  x: 720, y: 402, s: 1.0 },
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
    ctx.fillStyle = "#ecd79a"; mapBlob(400, 244, 374, 188, 0.045, 0.6); ctx.fill();   // areia/litoral
    ctx.restore();
    ctx.fillStyle = "#6fae54"; mapBlob(400, 244, 352, 172, 0.05, 0.6); ctx.fill();    // grama
    ctx.fillStyle = "rgba(255,255,255,.08)"; mapBlob(400, 230, 328, 146, 0.05, 0.6); ctx.fill(); // luz no topo

    // --- canais d'água sob as pontes (desenhados na grama) ---
    for (const i of BRIDGE_SEGS) if (MAP_NODES[i + 1]) drawChannel(MAP_NODES[i], MAP_NODES[i + 1]);

    // --- montanhas ao fundo (a trilha passa no meio delas) ---
    for (const d of MAP_DECOR) {
      if (d.t !== "mtn") continue;
      if (MAP_NODES.some(n => Math.hypot(n.x - d.x, n.y - d.y) < 30)) continue;
      mapMountain(d.x, d.y, d.s);
    }

    // --- trilha sinuosa ligando os nós (curva suave, com contorno) ---
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(120,86,30,.55)"; ctx.lineWidth = 15;
    traceTrail(MAP_NODES); ctx.stroke();
    ctx.strokeStyle = "#efdca6"; ctx.lineWidth = 10; ctx.stroke();
    // trecho já concluído em tom mais quente
    if (unlocked > 0) {
      ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = 10;
      traceTrail(MAP_NODES, Math.min(unlocked, MAP_NODES.length - 1) + 1); ctx.stroke();
    }
    // pontilhado central
    ctx.strokeStyle = "rgba(150,110,40,.5)"; ctx.lineWidth = 2; ctx.setLineDash([2, 12]);
    traceTrail(MAP_NODES); ctx.stroke(); ctx.setLineDash([]);

    // --- pontes de madeira sobre os canais ---
    for (const i of BRIDGE_SEGS) if (MAP_NODES[i + 1]) drawBridge(MAP_NODES[i], MAP_NODES[i + 1]);

    // --- demais decorações --- (pula as que ficariam sobre um nó)
    for (const d of MAP_DECOR) {
      if (d.t === "mtn") continue;   // montanhas já desenhadas atrás da trilha
      if (MAP_NODES.some(n => Math.hypot(n.x - d.x, n.y - d.y) < 44)) continue;
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
      // disco (nós de chefão em tom carmim)
      ctx.fillStyle = done ? "#39c463" : (open ? (n.boss ? "#b03048" : WORLD_COLOR[n.world]) : "#8a8f9a");
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
      if (n.boss) { ctx.font = "14px sans-serif"; ctx.fillText("👑", n.x, n.y - R - 8); }  // marca de chefão
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
    ctx.fillText("🗺️ Fase " + (mapSel + 1) + "/20" + (MAP_NODES[mapSel].boss ? " · 👑 Chefão" : " · " + WORLD_NAME[MAP_NODES[mapSel].world]), W / 2, 31);
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
      enemyShots: () => enemyShots,
      boss: () => boss,
      bossShots: () => bossShots,
      lavas: () => lavas,
      spikes: () => spikes,
      geysers: () => geysers,
      lavaShots: () => lavaShots,
      fartClouds: () => fartClouds,
      mount: () => player.mount,
      mountUp: () => mountUp(),
      dismount: (runAway) => dismount(!!runAway),
      hurtBoss: (n) => bossHurt(n || 1),
      get bossStage() { return bossStage; },
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
