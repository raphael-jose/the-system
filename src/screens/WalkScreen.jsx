import { useEffect, useRef, useState } from "react";
import { Flag, Footprints, MapPin, Pause, Play, Plus, X } from "lucide-react";
import { formatClock } from "../utils/timer";
import { playSound } from "../utils/sound";
import {
  createStepCounter,
  estimateSteps,
  formatSteps,
  haversineKm,
  routeDistanceKm,
} from "../utils/walk";

/**
 * Pedômetro + rastreamento de caminhada.
 * - Passos: acelerômetro (Android) quando disponível; sem sensor, estima
 *   pela distância do GPS (passo médio de 75 cm). Último recurso: botão
 *   manual +1 (honesto, um toque por passo).
 * - Rota: GPS de alta precisão → polilinha no canvas (estilo HUD, offline).
 * - Pausar congela relógio e rota; PARAR E SALVAR registra no histórico.
 */
export default function WalkScreen({ run, onClose }) {
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const [steps, setSteps] = useState(0);
  const [km, setKm] = useState(0);
  const [route, setRoute] = useState([]);
  const [sensorInfo, setSensorInfo] = useState("");

  const runningRef = useRef(false);
  const accSecRef = useRef(0);
  const phaseStartRef = useRef(0);
  const routeRef = useRef([]);
  const kmRef = useRef(0);
  const lastPosRef = useRef(null);
  const watchIdRef = useRef(null);
  const accelRef = useRef(null);
  const hasAccelRef = useRef(false);
  const stepCounterRef = useRef(createStepCounter());
  const stepsFromAccelRef = useRef(0);
  const stepsFromGpsRef = useRef(0); // passos estimados por distância GPS
  const gpsSpeedRef = useRef(null); // velocidade GPS atual (m/s)

  // ---- Sensores: acelerômetro (passos) + GPS (rota/distância) ----
  useEffect(() => {
    let cancelled = false;

    // 1) Passos por acelerômetro (Android Chrome; iOS não expõe o sensor)
    try {
      if ("Accelerometer" in window) {
        const sensor = new Accelerometer({ frequency: 30 });
        sensor.addEventListener("reading", () => {
          if (cancelled || !runningRef.current) return;
          const mag =
            Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2) / 9.81;
          stepsFromAccelRef.current = stepCounterRef.current.push(
            mag,
            Date.now(),
            gpsSpeedRef.current
          );
          setSteps(stepsFromAccelRef.current);
        });
        sensor.addEventListener("error", () => {
          hasAccelRef.current = false;
          setSensorInfo("Passos estimados pela distância (sensor indisponível)");
        });
        sensor.start();
        accelRef.current = sensor;
        hasAccelRef.current = true;
        setSensorInfo("Passos pelo sensor de movimento");
        hasAccelRef.current = true;
      } else {
        setSensorInfo("Passos estimados pela distância (sem sensor de movimento)");
      }
    } catch {
      setSensorInfo("Passos estimados pela distância (sem sensor de movimento)");
    }

    // 2) Rota e distância por GPS
    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          // Salva velocidade GPS para validação do acelerômetro
          if (pos.coords.speed != null && pos.coords.speed >= 0) {
            gpsSpeedRef.current = pos.coords.speed;
          }
          const p = [pos.coords.latitude, pos.coords.longitude];
          // Filtro GPS robusto: só aceita o ponto se:
          //  1. Velocidade reportada pelo GPS > 0.5 m/s (realmente andando)
          //  2. OU distância do último ponto > 8 m (acumulou deslocamento)
          // Isso elimina jitter de GPS quando parado (2-5 m de ruído).
          const speed = pos.coords.speed;
          const hasSpeed = speed != null && speed >= 0;
          const last = lastPosRef.current;
          if (last) {
            const d = haversineKm(last[0], last[1], p[0], p[1]);
            const movingBySpeed = hasSpeed && speed >= 0.5;
            const movingByDistance = d >= 0.008; // ≥ 8 m
            if (!movingBySpeed && !movingByDistance) return;
            // Suaviza o GPS: só aceita se moveu consistente (> 3 m)
            const route = routeRef.current;
            if (route.length >= 2) {
              const prev = route[route.length - 1];
              const dPrev = haversineKm(prev[0], prev[1], p[0], p[1]);
              if (dPrev < 0.003 && !movingBySpeed) return;
            }
            if (route.length === 0) route.push(last);
            route.push(p);
            setRoute([...route]);
            if (runningRef.current) {
              kmRef.current = routeDistanceKm(route);
              stepsFromGpsRef.current = estimateSteps(kmRef.current);
              setKm(kmRef.current);
            }
          }
          lastPosRef.current = p;
        },
        () => {
          if (!cancelled) {
            setSensorInfo((s) =>
              s ? `${s} · GPS indisponível` : "GPS indisponível"
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
      );
    }

    return () => {
      cancelled = true;
      try {
        accelRef.current?.stop();
      } catch {
        /* sem sensor */
      }
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // ---- Relógio da sessão (timestamp — imune a drift) ----
  useEffect(() => {
    if (!running) return;
    phaseStartRef.current = Date.now();
    const iv = setInterval(() => {
      const total =
        accSecRef.current + (Date.now() - phaseStartRef.current) / 1000;
      setSec(Math.floor(total));

      // --- Fallback inteligente de passos ---
      // Se o acelerômetro existe mas não conta (threshold alto, bolso,
      // celular na mão sem balanço), usa a estimativa GPS como fallback.
      const accelSteps = stepsFromAccelRef.current;
      const gpsSteps = stepsFromGpsRef.current;
      if (!hasAccelRef.current) {
        // Sem acelerômetro → sempre usa GPS
        setSteps(gpsSteps);
      } else if (accelSteps === 0 && gpsSteps > 0) {
        // Acelerômetro não conta mas GPS mostra movimento → fallback
        setSteps(gpsSteps);
      } else {
        // Acelerômetro contando normalmente
        setSteps(accelSteps);
        if (stepCounterRef.current.isPocketMode()) {
          setSensorInfo(`Passos pelo sensor (modo bolso — sensibilidade aumentada)`);
        } else if (gpsSteps > 0 && accelSteps === 0) {
          setSensorInfo("Passos pelo GPS (acelerômetro sem detecção)");
        } else {
          setSensorInfo("Passos pelo sensor de movimento");
        }
      }
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // ---- Visibilidade: sincroniza timer ao voltar ao foreground ----
  // O navegador põe setInterval em throttle quando a aba está em background;
  // ao voltar, Date.now() já avançou mas o relógio está defasado. Este
  // listener força a re-render com o valor correto.
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === "visible" && runningRef.current) {
        const total =
          accSecRef.current + (Date.now() - phaseStartRef.current) / 1000;
        setSec(Math.floor(total));
        if (!hasAccelRef.current) {
          setSteps(estimateSteps(kmRef.current));
        }
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  function start() {
    playSound("tap");
    runningRef.current = true;
    setRunning(true);
  }

  function pause() {
    playSound("tap");
    runningRef.current = false;
    accSecRef.current += (Date.now() - phaseStartRef.current) / 1000;
    setSec(Math.floor(accSecRef.current));
    setRunning(false);
  }

  function reset() {
    pauseIfRunning();
    accSecRef.current = 0;
    routeRef.current = [];
    kmRef.current = 0;
    lastPosRef.current = null;
    setSec(0);
    setSteps(0);
    setKm(0);
    setRoute([]);
  }

  function pauseIfRunning() {
    if (runningRef.current) {
      runningRef.current = false;
      accSecRef.current += (Date.now() - phaseStartRef.current) / 1000;
      setRunning(false);
    }
  }

  function save() {
    // duração correta mesmo salvando sem pausar (acumulado + fase atual)
    const finalSec = Math.max(
      0,
      Math.floor(
        accSecRef.current +
          (runningRef.current
            ? (Date.now() - phaseStartRef.current) / 1000
            : 0)
      )
    );
    const finalKm = routeDistanceKm(routeRef.current);
    const finalGpsSteps = estimateSteps(finalKm);
    const finalSteps = hasAccelRef.current
      ? Math.max(stepsFromAccelRef.current, finalGpsSteps > 0 && stepsFromAccelRef.current === 0 ? finalGpsSteps : 0)
      : finalGpsSteps;
    if (finalSec <= 0 && finalSteps <= 0 && finalKm <= 0) {
      playSound("tap");
      return;
    }
    playSound("done");
    run({
      type: "SAVE_WALK",
      sec: finalSec,
      steps: finalSteps,
      km: finalKm,
      route: routeRef.current.slice(-500),
    });
    onClose();
  }

  const canSave = sec > 0 || steps > 0 || km > 0;
  const noSensors = !hasAccelRef.current && km <= 0;

  return (
    <div className="fixed inset-0 z-50 bg-void scanlines flex flex-col">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <div>
          <p className="text-label">Atividade</p>
          <h1 className="font-display font-black text-[22px]">CAMINHADA</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar rastreador"
          className="p-2 text-secondary active:text-primary"
        >
          <X size={18} />
        </button>
      </header>

      {/* Mapa da rota (canvas HUD, offline) */}
      <div className="mx-4 sys-frame p-2">
        <RouteMap route={route} />
      </div>

      {/* Estatísticas ao vivo */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <Stat icon={<Footprints size={14} />} label="Passos" value={formatSteps(steps)} />
        <Stat icon={<MapPin size={14} />} label="Distância" value={`${km.toFixed(2)} km`} />
        <Stat icon={<Flag size={14} />} label="Tempo" value={formatClock(sec)} />
      </div>

      <p className="px-4 pt-2 text-[10px] text-ghost min-h-[14px]">{sensorInfo}</p>

      {/* Fallback manual (sem sensor E sem GPS): um toque = um passo */}
      {noSensors && (
        <button
          type="button"
          onClick={() => {
            stepsFromAccelRef.current += 1;
            setSteps(stepsFromAccelRef.current);
            playSound("tap");
          }}
          className="mx-4 mt-2 flex items-center justify-center gap-1.5 rounded-[4px] border border-dim py-2 text-[12px] font-title uppercase tracking-wider text-secondary active:border-glow active:text-primary"
        >
          <Plus size={13} /> 1 passo (manual)
        </button>
      )}

      {/* Controles */}
      <div className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 space-y-2">
        {running ? (
          <button
            type="button"
            onClick={pause}
            className="btn-system w-full py-3 flex items-center justify-center gap-2 text-[13px]"
          >
            <Pause size={16} /> PAUSAR
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="btn-system w-full py-3 flex items-center justify-center gap-2 text-[13px]"
          >
            <Play size={16} /> {sec > 0 ? "RETOMAR" : "INICIAR"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-[4px] border border-dim py-2.5 text-[12px] font-title uppercase tracking-wider text-secondary active:border-glow"
          >
            Zerar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className={`rounded-[4px] border py-2.5 text-[12px] font-title uppercase tracking-wider transition-colors ${
              canSave
                ? "border-success text-success bg-success/10"
                : "border-dim text-ghost"
            }`}
          >
            Parar e salvar
          </button>
        </div>
        <p className="text-center text-[10px] text-ghost">
          Passos e rota ficam no Histórico — nada sai do dispositivo.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="sys-frame p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-blue">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.12em] text-secondary">
          {label}
        </span>
      </div>
      <p className="font-display font-bold text-[17px] tabular mt-1">{value}</p>
    </div>
  );
}

/** Rota desenhada em canvas — mapa HUD offline, sem tiles, sem internet. */
function RouteMap({ route }) {
  const canvasRef = useRef(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || 320;
      const cssH = 200;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // fundo do canvas
      ctx.fillStyle = "#0a0a16";
      ctx.fillRect(0, 0, cssW, cssH);

      // grade HUD
      ctx.strokeStyle = "rgba(75, 79, 216, 0.2)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= cssW; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssH);
        ctx.stroke();
      }
      for (let y = 0; y <= cssH; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssW, y);
        ctx.stroke();
      }

      const pts = routeRef.current;
      if (pts.length < 2) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px Rajdhani, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          pts.length === 1 ? "LOCALIZANDO…" : "AGUARDANDO SINAL GPS…",
          cssW / 2,
          cssH / 2
        );
        return;
      }

      // ajusta o enquadramento à rota
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const [la, lo] of pts) {
        if (la < minLat) minLat = la;
        if (la > maxLat) maxLat = la;
        if (lo < minLng) minLng = lo;
        if (lo > maxLng) maxLng = lo;
      }
      const pad = 20;
      const spanLat = Math.max(maxLat - minLat, 1e-5);
      const spanLng = Math.max(maxLng - minLng, 1e-5);
      const px = (la, lo) => [
        pad + ((lo - minLng) / spanLng) * (cssW - pad * 2),
        cssH - pad - ((la - minLat) / spanLat) * (cssH - pad * 2),
      ];

      ctx.beginPath();
      const [x0, y0] = px(pts[0][0], pts[0][1]);
      ctx.moveTo(x0, y0);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = px(pts[i][0], pts[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#4f8ef7";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(79, 142, 247, 0.7)";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // início da rota (ponto vermelho)
      if (pts.length >= 2) {
        const [xs, ys] = px(pts[0][0], pts[0][1]);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(xs, ys, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // posição atual (ponto verde com glow)
      const [xe, ye] = px(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.shadowColor = "rgba(34, 197, 94, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(xe, ye, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
    // redesenha a cada novo ponto da rota (e no redimensionamento)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[200px] rounded-[3px] block"
      style={{ background: '#0a0a16' }}
      aria-label="Mapa da rota da caminhada"
    />
  );
}
