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

  // Rajada de ruído com filtro passa-banda varrendo (whoosh/sucção)
  function whoosh(dur, f0, f1, vol) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + 0.01;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
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
    pipe:       () => seq([[520,0.06],[380,0.06],[280,0.08],[190,0.12]], "square", 0.28),
    // sucção do cano: assobio subindo + whoosh de ruído + "slurp" descendo
    suck:       () => { tone(140, 0.42, "sawtooth", 0, 0.20, 1300); tone(680, 0.34, "sine", 0.03, 0.14, 80); whoosh(0.42, 260, 2400, 0.26); },
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

  // ---- Música de TERROR (subterrâneo) — composição original em menor/trítono ----
  const HSTEP = 0.34;                 // lenta e arrastada
  // melodia esparsa e sinistra (0 = pausa)
  const HLEAD = [
    440,0,0,415, 0,349,0,0, 311,0,0,330, 0,0,262,0,
    440,0,0,466, 0,415,0,0, 311,0,0,0,   0,247,0,0
  ];
  // drone grave alternando raiz e trítono (tensão)
  const HBASS = [
    55,55,55,55, 77.8,77.8,77.8,77.8, 55,55,55,55, 82.4,82.4,77.8,77.8,
    55,55,55,55, 73.4,73.4,73.4,73.4, 58.3,58.3,58.3,58.3, 82.4,82.4,77.8,77.8
  ];
  let horrorOn = false, hstep = 0, hnext = 0, htimer = null;
  function horrorScheduler() {
    if (!ctx) return;
    while (hnext < ctx.currentTime + 0.2) {
      const rel = hnext - ctx.currentTime;
      const lf = HLEAD[hstep % HLEAD.length];
      const bf = HBASS[hstep % HBASS.length];
      if (lf) tone(lf, HSTEP * 1.4, "sawtooth", rel, 0.055);   // lead fino e baixo
      if (bf) tone(bf, HSTEP * 1.9, "triangle", rel, 0.14);    // drone grave
      // batida cardíaca ocasional (tensão)
      if (hstep % 8 === 0) tone(48, 0.16, "sine", rel, 0.16);
      hnext += HSTEP; hstep++;
    }
  }
  function startHorror() {
    if (muted || horrorOn || !ensure()) return;
    horrorOn = true; hstep = 0;
    hnext = ctx.currentTime + 0.05;
    htimer = setInterval(horrorScheduler, 25);
  }
  function stopHorror() {
    horrorOn = false;
    if (htimer) { clearInterval(htimer); htimer = null; }
  }

  // ---- Uivo de lobo ao fundo (subterrâneo) — som sintetizado original ----
  let wolvesOn = false, wolfTimer = null, wolfCount = 0;
  function howl() {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const vib = ctx.createOscillator();     // vibrato
    const vibg = ctx.createGain();
    osc.type = "sawtooth";
    vib.frequency.value = 6; vibg.gain.value = 8;
    vib.connect(vibg); vibg.connect(osc.frequency);
    // envelope de altura: sobe, segura, cai (como um uivo)
    osc.frequency.setValueAtTime(190, t0);
    osc.frequency.linearRampToValueAtTime(340, t0 + 0.5);
    osc.frequency.setValueAtTime(340, t0 + 1.1);
    osc.frequency.linearRampToValueAtTime(180, t0 + 2.1);
    // volume suave
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.10, t0 + 0.25);
    g.gain.setValueAtTime(0.10, t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    osc.connect(g); g.connect(master);
    osc.start(t0); vib.start(t0);
    osc.stop(t0 + 2.3); vib.stop(t0 + 2.3);
  }
  function wolfTick() {
    if (!wolvesOn) return;
    wolfCount = (wolfCount + 1) % 5;      // uiva a cada ~5s (timer de 1s)
    if (wolfCount === 1) howl();
  }
  function startWolves() {
    if (muted || wolvesOn || !ensure()) return;
    wolvesOn = true; wolfCount = 0;
    howl();
    wolfTimer = setInterval(wolfTick, 1000);
  }
  function stopWolves() {
    wolvesOn = false;
    if (wolfTimer) { clearInterval(wolfTimer); wolfTimer = null; }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.22;
    if (muted) { stopMusic(); stopWolves(); stopHorror(); }
  }

  // Pré-decodifica as vozes já no carregamento (não depende de gesto):
  // assim os buffers ficam prontos antes do primeiro power-up, evitando
  // que a voz saia muda por corrida de tempo (ex.: cogumelo logo no início).
  try { loadVoices(); } catch (e) {}

  return {
    play, playVoice, resume, startMusic, stopMusic, setMuted,
    startWolves, stopWolves, startHorror, stopHorror,
    preloadVoices: loadVoices,
    isMuted: () => muted,
    isMusicOn: () => musicOn,
    hasVoice: (name) => !!voiceBuffers[name],
  };
})();
