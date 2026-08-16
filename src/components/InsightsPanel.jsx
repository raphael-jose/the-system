import {
  Activity,
  CalendarDays,
  Clock3,
  Flame,
  ScanEye,
  TrendingUp,
  Trophy,
} from "lucide-react";

const ICONS = {
  day: CalendarDays,
  hour: Clock3,
  best: Trophy,
  streak: Flame,
  avg: Activity,
  empty: ScanEye,
};

/** Painel de padrões detectados por observação do histórico. */
export default function InsightsPanel({ insights }) {
  return (
    <div className="sys-frame divide-y divide-dim">
      <div className="px-3 py-2 flex items-center justify-between">
        <h2 className="text-label">Padrões detectados</h2>
        <TrendingUp size={14} className="text-purple" />
      </div>
      {insights.map((ins) => {
        const Icon = ICONS[ins.id] || TrendingUp;
        return (
          <div key={ins.id} className="px-3 py-2.5 flex items-center gap-3">
            <span
              className={`${
                ins.id === "empty" ? "text-secondary" : "text-blue"
              } flex-none`}
            >
              <Icon size={16} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] tracking-wide truncate">
                {ins.value}
              </p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-secondary">
                {ins.label}
              </p>
              {ins.detail && (
                <p className="text-[11px] text-ghost mt-0.5">{ins.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
