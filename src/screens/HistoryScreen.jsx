import { useMemo } from "react";
import { Dumbbell, Flame } from "lucide-react";
import { useGame } from "../hooks/useGame.jsx";
import { BarChart, SessionStrip, StreakStrip } from "../components/HistoryChart";
import InsightsPanel from "../components/InsightsPanel";
import {
  buildSeries,
  computeInsights,
  formatDuration,
  formatShort,
  longestStreak,
  sessionTotals,
} from "../utils/history";
import { CATEGORY_META } from "../data/defaultMissions";

export default function HistoryScreen() {
  const { save } = useGame();
  const hist = save?._dailyHistory || {};
  const player = save?.player;

  const series = useMemo(() => buildSeries(hist), [hist]);
  const insights = useMemo(
    () => computeInsights(hist, player),
    [hist, player]
  );

  const totals = useMemo(() => {
    let xp = 0;
    let count = 0;
    let active = 0;
    let best = null;
    const catTotals = {};
    for (const d of series) {
      xp += d.xp;
      count += d.count;
      if (d.count > 0) active++;
      if (d.xp > 0 && (!best || d.xp > best.xp)) best = d;
      for (const [cat, n] of Object.entries(d.byCat)) {
        catTotals[cat] = (catTotals[cat] || 0) + n;
      }
    }
    return { xp, count, active, best, catTotals };
  }, [series]);

  const longest = longestStreak(series);

  const training = useMemo(() => sessionTotals(series), [series]);

  // Últimas 3 sessões guiadas (mais recentes primeiro)
  const recentSessions = useMemo(() => {
    const out = [];
    for (let i = series.length - 1; i >= 0 && out.length < 3; i--) {
      for (const s of series[i].sessions || []) {
        out.push({ ...s, date: series[i].date });
        if (out.length >= 3) break;
      }
    }
    return out;
  }, [series]);

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      <header>
        <p className="text-label">Registro de sessão</p>
        <h1 className="font-display font-black text-[22px]">HISTÓRICO</h1>
        <p className="text-[11px] text-ghost">Últimos 30 dias · dados locais</p>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="XP no período" value={totals.xp} accent="blue" />
        <SummaryCard
          label="Missões"
          value={totals.count}
          accent="purple"
        />
        <SummaryCard
          label="Dias ativos"
          value={totals.active}
          accent="gold"
        />
        <SummaryCard
          label="Melhor dia"
          value={totals.best ? formatShort(totals.best.date) : "—"}
          sub={totals.best ? `${totals.best.xp} XP` : "sem dados"}
          accent="gold"
        />
      </div>

      {/* Sequência */}
      <div className="sys-frame p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-label">Sequência</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-display text-[14px] text-gold tabular">
              <Flame size={14} /> {player?.streak || 0}
            </span>
            <span className="text-[11px] text-secondary">
              recorde 30d: {longest}
            </span>
          </div>
        </div>
        <StreakStrip series={series} />
        <div className="flex gap-3 text-[10px] text-ghost">
          <span className="flex items-center gap-1">
            <i className="w-2 h-2 inline-block bg-blue rounded-[1px]" /> ativo
          </span>
          <span className="flex items-center gap-1">
            <i className="w-2 h-2 inline-block bg-gold rounded-[1px]" />{" "}
            sequência atual
          </span>
        </div>
      </div>

      {/* Treino guiado — resumo pós-treino */}
      <div className="sys-frame p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-label flex items-center gap-1.5">
            <Dumbbell size={13} /> Treino guiado
          </p>
          <span className="font-display text-[13px] text-purple tabular">
            {training.sessions} {training.sessions === 1 ? "sessão" : "sessões"} ·{" "}
            {formatDuration(training.sec)}
          </span>
        </div>

        {training.sessions === 0 ? (
          <p className="text-[11px] text-ghost leading-relaxed">
            Complete um treino guiado (botão "Treino guiado" nas missões de
            exercício) para o Sistema registrar suas sessões por aqui.
          </p>
        ) : (
          <>
            <SessionStrip series={series} />
            {recentSessions.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {recentSessions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-primary truncate">{s.title}</span>
                    <span className="text-secondary tabular whitespace-nowrap">
                      {formatShort(s.date)} · {s.sets}{" "}
                      {s.sets === 1 ? "série" : "séries"} ·{" "}
                      {formatDuration(s.sec)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 text-[10px] text-ghost">
              <span className="flex items-center gap-1">
                <i className="w-2 h-2 inline-block bg-purple rounded-[1px]" />{" "}
                treino no dia
              </span>
              <span className="flex items-center gap-1">
                <i className="w-2 h-2 inline-block bg-gold rounded-[1px]" /> hoje
              </span>
            </div>
          </>
        )}
      </div>

      {/* Gráficos */}
      <div className="sys-frame p-3 space-y-4">
        <div>
          <p className="text-label mb-2">XP por dia</p>
          <BarChart series={series} mode="xp" />
        </div>
        <div>
          <p className="text-label mb-2">Missões por dia</p>
          <BarChart series={series} mode="count" />
        </div>

        {/* Distribuição por categoria */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const n = totals.catTotals[cat] || 0;
            if (n === 0) return null;
            return (
              <span
                key={cat}
                className="px-2 py-1 rounded-[3px] border text-[10px] uppercase tracking-wider"
                style={{ color: meta.color, borderColor: meta.color, opacity: 0.85 }}
              >
                {meta.label} {n}
              </span>
            );
          })}
        </div>
      </div>

      {/* Insights por observação */}
      <InsightsPanel insights={insights} />

      <p className="text-[10px] text-ghost leading-relaxed">
        Leitura observacional: o Sistema aprende seus padrões a partir do
        histórico local. Nenhum dado sai do dispositivo — sem treinar modelos,
        apenas observação.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  const color =
    accent === "blue"
      ? "text-blue"
      : accent === "purple"
        ? "text-purple"
        : "text-gold";
  return (
    <div className="sys-frame p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-secondary">
        {label}
      </p>
      <p className={`font-display text-[20px] font-bold tabular ${color}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-ghost">{sub}</p>}
    </div>
  );
}
