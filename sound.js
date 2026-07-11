/* ============================================================
   SAPO BROS — Motor de áudio (chiptune 8-bit, Web Audio API)
   Efeitos sonoros e música de fundo ORIGINAIS, no estilo dos
   clássicos plataformas 8-bit (sem usar áudio protegido).
   Tudo sintetizado no navegador — nenhum arquivo externo.
   ============================================================ */
window.Sound = (() => {
  "use strict";
  let ctx = null, master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    return ctx;
  }
  // Deve ser chamado dentro de um gesto do usuário (iOS Safari exige).
  function resume() {
    ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
    loadVoices();
  }

  // ---- Vozes dos personagens (clipes do usuário, base64 MP3 em voices.js) ----
  // Tocam pelo MESMO caminho dos efeitos (Web Audio), que já funciona no iPhone.
  // MP3 é decodificado com segurança pelo decodeAudioData no Safari e no Chrome.
  const voiceBuffers = {};   // nome -> AudioBuffer
  let voicesLoading = false;
  function b64ToArrayBuffer(dataUri) {
    const b64 = dataUri.split(",")[1] || "";
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function loadVoices() {
    if (voicesLoading || !ensure() || !window.VOICES) return;
    voicesLoading = true;
    for (const name in window.VOICES) {
      try {
        const ab = b64ToArrayBuffer(window.VOICES[name]);
        const p = ctx.decodeAudioData(ab, (buf) => { voiceBuffers[name] = buf; }, () => {});
        if (p && typeof p.then === "function") p.then((buf) => { voiceBuffers[name] = buf; }).catch(() => {});
      } catch (e) { /* clipe inválido */ }
    }
  }
  function playVoice(name) {
    if (muted || !ensure()) return;
    const buf = voiceBuffers[name];
    if (!buf) return;                    // ainda decodificando ou ausente
    try {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = 3.0;                // voz bem acima da música/efeitos
      src.buffer = buf;
      src.connect(g); g.connect(master);
      src.start();
    } catch (e) {}
  }

  // Uma nota com envelope (ataque rápido + decaimento exponencial).
  function tone(freq, dur, type, when, vol, freqEnd) {
    if (!ensure() || muted) return;
    type = type || "square"; when = when || 0; vol = vol == null ? 0.3 : vol;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  // Sequência de notas: [[freq,dur], ...]  (freq 0 = pausa)
  function seq(notes, type, vol, gap) {
    gap = gap || 0;
    let t = 0;
    for (const n of notes) { if (n[0]) tone(n[0], n[1] * 0.92, type, t, vol); t += n[1] + gap; }
  }

  // ---- Efeitos (composições originais em estilo 8-bit) ----
  const SFX = {
    jump:       () => tone(300, 0.15, "square",   0, 0.3, 760),
    coin:       () => seq([[988,0.08],[1319,0.2]], "square", 0.26),
    stomp:      () => tone(220, 0.12, "square",   0, 0.32, 70),
    shoot:      () => tone(720, 0.1,  "square",   0, 0.24, 180),
    kick:       () => tone(180, 0.14, "triangle", 0, 0.3, 60),
    bump:       () => tone(180, 0.08, "square",   0, 0.25, 120),
    powerup:    () => seq([[392,0.06],[523,0.06],[659,0.06],[784,0.06],[1047,0.06],[1319,0.12]], "square", 0.24),
    powerdown:  () => seq([[659,0.09],[494,0.09],[392,0.09],[311,0.16]], "square", 0.28),
    die:        () => seq([[659,0.12],[0,0.06],[523,0.12],[392,0.16],[262,0.3]], "square", 0.3),
    levelclear: () => seq([[523,0.1],[659,0.1],[784,0.1],[1047,0.24],[784,0.08],[1047,0.34]], "square", 0.26),
    gameover:   () => seq([[392,0.16],[311,0.16],[262,0.16],[196,0.45]], "triangle", 0.3),
    oneup:      () => seq([[784,0.08],[1047,0.08],[1319,0.08],[1568,0.18]], "square", 0.24),
  };

  function play(name) {
    if (muted) return;
    if (!ensure()) return;
    if (SFX[name]) { try { SFX[name](); } catch (e) {} }
  }

  // ---- Música de fundo (loop chiptune original) ----
  const STEP = 0.14;                 // segundos por passo
  const LEAD = [                     // melodia (0 = pausa)
    523,659,784,1047, 784,659,523,0,
    587,698,880,1175, 880,698,587,0,
    523,659,784,1047, 1319,1047,784,659,
    587,494,587,698,  784,659,523,0
  ];
  const BASS = [                     // baixo (mais grave)
    131,0,196,0, 131,0,196,0,
    147,0,196,0, 147,0,196,0,
    131,0,196,0, 131,0,196,0,
    98,0,147,0,  196,0,131,0
  ];
  let musicOn = false, step = 0, nextTime = 0, timer = null;

  function scheduler() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.12) {
      const rel = nextTime - ctx.currentTime;
      const lf = LEAD[step % LEAD.length];
      const bf = BASS[step % BASS.length];
      if (lf) tone(lf, STEP * 0.9, "square", rel, 0.10);
      if (bf) tone(bf, STEP * 0.95, "triangle", rel, 0.13);
      nextTime += STEP; step++;
    }
  }
  function startMusic() {
    if (muted || musicOn || !ensure()) return;
    musicOn = true;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(scheduler, 25);
  }
  function stopMusic() {
    musicOn = false;
    if (timer) { clearInterval(timer); timer = null; }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.22;
    if (muted) stopMusic();
  }

  // Pré-decodifica as vozes já no carregamento (não depende de gesto):
  // assim os buffers ficam prontos antes do primeiro power-up, evitando
  // que a voz saia muda por corrida de tempo (ex.: cogumelo logo no início).
  try { loadVoices(); } catch (e) {}

  return {
    play, playVoice, resume, startMusic, stopMusic, setMuted,
    preloadVoices: loadVoices,
    isMuted: () => muted,
    isMusicOn: () => musicOn,
    hasVoice: (name) => !!voiceBuffers[name],
  };
})();
