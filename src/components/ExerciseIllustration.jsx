import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Ilustrações SVG desenhadas à mão (estilo HUD de sistema).
// Cada figura é um traço minimalista — sem emojis, sem assets externos.

const STROKE = "#4f8ef7";
const ACCENT = "#a855f7";
const GOLD = "#facc15";
const SW = 3;

function Head({ cx, cy, r = 8, fill = "none" }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={STROKE} strokeWidth={SW} />;
}
function Ground({ y = 100 }) {
  return <line x1={8} y1={y} x2={112} y2={y} stroke="#1e3a6e" strokeWidth={2} />;
}

function Pushups() {
  return (
    <g>
      <Ground />
      {/* pernas */}
      <line x1={44} y1={84} x2={20} y2={92} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={20} y1={92} x2={13} y2={96} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* tronco */}
      <line x1={76} y1={72} x2={44} y2={84} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* braços dobrados */}
      <line x1={76} y1={72} x2={66} y2={80} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={66} y1={80} x2={60} y2={96} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <circle cx={60} cy={96} r={3} fill={STROKE} />
      <Head cx={84} cy={62} />
      <circle cx={78} cy={86} r={2.5} fill={ACCENT} />
      <circle cx={66} cy={92} r={2.5} fill={ACCENT} />
    </g>
  );
}

function Squats() {
  return (
    <g>
      <Ground />
      {/* braços à frente */}
      <line x1={66} y1={54} x2={88} y2={60} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={88} y1={60} x2={92} y2={58} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* tronco inclinado */}
      <line x1={66} y1={52} x2={56} y2={80} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* coxa + canela da frente */}
      <line x1={56} y1={80} x2={38} y2={88} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={38} y1={88} x2={42} y2={98} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* perna de trás */}
      <line x1={56} y1={80} x2={74} y2={98} stroke={ACCENT} strokeWidth={SW} strokeLinecap="round" />
      <circle cx={42} cy={98} r={3} fill={STROKE} />
      <circle cx={74} cy={98} r={3} fill={ACCENT} />
      <Head cx={72} cy={42} />
      {/* seta de movimento */}
      <path d="M96 90 q6 -6 0 -12 q-6 6 0 12" fill={GOLD} />
    </g>
  );
}

function Cardio() {
  return (
    <g>
      {/* corda */}
      <path d="M28 64 Q60 108 92 64" stroke={ACCENT} strokeWidth={2.5} fill="none" strokeDasharray="4 5" />
      {/* braços segurando a corda */}
      <line x1={54} y1={48} x2={30} y2={64} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={66} y1={48} x2={90} y2={64} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* corpo */}
      <line x1={60} y1={46} x2={60} y2={72} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* pernas saltando */}
      <line x1={60} y1={72} x2={48} y2={88} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={60} y1={72} x2={72} y2={88} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <circle cx={48} cy={90} r={3} fill={STROKE} />
      <circle cx={72} cy={90} r={3} fill={STROKE} />
      <Head cx={60} cy={36} />
      {/* linhas de movimento */}
      <path d="M34 30 l8 4 M34 38 l8 -4 M82 30 l-8 4 M82 38 l-8 -4" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Abs() {
  return (
    <g>
      <Ground y={104} />
      {/* colchonete */}
      <rect x={24} y={96} width={72} height={7} rx={2} fill="#161625" stroke="#1e3a6e" strokeWidth={2} />
      {/* pernas dobradas */}
      <line x1={60} y1={76} x2={46} y2={88} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={60} y1={76} x2={74} y2={88} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* tronco erguido (sit-up curto) */}
      <line x1={60} y1={74} x2={60} y2={44} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* braços cruzados */}
      <path d="M52 52 Q60 58 68 52" stroke={ACCENT} strokeWidth={SW} fill="none" strokeLinecap="round" />
      <Head cx={60} cy={34} />
      {/* seta de movimento */}
      <path d="M96 60 q6 6 0 12 q-6 -6 0 -12" fill={GOLD} />
    </g>
  );
}

