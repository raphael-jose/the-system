import { STAT_ICONS, STAT_COLORS, STAT_NAMES } from "../data/statMeta";

/**
 * Atributo com ícone custom, valor e barra de progresso.
 * Barra reflete a distância até o próximo "ponto de marco" (cada 10 = 100%).
 */
export default function StatBar({ stat, value, highlight }) {
  const Icon = STAT_ICONS[stat];
  const color = STAT_COLORS[stat];
  const pct = Math.min(100, ((value % 10) / 10) * 100);

  return (
    <div
      className={`sys-frame p-3 ${highlight ? "glow-blue" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{Icon && <Icon size={16} />}</span>
        <span className="text-label flex-1">{STAT_NAMES[stat]}</span>
        <span
          className="font-display text-[16px] tabular"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      <div className="h-[6px] w-full rounded-[2px] bg-bluedim overflow-hidden">
        <div
          className="stat-fill h-full rounded-[2px]"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          }}
        />
      </div>
    </div>
  );
}
