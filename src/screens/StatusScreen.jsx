import { useState } from "react";
import { Check, Flame, Footprints, ListChecks, Shield, Sparkles, Timer } from "lucide-react";
import { useGame } from "../hooks/useGame.jsx";
import { usePlayer } from "../hooks/usePlayer";
import { useXP } from "../hooks/useXP";
import { useMissions } from "../hooks/useMissions";
import { useDungeons } from "../hooks/useDungeons";
import { nextDungeonDeadline } from "../utils/notify";
import { todayStr } from "../utils/dates";
import { formatSteps, walkTotals } from "../utils/walk";
import { ORAL_SLOTS } from "../data/oralCare";
import OralBrushModal from "../components/OralBrushModal";
import RankBadge from "../components/RankBadge";
import XpBar from "../components/XpBar";
import StatBar from "../components/StatBar";
import { STAT_ORDER } from "../data/statMeta";
import { streakMultiplier } from "../utils/xp";

export default function StatusScreen({ run, onGoMissions, onGoDungeons, onOpenWalk }) {
  const { save } = useGame();
  // escovação em andamento (slot aberto no modal com temporizador)
  const [brushing, setBrushing] = useState(null);
  const oral = save?.player?.oral || { date: "", slots: [false, false, false], fullDays: 0 };
  const { player } = usePlayer();
  const { rank, level, xp, xpToNext, pct, multiplier } = useXP();
  const { dailyMissions } = useMissions();
  const { dungeons } = useDungeons();

  // próxima dungeon a vencer (chip de urgência)
  const nextDungeon = nextDungeonDeadline(dungeons);
  const urgent = nextDungeon && nextDungeon.daysLeft <= 2;
  // dungeon atual do chip (para o progresso manual)
  const currentDungeon = nextDungeon
    ? dungeons.find((d) => d.id === nextDungeon.id)
    : null;
  const dgPct = currentDungeon
    ? Math.min(100, Math.round((currentDungeon.progress / currentDungeon.goal) * 100))
    : 0;
  // menos de 24h para vencer → contagem regressiva em horas/minutos
  const countdown = nextDungeon && nextDungeon.hoursLeft != null;
  const critical = (nextDungeon && nextDungeon.daysLeft <= 0) || countdown;
  const deadlineText = nextDungeon
    ? countdown
      ? nextDungeon.hoursLeft >= 1
        ? `faltam ${nextDungeon.hoursLeft}h`
        : nextDungeon.minsLeft >= 1
          ? `faltam ${nextDungeon.minsLeft}min`
          : "expira a qualquer momento"
      : nextDungeon.daysLeft < 0
        ? "prazo vencido"
        : nextDungeon.daysLeft === 0
          ? "expira HOJE"
          : `expira em ${nextDungeon.daysLeft} ${nextDungeon.daysLeft === 1 ? "dia" : "dias"}`
    : null;
  const badgeText = nextDungeon
    ? countdown
      ? nextDungeon.hoursLeft >= 1
        ? `${nextDungeon.hoursLeft}h`
        : `${nextDungeon.minsLeft}min`
      : nextDungeon.daysLeft === 0
        ? "HOJE"
        : nextDungeon.daysLeft < 0
          ? "0d"
          : `${nextDungeon.daysLeft}d`
    : null;

  // caminhadas de hoje (pedômetro): soma passos/km do registro do dia
  const todayWalk = (() => {
    const rec = save?._dailyHistory?.[todayStr()];
    const walks = Array.isArray(rec?.walks) ? rec.walks : [];
    let steps = 0;
    let km = 0;
    for (const w of walks) {
      steps += Math.max(0, Number(w.steps) || 0);
      km += Math.max(0, Number(w.km) || 0);
    }
    return { steps, km };
  })();

  const doneToday = dailyMissions.filter((m) => m.completed).length;
  const totalDaily = dailyMissions.length;
  const streakBonus =
    multiplier > 1 ? Math.round((multiplier - 1) * 100) : 0;
  // expira hoje (ou já venceu): chip ganha pulso vermelho de urgência
  const expiringToday = nextDungeon && nextDungeon.daysLeft <= 0;

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      {/* Header: nome + rank */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-label">Caçador</p>
          <h1 className="font-display font-black text-[22px] truncate">
            {player?.name || "Hunter"}
          </h1>
        </div>
        <RankBadge rank={rank.rank} />
      </div>

      {/* Level + XP */}
      <div className="sys-frame p-4 glow-blue">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-label">Nível</p>
            <span className="level-number text-[48px]">{level}</span>
          </div>
          <div className="text-right pb-1">
            <p className="font-title text-[13px] uppercase tracking-widest text-secondary">
              {rank.label}
            </p>
            <p className="text-[11px] text-ghost">Rank {rank.rank}</p>
          </div>
        </div>
        <XpBar xp={xp} need={xpToNext} pct={pct} />
      </div>

      {/* Streak */}
      <div className="sys-frame p-3 flex items-center gap-3">
        <span
          className={`${
            player?.streak > 0 ? "text-gold" : "text-ghost"
          } flex-none`}
        >
          <Flame size={22} strokeWidth={1.8} />
        </span>
        <div className="flex-1">
          <p className="font-display text-[18px] tabular">
            {player?.streak || 0} {player?.streak === 1 ? "dia" : "dias"}
          </p>
          <p className="text-[11px] text-secondary">Sequência atual</p>
        </div>
        {streakBonus > 0 && (
          <span className="rank-badge !p-[3px_8px] !text-[11px] text-gold border-gold animate-pulse-rank">
            +{streakBonus}% XP
          </span>
        )}
      </div>

      {/* Próxima dungeon a vencer */}
      {nextDungeon && (
        <button
          type="button"
          onClick={onGoDungeons}
          className={`sys-frame p-3 flex items-center gap-3 w-full text-left border-l-[3px] ${
            urgent ? "border-l-danger" : "border-l-purple"
          } ${critical ? "danger-pulse" : ""}`}
        >
          <Timer
            size={16}
            className={`flex-none ${urgent ? "text-danger" : "text-purple"}`}
          />
          <div className="flex-1 min-w-0">
            <p className="font-title text-[13px] font-semibold truncate text-primary">
              {nextDungeon.title}
            </p>
            <p className="text-[11px] text-secondary">
              Próxima dungeon ·{" "}
              <span className={urgent ? "text-danger" : "text-purple"}>
                {deadlineText}
              </span>
            </p>
            {currentDungeon && (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-ghost tabular">
                    {currentDungeon.progress} / {currentDungeon.goal}{" "}
                    {currentDungeon.unit}
                  </p>
                  <p className="font-display text-[10px] text-secondary tabular">
                    {dgPct}%
                  </p>
                </div>
                <div className="mt-1 h-[4px] rounded-[2px] bg-dim overflow-hidden">
                  <div
                    className="h-full rounded-[2px] transition-all"
                    style={{
                      width: `${dgPct}%`,
                      background:
                        "linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <span
            className={`rank-badge !p-[2px_8px] !text-[11px] ${
              urgent
                ? "text-danger border-danger"
                : "text-purple border-purple"
            } ${critical ? "danger-pulse" : ""}`}
          >
            {badgeText}
          </span>
        </button>
      )}

      {/* Progresso do dia */}
      <div className="sys-frame p-3 flex items-center gap-3">
        <Shield size={18} className="text-blue flex-none" />
        <div className="flex-1">
          <p className="font-display text-[15px] tabular">
            {doneToday} / {totalDaily}
          </p>
          <p className="text-[11px] text-secondary">Missões diárias hoje</p>
        </div>
        <button
          type="button"
          onClick={onGoMissions}
          className="btn-system px-3 py-1.5 text-[11px]"
        >
          Ir às missões
        </button>
      </div>

      {/* Higiene bucal — escovação 3x ao dia */}
      <div className="sys-frame p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-success flex-none" />
            <span className="text-label">Higiene bucal</span>
          </div>
          <span className="font-display text-[11px] text-secondary tabular">
            {oral.slots.filter(Boolean).length}/3 ·{" "}
            {oral.fullDays || 0} {oral.fullDays === 1 ? "dia" : "dias"} 3/3
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {ORAL_SLOTS.map((s) => {
            const done = !!oral.slots[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setBrushing(s.id)}
                disabled={done}
                aria-label={`Escovar os dentes — ${s.label} (${s.hint})`}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-[4px] border py-2 px-1 text-[11px] font-title uppercase tracking-wider transition-colors ${
                  done
                    ? "border-success text-success bg-success/10"
                    : "border-dim text-secondary active:border-glow active:text-primary"
                }`}
              >
                <span className="flex items-center gap-1">
                  {done && <Check size={12} />}
                  {s.label}
                </span>
                <span
                  className={`text-[8px] normal-case tracking-normal ${
                    done ? "text-success/70" : "text-ghost"
                  }`}
                >
                  {s.hint}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-ghost mt-1.5">
          Cada escovação: 2 min de relógio → +5 XP · +1 VIT · bônus 3/3: +10 XP ·
          +1 SEN
        </p>
      </div>

      {/* Modal de escovação com temporizador (só marca quando completa) */}
      {brushing != null && (
        <OralBrushModal
          slotId={brushing}
          onDone={(slot) => run({ type: "ORAL_BRUSH", slot })}
          onClose={() => setBrushing(null)}
        />
      )}

      {/* Pedômetro — caminhada com GPS */}
      <div className="sys-frame p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Footprints size={15} className="text-blue flex-none" />
            <span className="text-label">Pedômetro</span>
          </div>
          <span className="font-display text-[11px] text-secondary tabular">
            {formatSteps(todayWalk.steps)} passos · {todayWalk.km.toFixed(2)} km
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenWalk}
          className="btn-system w-full py-2 text-[12px]"
        >
          Iniciar caminhada
        </button>
        <p className="text-[10px] text-ghost mt-1.5">
          Passos por sensor de movimento e rota por GPS — registra no Histórico.
        </p>
      </div>

      {/* Atributos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-label">Atributos</h2>
          {player?.sp > 0 && (
            <span className="rank-badge !p-[2px_8px] !text-[11px] text-gold border-gold">
              SP: {player.sp}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STAT_ORDER.map((stat) => (
            <StatBar
              key={stat}
              stat={stat}
              value={player?.stats?.[stat] ?? 10}
            />
          ))}
        </div>
      </div>

      {/* Acesso rápido */}
      <button
        type="button"
        onClick={onGoMissions}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 w-[52px] h-[52px] rounded-[8px] bg-panel border border-glow glow-blue flex items-center justify-center text-blue active:scale-95 transition-transform"
        aria-label="Ir para missões"
      >
        <ListChecks size={24} strokeWidth={1.8} />
      </button>
    </div>
  );
}
