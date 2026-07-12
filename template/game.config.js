/* ============================================================
   game.config.js  —  ⚙️ EDITE ESTE ARQUIVO PARA CRIAR SEU JOGO
   ------------------------------------------------------------
   Aponte suas imagens, vozes e músicas, descreva os inimigos e
   chefões (escolhendo um COMPORTAMENTO por nome) e monte as fases
   com mapas em texto (ASCII). O engine.js lê isto e cria o jogo.

   • Faltou uma imagem? O motor desenha um bloco colorido no lugar
     (com o nome do comportamento), então dá para testar sem arte.
   • Faltou áudio? O jogo roda com efeitos sonoros sintetizados.

   COMPORTAMENTOS DE INIMIGO disponíveis (campo "behavior"):
     walker   – anda e vira nas beiras
     hopper   – dá pulinhos frequentes            (jumpEvery)
     roller   – bola rápida que cai das beiras
     jumper   – pula em direção ao jogador         (jumpEvery)
     shooter  – atira um projétil reto             (shootEvery, shotSpeed)
     lobber   – arremessa bombas em arco           (shootEvery)
     splitter – ao ser pisado, vira dois menores
     charger  – dispara numa corrida quando perto  (range)
     drifter  – fantasma que persegue pelo ar
     flyer    – voa em onda senoidal
     diver    – voa e mergulha no jogador
     zigzag   – voa em ziguezague
     turret   – atirador blindado (só morre com fogo) (shootEvery)
     spiker   – espinho: não pode ser pisado
     bomber   – voa e solta bombas                 (shootEvery)
     spitter  – atira um leque de 3 projéteis       (shootEvery)

   COMPORTAMENTOS DE CHEFÃO (campo "behavior"):
     brute  – anda e investe (pise nele)
     plant  – sobe do chão e cospe (acerte quando estiver pra fora)
     ghost  – só avança quando você está de costas; encare para feri-lo
     mole   – cava e salta (pise quando aparecer)
     dragon – pula, cospe fogo e joga martelo (chefe final)
   Todos: use fogo 🔥 ou pise (quando vulnerável). "hp" = nº de golpes.
   ============================================================ */
