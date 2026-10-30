// =====================================================================
// sound.js — efeitos sonoros do jogo
// Todos os sons são gerados na hora pelo navegador (Web Audio), sem arquivos de áudio.
// A escolha de ligar/desligar fica salva neste navegador.
// Uso: SFX.play("attack"), SFX.toggle(), SFX.enabled
// =====================================================================
const SFX = (() => {
  let ctx = null, master = null, enabled = true, stepAlt = false;
  try { if (localStorage.getItem("tlh-sound") === "off") enabled = false; } catch (e) {}

  // O navegador só libera o áudio depois de um clique ou tecla do jogador.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Nota simples com envelope; "slide" muda a frequência ao longo do som.
  function tone(freq, dur, { type = "square", vol = 0.18, slide = 0, delay = 0 } = {}) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // Ruído filtrado: passos, golpes, vento.
  function noise(dur, { vol = 0.15, delay = 0, type = "lowpass", freq = 1200, q = 0.8 } = {}) {
    const t = ctx.currentTime + delay, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const arpeggio = (notes, step, opts) => notes.forEach((f, i) => tone(f, step * 1.4, { ...opts, delay: (opts?.delay || 0) + i * step }));

  const SOUNDS = {
    // passos: o som muda conforme o chão (trilha/calçada, musgo ou mato espinhoso)
    step(surface) {
      stepAlt = !stepAlt; const p = stepAlt ? 1 : 0.85;
      if (surface === "hard") { noise(0.05, { vol: 0.11, type: "bandpass", freq: 1800 * p, q: 2 }); tone(120 * p, 0.04, { type: "triangle", vol: 0.05 }); }
      else if (surface === "grass") noise(0.13, { vol: 0.08, type: "highpass", freq: 2600 * p });
      else noise(0.07, { vol: 0.08, type: "lowpass", freq: 700 * p });
    },
    bump() { tone(90, 0.06, { type: "triangle", vol: 0.08 }); },
    alert() { tone(880, 0.08, { vol: 0.14 }); tone(1320, 0.14, { vol: 0.14, delay: 0.09 }); },
    battleStart() { arpeggio([196, 233, 277, 330, 392], 0.06, { type: "sawtooth", vol: 0.09 }); noise(0.35, { vol: 0.07, type: "highpass", freq: 3000, delay: 0.05 }); },
    attack(strong) {
      noise(0.14, { vol: 0.22, type: "bandpass", freq: strong ? 900 : 1600, q: 1.2 });
      tone(strong ? 330 : 620, 0.16, { type: "sawtooth", vol: 0.12, slide: strong ? -220 : -380 });
      if (strong) tone(110, 0.3, { type: "square", vol: 0.12, slide: -60, delay: 0.04 });
    },
    hurt() { tone(170, 0.18, { type: "square", vol: 0.16, slide: -90 }); noise(0.1, { vol: 0.16, type: "lowpass", freq: 500 }); },
    noEffect() { tone(140, 0.25, { type: "triangle", vol: 0.12, slide: -40 }); },
    faint() { tone(520, 0.45, { type: "triangle", vol: 0.14, slide: -440 }); },
    victory() { arpeggio([523, 659, 784, 1047], 0.11, { type: "square", vol: 0.1 }); tone(1047, 0.35, { type: "triangle", vol: 0.1, delay: 0.46 }); },
    defeat() { arpeggio([392, 330, 262, 196], 0.18, { type: "triangle", vol: 0.14 }); },
    run() { noise(0.3, { vol: 0.12, type: "bandpass", freq: 1200, q: 0.6 }); tone(500, 0.2, { type: "sine", vol: 0.06, slide: 600 }); },
    levelup() { arpeggio([523, 659, 784, 1047, 1319], 0.08, { type: "square", vol: 0.1 }); },
    rune(ok) { ok ? tone(988, 0.25, { type: "sine", vol: 0.14 }) : tone(160, 0.3, { type: "sawtooth", vol: 0.1, slide: -40 }); },
    medal() { arpeggio([784, 988, 1175, 1568, 1976], 0.07, { type: "sine", vol: 0.12 }); },
    door() { tone(240, 0.12, { type: "triangle", vol: 0.09, slide: -60 }); }
  };

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem("tlh-sound", enabled ? "on" : "off"); } catch (e) {}
      if (enabled && audio()) SOUNDS.alert();
      return enabled;
    },
    unlock() { if (enabled) audio(); },
    play(name, ...args) {
      if (!enabled || !SOUNDS[name] || !audio()) return;
      try { SOUNDS[name](...args); } catch (e) { /* som é opcional: nunca trava o jogo */ }
    }
  };
})();
