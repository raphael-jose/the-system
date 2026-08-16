// Gráficos do histórico — SVG puro, sem dependências, renderiza offline.
import { currentRunStart } from "../utils/history";

const W = 344;
const CHART_H = 96;
const LABEL_H = 14;
const PAD = 4;

/**
 * Barras de um dia por slot. mode "xp" → azul, "count" → roxo.
 * Hoje sempre dourado; dias vazios aparecem como stub apagado (grid).
 */
export function BarChart({ series, mode = "xp" }) {
  const values = series.map((d) => (mode === "xp" ? d.xp : d.count));
  const max = Math.max(...values, 1);
  const slot = W / series.length;
  const bw = Math.min(7, slot * 0.55);
  const innerH = CHART_H - PAD * 2;
  const baseColor = mode === "xp" ? "var(--color-blue)" : "var(--color-purple)";

  return (
    <svg
      viewBox={`0 0 ${W} ${CHART_H + LABEL_H}`}
      className="block w-full h-auto"
      role="img"
      aria-label={mode === "xp" ? "XP ganho por dia" : "Missões concluídas por dia"}
    >
      {/* linhas de grade */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={W}
          y1={CHART_H - innerH * f}
          y2={CHART_H - innerH * f}
          stroke="var(--color-dim)"
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.6"
        />
      ))}

      {series.map((d, i) => {
        const v = values[i];
        const bh = v > 0 ? Math.max(2, (v / max) * innerH) : 0;
        const x = PAD + i * slot + (slot - bw) / 2;
        const y = CHART_H - PAD - bh;
        const fill = d.isToday ? "var(--color-gold)" : baseColor;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={bw}
            height={Math.max(bh, 2)}
            fill={fill}
            opacity={v > 0 ? 1 : 0.12}
            rx="1"
          />
        );
      })}

      {/* ticks de dia a cada 5 slots */}
      {series.map((d, i) =>
        i % 5 === 0 ? (
          <text
            key={d.date}
            x={PAD + i * slot + slot / 2}
            y={CHART_H + 11}
            fontSize="8"
            fill="var(--color-ghost)"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            {d.date.slice(8)}
          </text>
        ) : null
      )}

      <text
        x={W - PAD - slot / 2}
        y={CHART_H + 11}
        fontSize="8"
        fill="var(--color-gold)"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
      >
        HOJE
      </text>
    </svg>
  );
}

/**
 * Tira de 30 células (uma por dia): azul = dia ativo,
 * dourado = sequência atual, HOJE em destaque.
 */
export function StreakStrip({ series }) {
  const n = series.length;
  const gap = 2;
  const cell = (W - (n - 1) * gap) / n;
  const runStart = currentRunStart(series);
  const stripH = 18;

  return (
    <svg
      viewBox={`0 0 ${W} ${stripH + LABEL_H}`}
      className="block w-full h-auto"
      role="img"
      aria-label="Sequência de atividade nos últimos 30 dias"
    >
      {series.map((d, i) => {
        const active = d.count > 0;
        const inRun = i >= runStart && active;
        const fill = d.isToday
          ? "var(--color-gold)"
          : active
            ? inRun
              ? "#b8860b"
              : "var(--color-blue)"
            : "var(--color-dim)";
        const x = i * (cell + gap);
        return (
          <rect
            key={d.date}
            x={x}
            y={6}
            width={cell}
            height={10}
            rx="1.5"
            fill={fill}
            opacity={active || d.isToday ? 1 : 0.7}
          />
        );
      })}
      {series.map((d, i) =>
        i % 5 === 0 ? (
          <text
            key={d.date}
            x={i * (cell + gap) + cell / 2}
            y={stripH + 11}
            fontSize="8"
            fill="var(--color-ghost)"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            {d.date.slice(8)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/**
 * Tira de 30 células — sessões guiadas por dia (roxo = treinou,
 * dourado = hoje, intensidade pela quantidade no dia).
 */
export function SessionStrip({ series }) {
  const n = series.length;
  const gap = 2;
  const cell = (W - (n - 1) * gap) / n;
  const stripH = 18;
  const maxPerDay = Math.max(1, ...series.map((d) => (d.sessions || []).length));

  return (
    <svg
      viewBox={`0 0 ${W} ${stripH + LABEL_H}`}
      className="block w-full h-auto"
      role="img"
      aria-label="Sessões guiadas por dia nos últimos 30 dias"
    >
      {series.map((d, i) => {
        const count = (d.sessions || []).length;
        const x = i * (cell + gap);
        const fill = d.isToday
          ? "var(--color-gold)"
          : count > 0
            ? "var(--color-purple)"
            : "var(--color-dim)";
        return (
          <rect
            key={d.date}
            x={x}
            y={6}
            width={cell}
            height={10}
            rx="1.5"
            fill={fill}
            opacity={count > 0 || d.isToday ? 0.45 + 0.55 * (count / maxPerDay) : 0.7}
          />
        );
      })}
      {series.map((d, i) =>
        i % 5 === 0 ? (
          <text
            key={d.date}
            x={i * (cell + gap) + cell / 2}
            y={stripH + 11}
            fontSize="8"
            fill="var(--color-ghost)"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            {d.date.slice(8)}
          </text>
        ) : null
      )}
    </svg>
  );
}
