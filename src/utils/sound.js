// Sons de UI sintetizados com Web Audio API — zero arquivos de áudio.
// O AudioContext só existe após o primeiro gesto do usuário (regra dos browsers).

let ctx = null;
let enabled = true;

export function setSoundEnabled(v) {
  enabled = v;
}

function ensureCtx() {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function tone(ac, { freq, at = 0, dur = 0.12, type = "square", gain = 0.05 }) {
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SEQUENCES = {
  // confirmação de missão
  mission: [
    { freq: 660, at: 0, dur: 0.09, type: "square", gain: 0.04 },
    { freq: 880, at: 0.09, dur: 0.12, type: "square", gain: 0.04 },
  ],
  // level up: arpejo ascendente
  levelup: [
    { freq: 523, at: 0, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 659, at: 0.1, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 784, at: 0.2, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 1047, at: 0.3, dur: 0.25, type: "square", gain: 0.055 },
  ],
  // rank up: fanfarra maior com triângulo
  rankup: [
    { freq: 523, at: 0, dur: 0.15, type: "triangle", gain: 0.07 },
    { freq: 659, at: 0.14, dur: 0.15, type: "triangle", gain: 0.07 },
    { freq: 784, at: 0.28, dur: 0.15, type: "triangle", gain: 0.07 },
    { freq: 1047, at: 0.42, dur: 0.2, type: "triangle", gain: 0.07 },
    { freq: 1319, at: 0.58, dur: 0.35, type: "triangle", gain: 0.07 },
    { freq: 262, at: 0.42, dur: 0.5, type: "sine", gain: 0.05 },
  ],
  // streak perdido: descida
  streak: [
    { freq: 440, at: 0, dur: 0.14, type: "sawtooth", gain: 0.035 },
    { freq: 330, at: 0.14, dur: 0.2, type: "sawtooth", gain: 0.035 },
  ],
  // recompensa de dungeon (título)
  claim: [
    { freq: 659, at: 0, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 784, at: 0.1, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 988, at: 0.2, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 1319, at: 0.3, dur: 0.3, type: "triangle", gain: 0.06 },
  ],
  // missão semanal concluída
  weekly: [
    { freq: 587, at: 0, dur: 0.1, type: "square", gain: 0.04 },
    { freq: 740, at: 0.09, dur: 0.1, type: "square", gain: 0.04 },
    { freq: 880, at: 0.18, dur: 0.16, type: "square", gain: 0.045 },
  ],
  // conquista desbloqueada: sino duplo
  ach: [
    { freq: 1047, at: 0, dur: 0.12, type: "sine", gain: 0.06 },
    { freq: 1319, at: 0.13, dur: 0.12, type: "sine", gain: 0.06 },
    { freq: 1568, at: 0.26, dur: 0.3, type: "sine", gain: 0.06 },
  ],
  // treino guiado: tick dos últimos 3s (prep/descanso)
  tick: [{ freq: 880, at: 0, dur: 0.06, type: "square", gain: 0.035 }],
  // treino guiado: início de série
  set: [
    { freq: 660, at: 0, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 990, at: 0.12, dur: 0.16, type: "square", gain: 0.05 },
  ],
  // treino guiado: início de descanso
  rest: [
    { freq: 440, at: 0, dur: 0.1, type: "square", gain: 0.05 },
    { freq: 330, at: 0.12, dur: 0.16, type: "square", gain: 0.05 },
  ],
  // treino guiado: toque de repetição (click curto)
  tap: [
    { freq: 900, at: 0, dur: 0.045, type: "square", gain: 0.028 },
    { freq: 1400, at: 0.045, dur: 0.06, type: "square", gain: 0.02 },
  ],
  // treino guiado: meta da série atingida
  rep: [
    { freq: 660, at: 0, dur: 0.1, type: "square", gain: 0.045 },
    { freq: 990, at: 0.1, dur: 0.16, type: "square", gain: 0.045 },
  ],
  // treino guiado: sessão concluída
  done: [
    { freq: 523, at: 0, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 659, at: 0.12, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 784, at: 0.24, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 1047, at: 0.38, dur: 0.3, type: "triangle", gain: 0.06 },
  ],
};

function playSequence(seq) {
  const ac = ensureCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  seq.forEach((note) => tone(ac, note));
}

export function playSound(name) {
  if (!enabled) return;
  const seq = SEQUENCES[name];
  if (!seq) return;
  playSequence(seq);
}

// Tons de notificação personalizados (sintetizados) — cada um com seu
// padrão de vibração. O som nativo da notificação do celular é controlado
// pelo sistema operacional (não dá pra trocar via web), então o SYSTEM
// toca o tom escolhido no app quando o lembrete dispara.
export const NOTIF_SOUNDS = {
  chime: {
    label: "Sino suave",
    seq: [
      { freq: 880, at: 0, dur: 0.2, type: "sine", gain: 0.07 },
      { freq: 1174.66, at: 0.18, dur: 0.24, type: "sine", gain: 0.06 },
      { freq: 1568, at: 0.38, dur: 0.4, type: "sine", gain: 0.055 },
    ],
    vibrate: [120, 60, 120],
  },
  beep: {
    label: "Bipe digital",
    seq: [
      { freq: 784, at: 0, dur: 0.13, type: "square", gain: 0.045 },
      { freq: 784, at: 0.18, dur: 0.13, type: "square", gain: 0.045 },
      { freq: 1047, at: 0.36, dur: 0.22, type: "square", gain: 0.05 },
    ],
    vibrate: [100, 80, 100, 80, 200],
  },
  alarm: {
    label: "Alarme",
    seq: [
      { freq: 523, at: 0, dur: 0.16, type: "sawtooth", gain: 0.04 },
      { freq: 392, at: 0.2, dur: 0.16, type: "sawtooth", gain: 0.04 },
      { freq: 523, at: 0.4, dur: 0.16, type: "sawtooth", gain: 0.04 },
      { freq: 392, at: 0.6, dur: 0.34, type: "sawtooth", gain: 0.045 },
    ],
    vibrate: [200, 100, 200, 100, 400],
  },
};

export const NOTIF_SOUND_NAMES = Object.keys(NOTIF_SOUNDS);

/** Toca o tom de notificação escolhido + vibração própria. */
export function playNotifySound(name) {
  if (!enabled) return;
  const meta = NOTIF_SOUNDS[name] || NOTIF_SOUNDS.chime;
  playSequence(meta.seq);
  try {
    globalThis.navigator?.vibrate?.(meta.vibrate);
  } catch {
    /* sem suporte */
  }
}

/**
 * Demonstração audível: missão → level up → rank up.
 * Usada no botão "Testar som" do Perfil (respeita o toggle).
 */
export function playPreview() {
  playSound("mission");
  setTimeout(() => playSound("levelup"), 650);
  setTimeout(() => playSound("rankup"), 1500);
}
