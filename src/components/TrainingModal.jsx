import { useEffect, useRef, useState } from "react";
import { Check, Maximize, Minimize2, Play, SkipForward, X } from "lucide-react";
import { playSound } from "../utils/sound";
import { speak, cancelSpeech } from "../utils/voice";
import { formatClock, formatLong, repProgress } from "../utils/timer";
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  lockLandscape,
  unlockOrientation,
} from "../utils/fullscreen";

const REST_OPTIONS = [30, 45, 60];

/**
 * Treino guiado: máquina de estados PREP → SÉRIE → DESCANSO → ... → CONCLUÍDO.
 * - Contagem baseada em timestamp (endAt) — imune a drift do setInterval
 * - Ticks sonoros nos últimos 3s de cada contagem + vibração
 * - Séries por repetições (cronômetro + "Terminar série") ou por tempo (auto)
 * - Modo imersivo: tela cheia + travamento landscape + número gigante
 * - Ao concluir, "Concluir missão" dispara o fluxo normal de recompensa
 */
export default function TrainingModal({
  mission,
  restSec,
  onSetRest,
  onComplete,
  onClose,
  immersiveDefault = false,
  onSetImmersive,
}) {
  const t = mission.training;
  const isReps = t.type === "reps";
  const totalSets = t.sets;

  const [phase, setPhase] = useState("ready"); // ready|prep|set|rest|done
  const [setNum, setSetNum] = useState(1);
  const [left, setLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [repsDone, setRepsDone] = useState(0);
  // inicia com a preferência persistida do jogador (lembra entre sessões)
  const [immersive, setImmersive] = useState(!!immersiveDefault);
  const endAtRef = useRef(0);
  const startRef = useRef(Date.now());
  const sessionStartRef = useRef(0);
  const lastBeepRef = useRef(-1);
  const immersiveRef = useRef(false);
  const targetHitRef = useRef(false);
  const autoFinishRef = useRef(null);
  const phaseRef = useRef("ready");
  phaseRef.current = phase;
  immersiveRef.current = immersive;

  // Ao desmontar (fechar/abandonar/concluir), sai da tela cheia, cancela
  // o auto-avanço e qualquer fala pendente.
  useEffect(() => {
    return () => {
      if (autoFinishRef.current) clearTimeout(autoFinishRef.current);
      cancelSpeech();
      if (immersiveRef.current) {
        exitFullscreen();
        unlockOrientation();
      }
    };
  }, []);

  function vibrate(ms) {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* sem suporte */
    }
  }

  /** Cada toque = 1 repetição (som + vibração + pulso). Ao atingir a meta, avança sozinho. */
  function countRep() {
    if (phase !== "set" || !isReps || targetHitRef.current) return;
    const done = repsDone + 1;
    setRepsDone(done);
    playSound("tap");
    vibrate(12);
    if (done >= t.reps) {
      targetHitRef.current = true;
      playSound("rep");
      autoFinishRef.current = setTimeout(() => {
        if (phaseRef.current === "set") finishSet();
      }, 900);
    }
  }

  /** Toque em qualquer área do modal (fora de botões) conta repetição. */
  function handleRootTap(e) {
    const tgt = e && e.target;
    if (tgt && typeof tgt.closest === "function" && tgt.closest("button")) return;
    countRep();
  }

  function startPhase(p, dur) {
    endAtRef.current = Date.now() + dur * 1000;
    setLeft(dur);
    setPhase(p);
    if (p === "set") {
      setElapsed(0);
      startRef.current = Date.now();
      setRepsDone(0);
      targetHitRef.current = false;
    }
    lastBeepRef.current = -1;
  }

  function begin() {
    // se a preferência imersiva está ligada, entra em tela cheia AGORA
    // (dentro do gesto do usuário — exigência dos browsers)
    if (immersiveRef.current && !isFullscreen()) {
      enterFullscreen();
      lockLandscape();
    }
    sessionStartRef.current = Date.now();
    startPhase("prep", 3);
  }

  function finishSet() {
    if (autoFinishRef.current) {
      clearTimeout(autoFinishRef.current);
      autoFinishRef.current = null;
    }
    if (setNum >= totalSets) {
      setPhase("done");
      playSound("done");
      vibrate([60, 40, 140]);
      speak("Treino concluído");
    } else {
      startPhase("rest", restSec);
      playSound("rest");
      vibrate(50);
      speak("Descanse");
    }
  }

  function finishRest() {
    const nextSet = setNum + 1;
    setSetNum(nextSet);
    startPhase("set", t.workSec ?? 0);
    playSound("set");
    vibrate(50);
    speak(nextSet >= totalSets ? "Última série" : "Comece");
  }

  function enterImmersiveMode() {
    enterFullscreen();
    lockLandscape();
    setImmersive(true);
    onSetImmersive?.(true);
  }

  function exitImmersiveMode() {
    exitFullscreen();
    unlockOrientation();
    setImmersive(false);
    onSetImmersive?.(false);
  }

  // Contagem regressiva (prep / rest / série por tempo)
  useEffect(() => {
    const counting =
      phase === "prep" || phase === "rest" || (phase === "set" && !isReps);
    if (!counting) return;
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setLeft(rem);
      if (rem <= 3 && rem > 0 && lastBeepRef.current !== rem) {
        lastBeepRef.current = rem;
        playSound("tick");
      }
      if (rem === 0) {
        clearInterval(iv);
        if (phase === "prep") {
          startPhase("set", t.workSec ?? 0);
          playSound("set");
          vibrate(50);
          speak(totalSets === 1 ? "Última série" : "Comece");
        } else if (phase === "rest") {
          finishRest();
        } else {
          finishSet();
        }
      }
    }, 200);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setNum, isReps]);

  // Cronômetro das séries por repetição (conta pra cima)
  useEffect(() => {
    if (!(phase === "set" && isReps)) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(iv);
  }, [phase, setNum, isReps]);

  const isDone = phase === "done";
  const sessionSec = isDone
    ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
    : 0;

  // ---- classes adaptativas (card ↔ imersivo) ----
  const clockColor =
    phase === "prep"
      ? "var(--color-secondary)"
      : phase === "rest"
        ? "#a855f7"
        : "var(--color-primary)";
  const phaseColor =
    phase === "rest"
      ? "#a855f7"
      : phase === "prep"
        ? "var(--color-secondary)"
        : "#4f8ef7";
  const actionBtn = immersive
    ? "btn-system w-full min-h-[56px] py-2 text-[3.6vmin] flex items-center justify-center gap-2"
    : "btn-system w-full py-2.5 text-[14px] flex items-center justify-center gap-2";

  // ---- conteúdo das fases (compartilhado entre card e imersivo) ----
  const phaseContent = (
    <>
      {/* ready */}
      {phase === "ready" && (
        <div className="text-center py-2">
          <p className={`${immersive ? "text-[3vmin] mb-[3vmin]" : "text-[12px] mb-3"} text-secondary`}>
            {isReps
              ? `${totalSets} séries × ${t.reps} repetições`
              : `${totalSets} ${totalSets === 1 ? "bloco" : "blocos"} de ${formatClock(t.workSec)}`}
          </p>

          <p className="text-label mb-1.5">Descanso entre séries</p>
          <div
            className={`grid grid-cols-3 gap-1.5 ${
              immersive ? "w-[48vmin] mx-auto mb-[3vmin]" : "mb-4"
            }`}
          >
            {REST_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onSetRest(sec)}
                className={`rounded-[4px] border font-display tabular transition-colors ${
                  immersive ? "py-[1.8vmin] text-[3vmin] min-h-[48px]" : "py-1.5 text-[13px]"
                } ${restSec === sec ? "border-glow text-blue bg-elevated" : "border-dim text-secondary"}`}
              >
                {sec}s
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={begin}
            className={`${actionBtn} ${immersive ? "w-[48vmin] mx-auto" : ""}`}
          >
            <Play size={immersive ? 24 : 15} /> Começar treino
          </button>

          {!immersive && (
            <button
              type="button"
              onClick={enterImmersiveMode}
              className="mt-2 w-full py-1.5 text-[11px] font-title uppercase tracking-wider text-secondary flex items-center justify-center gap-1.5 active:text-primary"
            >
              <Maximize size={12} /> Modo imersivo (tela cheia)
            </button>
          )}
        </div>
      )}

      {/* execução */}
      {phase !== "ready" && phase !== "done" && (
        <div className={`text-center ${immersive ? "" : "py-2"}`}>
          {/* pontos de progresso */}
          <div className={`flex justify-center gap-2 ${immersive ? "mb-[3vmin]" : "mb-4"}`}>
            {Array.from({ length: totalSets }, (_, i) => (
              <span
                key={i}
                className={`h-[6px] rounded-full transition-all ${
                  immersive ? "h-[1.6vmin]" : ""
                } ${
                  i < setNum - 1
                    ? "w-[18px] bg-success"
                    : i === setNum - 1
                      ? "w-[18px] bg-glow"
                      : "w-[10px] bg-dim"
                }`}
              />
            ))}
          </div>

          <p
            className="font-display font-bold tracking-[0.3em] mb-1"
            style={{ fontSize: immersive ? "min(4.5vmin, 4.5vh)" : "13px", color: phaseColor }}
          >
            {phase === "prep"
              ? "PREPARAR"
              : phase === "rest"
                ? "DESCANSO"
                : `SÉRIE ${setNum}/${totalSets}`}
          </p>

          {phase === "set" && isReps ? (
            immersive ? (
              <div
                className="relative mx-auto"
                style={{ width: "min(52vmin, 54vh)", height: "min(52vmin, 54vh)" }}
              >
                <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-dim)" strokeWidth="2.5" />
                  <circle
                    cx="60" cy="60" r="54"
                    fill="none"
                    stroke={targetHitRef.current ? "#facc15" : "var(--color-primary)"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={339.3}
                    strokeDashoffset={339.3 * (1 - repProgress(repsDone, t.reps))}
                    style={{
                      transition: "stroke-dashoffset 0.15s linear, stroke 0.2s ease",
                      ...(targetHitRef.current
                        ? { filter: "drop-shadow(0 0 6px rgba(250,204,21,0.8))" }
                        : {}),
                    }}
                  />
                </svg>
                {/* flash do anel a cada toque (remonta por repsDone) */}
                <svg
                  key={repsDone}
                  viewBox="0 0 120 120"
                  className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none ring-flash"
                  aria-hidden="true"
                >
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#7eb3ff" strokeWidth="3" />
                </svg>
                <button
                  type="button"
                  onClick={countRep}
                  className="absolute inset-0 flex flex-col items-center justify-center select-none"
                  aria-label="Contar repetição"
                >
                  <span
                    key={repsDone}
                    className="rep-pulse font-display font-black tabular"
                    style={{ color: clockColor, fontSize: "min(22vmin, 24vh)", lineHeight: 1 }}
                  >
                    {repsDone}
                  </span>
                  <span
                    className="text-secondary font-display tabular"
                    style={{ fontSize: "min(3vmin, 3.2vh)", marginTop: "0.6em" }}
                  >
                    / {t.reps} · {formatClock(elapsed)}
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={countRep}
                className="mx-auto select-none flex flex-col items-center gap-1.5"
                aria-label="Contar repetição"
              >
                <span
                  key={repsDone}
                  className="rep-pulse font-display font-black tabular"
                  style={{ color: clockColor, fontSize: "64px", lineHeight: 1 }}
                >
                  {repsDone}
                </span>
                <span className="text-secondary font-display tabular text-[12px]">
                  / {t.reps} reps · {formatClock(elapsed)}
                </span>
              </button>
            )
          ) : (
            <p
              className="font-display font-black tabular"
              style={{
                color: clockColor,
                ...(immersive
                  ? { fontSize: "min(30vmin, 32vh)", lineHeight: 1.1 }
                  : { fontSize: phase === "rest" ? "56px" : "64px" }),
              }}
            >
              {formatClock(left)}
            </p>
          )}

          {phase === "set" && isReps && (
            <div className={`${immersive ? "w-[40vmin] mx-auto mb-[2vmin]" : "mb-3"}`}>
              <div className="h-[4px] rounded-[2px] bg-dim overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${repProgress(repsDone, t.reps) * 100}%` }}
                />
              </div>
              <p className={`text-secondary mt-1.5 ${immersive ? "text-[2.4vmin]" : "text-[11px]"}`}>
                {targetHitRef.current ? "SÉRIE COMPLETA — aguarde" : "Toque na tela para contar"}
              </p>
            </div>
          )}
          {phase === "rest" && (
            <p className={`text-secondary mb-3 ${immersive ? "text-[2.6vmin] mb-[2vmin]" : "text-[11px]"}`}>
              Próxima: Série {Math.min(setNum + 1, totalSets)}
              {isReps ? ` · ${t.reps} repetições` : ""}
            </p>
          )}

          {phase === "set" && isReps ? (
            <button
              type="button"
              onClick={finishSet}
              className={`${actionBtn} ${immersive ? "w-[48vmin] mx-auto" : ""}`}
            >
              <Check size={immersive ? 24 : 15} /> Terminar série
            </button>
          ) : phase === "rest" ? (
            <button
              type="button"
              onClick={finishRest}
              className={`btn-system ghost w-full flex items-center justify-center gap-1.5 ${
                immersive ? "min-h-[56px] py-2 text-[3vmin] w-[48vmin] mx-auto" : "py-2 text-[12px]"
              }`}
            >
              <SkipForward size={immersive ? 20 : 13} /> Pular descanso
            </button>
          ) : (
            <p className={`text-ghost ${immersive ? "text-[2.6vmin]" : "text-[11px]"}`}>
              Prepare-se para começar…
            </p>
          )}
        </div>
      )}

      {/* done */}
      {phase === "done" && (
        <div className="text-center py-2">
          <p
            className="font-display font-black tracking-[0.3em] mb-1"
            style={{
              color: "#facc15",
              fontSize: immersive ? "min(5vmin, 5vh)" : "15px",
              textShadow: "0 0 16px rgba(250,204,21,0.6)",
            }}
          >
            TREINO CONCLUÍDO
          </p>
          <p className={`text-secondary mb-3 ${immersive ? "text-[3vmin] mb-[3vmin]" : "text-[12px]"}`}>
            {totalSets} {totalSets === 1 ? "série" : "séries"} · {formatLong(sessionSec)}
          </p>
          <button
            type="button"
            onClick={() => onComplete(mission, { sec: sessionSec, sets: totalSets })}
            className={`${immersive ? "w-[48vmin] mx-auto" : ""} ${actionBtn.replace("btn-system", "btn-system gold")}`}
          >
            Concluir missão · +{mission.xp} XP
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`mt-2 font-title uppercase tracking-wider text-secondary active:text-primary ${
              immersive ? "text-[2.8vmin] min-h-[44px]" : "w-full py-1.5 text-[12px]"
            }`}
          >
            Fechar sem concluir
          </button>
        </div>
      )}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={phase === "set" && isReps ? handleRootTap : undefined}
    >
      {/* fundo */}
      {immersive ? (
        <div className="absolute inset-0 bg-black" />
      ) : (
        <div
          className="absolute inset-0 bg-black/85 animate-fade-in"
          style={{ animationDuration: "0.25s" }}
        />
      )}

      {immersive ? (
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center select-none">
          {/* reduzir (volta ao card) */}
          <button
            type="button"
            onClick={exitImmersiveMode}
            className="absolute top-[max(env(safe-area-inset-top),2vmin)] right-[3vmin] w-[52px] h-[52px] rounded-[4px] border border-dim flex items-center justify-center text-secondary active:text-blue active:border-glow"
            aria-label="Sair do modo imersivo"
          >
            <Minimize2 size={22} />
          </button>
          <p className="absolute top-[max(env(safe-area-inset-top),2.4vmin)] left-[3vmin] font-title text-[2.6vmin] font-semibold text-secondary uppercase tracking-widest max-w-[38vw] truncate">
            {mission.title}
          </p>
          {phaseContent}
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-[360px] px-5">
          <div
            className={`sys-frame p-4 animate-scale-pop ${
              phase === "done"
                ? "glow-gold"
                : phase === "rest"
                  ? "glow-purple"
                  : "glow-blue"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <p className="text-label">Treino guiado</p>
                <h2 className="font-title text-[16px] font-semibold text-primary truncate">
                  {mission.title}
                </h2>
              </div>
              {phase !== "done" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none w-[34px] h-[34px] rounded-[4px] border border-dim flex items-center justify-center text-secondary active:text-danger active:border-danger"
                  aria-label="Sair do treino"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {phaseContent}
          </div>
        </div>
      )}
    </div>
  );
}
