// Notificações nativas — parte pura testável + helper do Notification API.
import { addDays, daysUntil, parseLocal, todayStr } from "./dates";

const HOUR = 3600000;
const DAY = 86400000;

/**
 * Resumo do meio-dia: o que o caçador já fez hoje até agora.
 * Lê o registro do dia em `_dailyHistory` (ids + xp) e as pendentes
 * das missões diárias. Puro e testável, `today` injetável.
 */
export function noonSummary(save, today = todayStr()) {
  const rec = (save?._dailyHistory || {})[today];
  const done = Array.isArray(rec?.ids) ? rec.ids.length : 0;
  const xp = Number(rec?.xp) || 0;
  const dailies = Array.isArray(save?.dailyMissions)
    ? save.dailyMissions
    : [];
  const total = dailies.length;
  const pending = dailies.filter((m) => !m.completed).length;
  if (pending === 0 && done > 0) {
    return `Meio-dia, caçador. Dia completo: ${done}/${total} missões · +${xp} XP hoje. O Sistema reconhece sua constância.`;
  }
  if (done > 0) {
    return `Meio-dia, caçador. Hoje: ${done}/${total} missões · +${xp} XP. Faltam ${pending} — o Sistema aguarda.`;
  }
  return `Meio-dia, caçador. Nenhuma missão registrada ainda. ${total} aguardando — o Sistema observa.`;
}

/**
 * Dungeons que precisam de alerta: ativas, com prazo a `thresholdDays` dias
 * (ou menos) de vencer, e que ainda não foram avisadas hoje.
 * Retorna [{ id, title, daysLeft }].
 */
export function dungeonsExpiring(
  dungeons,
  thresholdDays,
  today = todayStr(),
  notified = []
) {
  const notifiedSet = new Set(notified || []);
  return (dungeons || [])
    .filter((d) => d && !d.completed && !d.failed && !d.claimedAt && d.startedAt)
    .map((d) => ({
      id: d.id,
      title: d.title,
      daysLeft: daysUntil(addDays(d.startedAt, d.deadlineDays), today),
    }))
    .filter(
      (d) =>
        d.daysLeft >= 0 &&
        d.daysLeft <= thresholdDays &&
        !notifiedSet.has(d.id)
    );
}

/**
 * Dungeon ativa com o prazo mais próximo de vencer.
 * Retorna { id, title, daysLeft, hoursLeft, minsLeft } ou null.
 * - daysLeft: granularidade de dia (negativo = prazo já vencido)
 * - hoursLeft/minsLeft: contagem regressiva real quando faltam < 24h
 *   (senão null). `now` (timestamp) injetável para testes determinísticos.
 */
export function nextDungeonDeadline(dungeons, today = todayStr(), now = Date.now()) {
  const actives = (dungeons || []).filter(
    (d) => d && !d.completed && !d.failed && !d.claimedAt && d.startedAt
  );
  let best = null;
  for (const d of actives) {
    const daysLeft = daysUntil(addDays(d.startedAt, d.deadlineDays), today);
    // tempo real até a meia-noite do prazo
    const msLeft = parseLocal(addDays(d.startedAt, d.deadlineDays)).getTime() - now;
    const soon = msLeft > 0 && msLeft < DAY;
    const candidate = {
      id: d.id,
      title: d.title,
      daysLeft,
      hoursLeft: soon ? Math.floor(msLeft / HOUR) : null,
      minsLeft: soon ? Math.floor((msLeft % HOUR) / 60000) : null,
    };
    if (!best || daysLeft < best.daysLeft) best = candidate;
  }
  return best;
}

/** Dispara uma notificação nativa (se permitida). Retorna se enviou. */
export function sendNotification(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
    return true;
  } catch {
    return false;
  }
}

/** O navegador suporta notificações? */
export function notificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}