window.GAME_CONFIG = {
  title: "MEU JOGO 🐸",
  lives: 3,

  // Motor (deixe assim ou ajuste; tile = tamanho do bloco em px)
  view: { width: 800, height: 450, tile: 40, gravity: 0.62, jumpSpeed: -12.4, powerJumpSpeed: -14.6, maxSpeed: 4.6 },

  // -------- Personagens jogáveis --------
  players: [
    { id: "hero1", name: "Herói 1", image: "assets/players/hero1.png", voice: "voiceHero", w: 30, h: 38 },
    { id: "hero2", name: "Herói 2", image: "assets/players/hero2.png", voice: "voiceHero2", w: 30, h: 38 },
  ],

  // -------- Cenários / temas (fundo + cor do chão) --------
  // Use "bgImage" para uma imagem de fundo com parallax, OU "sky" (gradiente).
  themes: {
    campo:   { sky: ["#5c94fc", "#a8e0ff"], ground: { top: "#5fa83d", dirt: "#8a5a2b" } /* , bgImage:"assets/backgrounds/campo.png" */ },
    caverna: { sky: ["#0a0e1a", "#1a2138"], ground: { top: "#3a4670", dirt: "#2b3552" } },
    castelo: { sky: ["#241a22", "#3a2630"], ground: { top: "#6b6f7a", dirt: "#3d414a" } },
  },

  // -------- Inimigos (imagem + comportamento) --------
  enemies: {
    caminhante: { image: "assets/enemies/caminhante.png", behavior: "walker",  w: 32, h: 32, color: "#8e44ad" },
    saltador:   { image: "assets/enemies/saltador.png",   behavior: "hopper",  w: 30, h: 30, color: "#e08a2e", jumpEvery: 46 },
    atirador:   { image: "assets/enemies/atirador.png",   behavior: "shooter", w: 32, h: 32, color: "#7a3fb0", shootEvery: 110, shotSpeed: 3 },
    voador:     { image: "assets/enemies/voador.png",     behavior: "flyer",   w: 30, h: 26, color: "#c99a2e" },
    espinho:    { image: "assets/enemies/espinho.png",    behavior: "spiker",  w: 32, h: 30, color: "#37506b" },
    bombardeiro:{ image: "assets/enemies/bombardeiro.png",behavior: "bomber",  w: 34, h: 26, color: "#4a4a4a", shootEvery: 90 },
  },

  // -------- Chefões (imagem + comportamento + vida) --------
  bosses: {
    reptil: { image: "assets/bosses/reptil.png", behavior: "brute",  w: 62, h: 56, hp: 3, name: "Réptil",   color: "#3d5a2a" },
    dragao: { image: "assets/bosses/dragao.png", behavior: "dragon", w: 80, h: 82, hp: 5, name: "Rei Dragão", color: "#3a7d2e" },
  },

  // -------- Power-ups (effect: grow | fire | fly) --------
  powerups: {
    cogumelo: { image: "assets/enemies/cogumelo.png", effect: "grow", color: "#e63b2e" },
    flor:     { image: "assets/enemies/flor.png",     effect: "fire", color: "#ff8a2a" },
    asa:      { image: "assets/enemies/asa.png",      effect: "fly",  color: "#8fd0ff" },
  },

  // -------- Vozes (arquivos mp3/ogg) --------
  voices: {
    voiceHero:  "assets/voices/hero1.mp3",
    voiceHero2: "assets/voices/hero2.mp3",
    dano:       "assets/voices/ai.mp3",
  },
  // Quando cada voz toca. Use "@player" para a voz do personagem escolhido.
  voiceEvents: { powerup: "@player", hurt: "dano", die: "@player" },

  // -------- Músicas por tema (arquivos mp3/ogg) --------
  music: {
    campo:   "assets/music/campo.mp3",
    caverna: "assets/music/caverna.mp3",
    castelo: "assets/music/castelo.mp3",
  },

  // -------- Legenda dos mapas --------
  // Fixos: G chão · B tijolo · ? moeda · P início · F bandeira · L lava · ^ espinho
  // Livres: aponte letras para seus inimigos/power-ups/chefão:
  legend: {
    "a": { enemy: "caminhante" },
    "s": { enemy: "saltador" },
    "t": { enemy: "atirador" },
    "v": { enemy: "voador" },
    "e": { enemy: "espinho" },
    "b": { enemy: "bombardeiro" },
    "M": { powerup: "cogumelo" },
    "R": { powerup: "flor" },
    "W": { powerup: "asa" },
    "Z": { boss: "reptil" },
    "X": { boss: "dragao" },
  },

  // -------- Fases -------- (linear: uma após a outra)
  // Cada fase: um tema + um mapa. Se colocar um chefão (Z/X), vira arena.
  levels: [
    {
      theme: "campo", music: "campo",
      map:
`................................................................
.........?.?....................................................
..............BBBB..............................................
.......?..................?.?.?.................................
....BBB.........a.....BBBB.............s.........F..............
..P........M........a...........t.........B.....G..............
GGGGGGGGGG..GGGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG`,
    },
    {
      theme: "campo", music: "campo",
      map:
`................................................................
...........?..?..?..............................................
..........BBBBBBB.........v..............?.?.?.................
...................R................BBBBB.......................
....?.........s........e.......t..........v.........F..........
..P.....a.........BBB.......b..........s.......e....G..........
GGGGGGGG..GGGGGGGGGGGGG..GGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGG`,
    },
    {
      // Arena de chefão (castelo com lava e espinhos)
      theme: "castelo", music: "castelo",
      map:
`B....................B
B....................B
B....................B
B....................B
B....................B
B^..................^B
B^..................^B
B....................B
B..P............Z...B
BLLGGGGGGGGGGGGGGGGLLB`,
    },
  ],
};
