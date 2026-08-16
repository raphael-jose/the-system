// Comandos de voz sintetizados (Web Speech API) para o treino guiado.
// TTS puro — sem arquivos de áudio, sem reconhecimento de fala.
// Usa globalThis (== window no navegador) para degradar silenciosamente
// em ambientes sem suporte (ex.: testes em node).

let enabled = true;

export function setVoiceEnabled(v) {
  enabled = v;
}

function synth() {
  if (typeof globalThis === "undefined") return null;
  return globalThis.speechSynthesis || null;
}

/** Cancela qualquer fala pendente (ex.: ao fechar o treino no meio). */
export function cancelSpeech() {
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    /* sem suporte */
  }
}

/** Fala um comando em pt-BR. No-op sem suporte ou com o toggle desligado. */
export function speak(text) {
  if (!enabled) return;
  const s = synth();
  if (!s) return;
  try {
    const U = globalThis.SpeechSynthesisUtterance;
    if (!U) return;
    const u = new U(text);
    u.lang = "pt-BR";
    u.rate = 1.05;
    u.pitch = 0.95;
    // evita fila de comandos sobrepostos (transições rápidas)
    s.cancel();
    s.speak(u);
  } catch {
    /* sem suporte */
  }
}