function Run() {
  return (
    <g>
      <Ground />
      {/* tronco inclinado */}
      <line x1={66} y1={46} x2={52} y2={72} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* braços */}
      <line x1={64} y1={50} x2={80} y2={58} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={64} y1={58} x2={48} y2={66} stroke={ACCENT} strokeWidth={SW} strokeLinecap="round" />
      {/* pernas */}
      <line x1={52} y1={72} x2={40} y2={84} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={40} y1={84} x2={46} y2={96} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={52} y1={72} x2={66} y2={80} stroke={ACCENT} strokeWidth={SW} strokeLinecap="round" />
      <line x1={66} y1={80} x2={72} y2={92} stroke={ACCENT} strokeWidth={SW} strokeLinecap="round" />
      <circle cx={46} cy={96} r={3} fill={STROKE} />
      <circle cx={72} cy={92} r={3} fill={ACCENT} />
      <Head cx={72} cy={36} />
      <path d="M92 40 h10 M94 48 h8" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

function Water() {
  return (
    <g>
      {/* gota */}
      <path d="M60 10 q8 10 0 16 q-8 -6 0 -16" fill="#4f8ef7" />
      {/* copo */}
      <path d="M44 26 h32 l-6 76 h-20 z" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinejoin="round" />
      {/* água */}
      <path d="M47 46 h26 l-5 50 h-16 z" fill="rgba(79,142,247,0.25)" />
      <line x1={47} y1={46} x2={73} y2={46} stroke="#7eb3ff" strokeWidth={2} />
      {/* bolhas */}
      <circle cx={56} cy={72} r={2.5} fill="none" stroke="#7eb3ff" strokeWidth={1.5} />
      <circle cx={66} cy={84} r={2} fill="none" stroke="#7eb3ff" strokeWidth={1.5} />
      <circle cx={58} cy={88} r={1.5} fill="none" stroke="#7eb3ff" strokeWidth={1.5} />
    </g>
  );
}

function Sleep() {
  return (
    <g>
      {/* lua crescente */}
      <path d="M78 18 A26 26 0 1 0 76 74 A30 30 0 1 1 78 18 Z" fill={GOLD} />
      {/* zzz */}
      <path d="M66 40 h16 l-16 16 h16" stroke="#7eb3ff" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M78 58 h11 l-11 11 h11" stroke="#7eb3ff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M88 72 h7 l-7 7 h7" stroke="#7eb3ff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* cama */}
      <rect x={20} y={92} width={80} height={8} rx={2} fill="#161625" stroke={STROKE} strokeWidth={2.5} />
      <line x1={28} y1={100} x2={28} y2={106} stroke={STROKE} strokeWidth={2.5} />
      <line x1={92} y1={100} x2={92} y2={106} stroke={STROKE} strokeWidth={2.5} />
      {/* travesseiro */}
      <rect x={24} y={86} width={22} height={8} rx={2} fill="none" stroke={ACCENT} strokeWidth={2} />
    </g>
  );
}

function Study() {
  return (
    <g>
      {/* feixe de luz */}
      <line x1={60} y1={6} x2={60} y2={26} stroke={GOLD} strokeWidth={2} strokeDasharray="3 4" />
      {/* páginas */}
      <path d="M60 30 L26 24 L26 72 L60 78 Z" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinejoin="round" />
      <path d="M60 30 L94 24 L94 72 L60 78 Z" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinejoin="round" />
      {/* lombada */}
      <line x1={60} y1={30} x2={60} y2={78} stroke={ACCENT} strokeWidth={2} />
      {/* linhas de texto */}
      <line x1={34} y1={38} x2={52} y2={36} stroke="#7eb3ff" strokeWidth={2} />
      <line x1={34} y1={46} x2={52} y2={44} stroke="#7eb3ff" strokeWidth={2} />
      <line x1={34} y1={54} x2={52} y2={52} stroke="#7eb3ff" strokeWidth={2} />
      <line x1={68} y1={36} x2={86} y2={34} stroke="#7eb3ff" strokeWidth={2} />
      <line x1={68} y1={44} x2={86} y2={42} stroke="#7eb3ff" strokeWidth={2} />
      <line x1={68} y1={52} x2={86} y2={50} stroke="#7eb3ff" strokeWidth={2} />
    </g>
  );
}

function Meditate() {
  return (
    <g>
      {/* chão */}
      <ellipse cx={60} cy={86} rx={32} ry={4} stroke="#1e3a6e" strokeWidth={2} fill="none" />
      {/* pernas cruzadas */}
      <line x1={60} y1={66} x2={44} y2={78} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <line x1={60} y1={66} x2={76} y2={78} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      <circle cx={44} cy={80} r={3} fill={STROKE} />
      <circle cx={76} cy={80} r={3} fill={STROKE} />
      {/* tronco ereto */}
      <line x1={60} y1={46} x2={60} y2={66} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
      {/* braços relaxados */}
      <path d="M56 52 Q48 64 42 70" stroke={ACCENT} strokeWidth={SW} fill="none" strokeLinecap="round" />
      <path d="M64 52 Q72 64 78 70" stroke={ACCENT} strokeWidth={SW} fill="none" strokeLinecap="round" />
      <Head cx={60} cy={36} />
      {/* energia */}
      <circle cx={60} cy={20} r={3} fill={GOLD} />
      <circle cx={52} cy={24} r={2} fill={GOLD} opacity={0.7} />
      <circle cx={68} cy={24} r={2} fill={GOLD} opacity={0.7} />
    </g>
  );
}

const ILLUSTRATIONS = {
  pushups: Pushups,
  squats: Squats,
  abs: Abs,
  cardio: Cardio,
  run: Run,
  water: Water,
  sleep: Sleep,
  study: Study,
  meditate: Meditate,
};

/** Ilustração SVG pura — usado em cards e guias de exercício. */
export default function ExerciseIllustration({ type, size = 96 }) {
  const Fig = ILLUSTRATIONS[type] || Study;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <Fig />
    </svg>
  );
}

