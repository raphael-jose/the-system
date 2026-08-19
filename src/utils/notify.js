// Notificações nativas — parte pura testável + helper do Notification API.
import { addDays, daysUntil, parseLocal, todayStr, weekStartStr } from "./dates";

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
    // ícone resolve em relação à página atual — funciona na raiz E em
    // subpasta (ex.: GitHub Pages /the-system/), onde "/icons" quebraria
    const iconUrl = new URL("icons/icon-192.png", window.location.href).href;
    new Notification(title, {
      body,
      icon: iconUrl,
      badge: iconUrl,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resumo semanal: tudo que o caçador fez na semana (seg→dom).
 * Calcula XP total, dias ativos, missões completadas, streak e walks.
 * `today` injetável para testes.
 */
export function weeklySummary(save, today = todayStr()) {
  const wk = weekStartStr(parseLocal(today));
  const hist = save?._dailyHistory || {};

  let totalXp = 0;
  let activeDays = 0;
  let totalMissions = 0;
  let totalWalks = 0;
  let totalSteps = 0;
  let totalKm = 0;
  const byCat = {};

  // Itera dia a dia da segunda até hoje
  let d = wk;
  while (d <= today) {
    const rec = hist[d];
    if (rec && !Array.isArray(rec)) {
      const xp = Number(rec.xp) || 0;
      const ids = Array.isArray(rec.ids) ? rec.ids : [];
      const walks = Array.isArray(rec.walks) ? rec.walks : [];
      if (xp > 0 || ids.length > 0) activeDays++;
      totalXp += xp;
      totalMissions += ids.length;
      for (const cat of Object.keys(rec.byCat || {})) {
        byCat[cat] = (byCat[cat] || 0) + rec.byCat[cat];
      }
      for (const w of walks) {
        totalWalks++;
        totalSteps += Math.max(0, Number(w.steps) || 0);
        totalKm += Math.max(0, Number(w.km) || 0);
      }
    }
    d = addDays(d, 1);
  }

  const streak = save?.player?.streak || 0;
  const weekliesCompleted = (save?.weeklyMissions || []).filter((m) => m.completed).length;
  const weekliesTotal = (save?.weeklyMissions || []).length;

  const lines = [];
  lines.push(`Resumo da semana, caçador.`);
  lines.push(`${activeDays} dias ativos · ${totalMissions} missões · ${totalXp} XP.`);

  if (totalWalks > 0) {
    lines.push(
      `${totalWalks} caminhada${totalWalks > 1 ? "s" : ""}: ${totalSteps.toLocaleString("pt-BR")} passos · ${totalKm.toFixed(1)} km.`
    );
  }

  if (weekliesCompleted > 0) {
    lines.push(
      `${weekliesCompleted}/${weekliesTotal} semanais concluídas.`
    );
  } else if (weekliesTotal > 0) {
    lines.push(`Nenhuma semanal concluída ainda — amanhã é segunda, recomece.`);
  }

  if (streak >= 7) {
    lines.push(`Streak de ${streak} dias! O Sistema reconhece sua disciplina.`);
  } else if (streak >= 3) {
    lines.push(`${streak} dias de streak — continue firme.`);
  } else {
    lines.push(`Streak atual: ${streak} dias.`);
  }

  return lines.join(" ");
}

/** O navegador suporta notificações? */
export function notificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}
