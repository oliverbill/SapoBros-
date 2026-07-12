/* ============================================================
   examples/espaco.config.js  —  SEGUNDO EXEMPLO (tema sci-fi)
   ------------------------------------------------------------
   Mesmo motor, conteúdo diferente. Serve de referência de estilo.
   Para ver: abra index.html?config=espaco  (sem a extensão .config.js)
   Todos os assets são opcionais — roda com placeholders coloridos.
   ============================================================ */
window.GAME_CONFIG = {
  title: "GALÁXIA RÃ 🚀",
  lives: 3,
  worldMap: true,        // usa o mapa de fases (trilha)
  infiniteLives: false,  // pode ligar no menu também

  view: { width: 800, height: 450, tile: 40, gravity: 0.6, jumpSpeed: -12.8, maxSpeed: 4.8 },

  players: [
    { id: "astro", name: "Astro", image: "assets/players/astro.png", voice: "vAstro", w: 30, h: 38 },
    { id: "nova",  name: "Nova",  image: "assets/players/nova.png",  voice: "vNova",  w: 30, h: 38 },
  ],

  themes: {
    estacao: { sky: ["#141026", "#2a1e4a"], ground: { top: "#8a8f9a", dirt: "#3d414a" } },
    planeta: { sky: ["#3a1030", "#7a2a4a"], ground: { top: "#c06a3a", dirt: "#5a2a1a" } },
    nave:    { sky: ["#04121a", "#0a2438"], ground: { top: "#2e6a8a", dirt: "#123244" } },
  },

  // Mesmos comportamentos do catálogo, com "cara" diferente
  enemies: {
    drone:    { image: "assets/enemies/drone.png",    behavior: "flyer",   w: 30, h: 26, color: "#39c1c4" },
    androide: { image: "assets/enemies/androide.png", behavior: "walker",  w: 32, h: 34, color: "#9aa0aa" },
    canhao:   { image: "assets/enemies/canhao.png",   behavior: "turret",  w: 32, h: 30, color: "#c0392b", shootEvery: 90, shotSpeed: 4 },
    saltarino:{ image: "assets/enemies/saltarino.png",behavior: "jumper",  w: 30, h: 30, color: "#7a3fb0", jumpEvery: 90 },
    minaVoad: { image: "assets/enemies/mina.png",     behavior: "diver",   w: 30, h: 28, color: "#e0803a" },
    orbe:     { image: "assets/enemies/orbe.png",     behavior: "drifter", w: 30, h: 30, color: "#b48ae0" },
  },

  bosses: {
    sentinela: { image: "assets/bosses/sentinela.png", behavior: "ghost",  w: 60, h: 60, hp: 4, name: "Sentinela", color: "#8fb0ff" },
    nucleo:    { image: "assets/bosses/nucleo.png",    behavior: "dragon", w: 82, h: 82, hp: 6, name: "Núcleo-X",  color: "#c0392b" },
  },

  powerups: {
    escudo:  { image: "assets/enemies/escudo.png", effect: "grow", color: "#39c463" },
    blaster: { image: "assets/enemies/blaster.png",effect: "fire", color: "#ff8a2a" },
    jetpack: { image: "assets/enemies/jetpack.png",effect: "fly",  color: "#8fd0ff" },
  },

  voices: { vAstro: "assets/voices/astro.mp3", vNova: "assets/voices/nova.mp3", alerta: "assets/voices/alerta.mp3" },
  voiceEvents: { powerup: "@player", hurt: "alerta", die: "@player" },

  music: { estacao: "assets/music/estacao.mp3", planeta: "assets/music/planeta.mp3", nave: "assets/music/nave.mp3" },

  legend: {
    "d": { enemy: "drone" }, "n": { enemy: "androide" }, "c": { enemy: "canhao" },
    "j": { enemy: "saltarino" }, "m": { enemy: "minaVoad" }, "o": { enemy: "orbe" },
    "S": { powerup: "escudo" }, "R": { powerup: "blaster" }, "W": { powerup: "jetpack" },
    "Z": { boss: "sentinela" }, "X": { boss: "nucleo" },
  },

  levels: [
    { theme: "estacao", music: "estacao", map:
`................................................................
.........?.?....................................................
..............BBBB..............................................
.......?..................?.?.?.................................
....BBB.........n.....BBBB.............j.........F..............
..P........S........d...........c.........B.....G..............
GGGGGGGGGG..GGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG` },
    { theme: "planeta", music: "planeta", map:
`................................................................
...........?..?..?..............................................
..........BBBBBBB.........d..............?.?.?.................
...................R................BBBBB.......................
....?.........j........o.......c..........m.........F..........
..P.....n.........BBB.......d..........j.......o....G..........
GGGGGGGG..GGGGGGGGGGGGG..GGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGG` },
    { // arena do 1º chefão (fantasma) — nave escura
      theme: "nave", music: "nave", map:
`B....................B
B....................B
B....................B
B....................B
B....................B
B^..................^B
B^..................^B
B....................B
B..P............Z...B
BLLGGGGGGGGGGGGGGGGLLB` },
    { theme: "planeta", music: "planeta", map:
`................................................................
............?.?.?...............................................
.........BBBB.........m.........d.......?.?.?..................
...................................BBBBB.......................
...?......c......j.......o......n........c.........F..........
..P...m.......BBB.....d.......j.......o.......n....G..........
GGGGGG..GGGGGGGGGGG..GGGGGGGGG..GGGGGGGGGGG..GGGGGGGGGGGGGGGGGG` },
    { // arena do chefe final (Núcleo-X, dragon)
      theme: "nave", music: "nave", map:
`B....................B
B....................B
B....................B
B....................B
B....................B
B^..................^B
B^..................^B
B....................B
B..P............X...B
BLLGGGGGGGGGGGGGGGGLLB` },
  ],
};