/** Guia explicativo expandível: imagem + passos + dicas de forma. */
export function ExerciseGuide({ exercise, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!exercise) return null;

  return (
    <div className="border-t border-dim mt-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left text-label"
        aria-expanded={open}
      >
        <span className="flex-1">Protocolo do exercício</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 animate-fade-in">
          <div className="flex gap-4 items-start">
            <div className="shrink-0">
              {exercise.image ? (
                <div className="sys-frame p-1 bg-void">
                  <img
                    src={exercise.image}
                    alt={exercise.name}
                    className="w-[104px] h-[104px] rounded-[3px] object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="sys-frame p-2 bg-void">
                  <ExerciseIllustration type={exercise.type} size={88} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1 pt-1">
              <p className="font-title text-[15px] font-semibold text-primary">
                {exercise.name}
              </p>
              {exercise.sets && (
                <p className="text-[12px] text-blue">
                  <span className="text-secondary">Séries: </span>
                  {exercise.sets}
                </p>
              )}
              {exercise.equipment && (
                <p className="text-[12px] text-secondary">
                  {exercise.equipment}
                </p>
              )}
            </div>
          </div>

          <ol className="mt-3 space-y-2">
            {(exercise.howTo || []).map((step, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-primary">
                <span className="font-display text-[12px] text-blue tabular shrink-0 mt-[2px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {(exercise.tips || []).length > 0 && (
            <div className="mt-3 rounded-[4px] border border-purpledim bg-purpledim/15 p-2.5">
              <p className="text-label text-[11px] text-purple mb-1">
                Dicas de forma
              </p>
              <ul className="space-y-1">
                {exercise.tips.map((tip, i) => (
                  <li key={i} className="flex gap-1.5 text-[12px] text-secondary leading-snug">
                    <span className="text-purple">›</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
