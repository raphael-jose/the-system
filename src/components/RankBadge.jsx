import { RANK_COLORS } from "../data/ranks";

/**
 * Badge de rank no formato [  S  ].
 * SS ganha glow pulsante; SSS usa gradiente dourado animado.
 */
export default function RankBadge({ rank, size = "md" }) {
  const color = RANK_COLORS[rank] || "#6b7280";
  const isSSS = rank === "SSS";
  const isSS = rank === "SS";

  const cls = [
    "rank-badge",
    isSSS ? "rank-sss" : "",
    size === "lg" ? "text-[28px]" : size === "sm" ? "text-[14px]" : "text-[16px]",
  ]
    .filter(Boolean)
    .join(" ");

  const style = isSSS
    ? undefined
    : { color, borderColor: color, textShadow: `0 0 12px ${color}66` };

  return (
    <span
      className={cls + (isSS ? " animate-pulse-rank" : "")}
      style={style}
      aria-label={`Rank ${rank}`}
    >
      [{rank}]
    </span>
  );
}
