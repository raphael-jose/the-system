// Tela cheia + travamento de orientação do treino imersivo.
// Tudo com guardas: Android Chrome exige fullscreen para travar orientação;
// iOS Safari não suporta o Fullscreen API (vira no-op silencioso).

export function isFullscreen() {
  return typeof document !== "undefined" && !!document.fullscreenElement;
}

export function enterFullscreen() {
  const el = typeof document !== "undefined" ? document.documentElement : null;
  if (el?.requestFullscreen) {
    try {
      return Promise.resolve(el.requestFullscreen()).catch(() => {});
    } catch {
      /* sem suporte */
    }
  }
  return Promise.resolve();
}

export function exitFullscreen() {
  if (typeof document !== "undefined" && document.fullscreenElement) {
    try {
      document.exitFullscreen().catch(() => {});
    } catch {
      /* sem suporte */
    }
  }
}

export function lockLandscape() {
  try {
    if (typeof screen !== "undefined" && screen.orientation?.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
  } catch {
    /* sem suporte */
  }
}

export function unlockOrientation() {
  try {
    if (typeof screen !== "undefined" && screen.orientation?.unlock) {
      screen.orientation.unlock();
    }
  } catch {
    /* sem suporte */
  }
}
