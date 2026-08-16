import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { formatClock } from "../utils/timer";
import { playSound } from "../utils/sound";
import { ORAL_BRUSH_SEC, ORAL_SLOTS } from "../data/oralCare";

/**
 * Escovação com temporizador — anti-trapaça.
 * O slot só é marcado quando o relógio COMPLETA os 2 minutos:
 * - Contagem baseada em timestamp (endAt): trocar de aba/voltar não pausa,
 *   então não dá para "escapar" do tempo esperando.
 * - Fechar/cancelar antes do fim = sem crédito (nenhum XP, slot intacto).
 */
export default function OralBrushModal({ slotId, onDone, onClose }) {
  const slot = ORAL_SLOTS.find((s) => s.id === slotId) || ORAL_SLOTS[0];
  const [left, setLeft] = useState(ORAL_BRUSH_SEC);
  const [done, setDone] = useState(false);
  const endAtRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    endAtRef.current = Date.now() + ORAL_BRUSH_SEC * 1000;
    const iv = setInterval(() => {
      const remain = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000)
      );
      setLeft(remain);
      if (remain <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        clearInterval(iv);
        setDone(true);
        playSound("done");
        try {
          navigator.vibrate?.(200);
        } catch {
          /* sem suporte */
        }
        onDone(slotId);
        setTimeout(onClose, 900);
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId]);

  const pct = Math.min(100, (1 - left / ORAL_BRUSH_SEC) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Escovação — ${slot.label} (${slot.hint})`}
    >
      <div className="sys-frame relative w-full max-w-[320px] p-6 text-center glow-success">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancelar escovação (sem crédito)"
          className="absolute top-3 right-3 p-2 text-secondary active:text-primary"
        >
          <X size={16} />
        </button>

        <p className="text-label">Higiene bucal</p>
        <h2 className="font-display font-black text-[20px] uppercase tracking-wider mt-1">
          {slot.label}
        </h2>
        <p className="text-[12px] text-secondary">{slot.hint}</p>

        <p
          className={`level-number font-black text-[64px] tabular mt-4 ${
            done ? "text-success" : ""
          }`}
        >
          {done ? "0:00" : formatClock(left)}
        </p>

        <div className="mt-3 h-[6px] rounded-[2px] bg-dim overflow-hidden">
          <div
            className="h-full rounded-[2px] transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #16a34a, #22c55e, #4ade80)",
            }}
          />
        </div>

        <p className="mt-4 text-[12px] text-secondary min-h-[32px]">
          {done ? (
            <span className="text-success font-title font-semibold flex items-center justify-center gap-1.5">
              <Check size={14} /> Escovação completa — +5 XP · +1 VIT
            </span>
          ) : (
            "Escove agora. O relógio não para."
          )}
        </p>

        {!done && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-[11px] text-ghost underline underline-offset-2"
          >
            Cancelar (sem crédito)
          </button>
        )}
      </div>
    </div>
  );
}
