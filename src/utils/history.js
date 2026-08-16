// Análise observacional do histórico de sessão.
// Sem treinar modelos: o Sistema apenas extrai padrões dos dados locais
// (aprendizado por observação, como manda a arquitetura do GRIÔ/SYSTEM).
import { todayStr, addDays } from "./dates";

export const HISTORY_DAYS = 30;

export const WEEKDAY_PLURAL = [
  "domingos",
  "segundas",
  "terças",
  "quartas",
  "quintas",
  "sextas",
  "sábados",
];

export const WEEKDAY_SINGULAR = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Dia da semana (0=domingo) de uma data YYYY-MM-DD. */
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Data curta dd/mm para exibição. */
export function formatShort(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// Normaliza um registro do _dailyHistory (aguenta o formato antigo: array de ids).
function dayRecord(dailyHistory, date) {
  const rec = (dailyHistory || {})[date];
  if (Array.isArray(rec)) return { ids: rec, xp: 0, hours: [], byCat: {} };
  return {
    ids: Array.isArray(rec?.ids) ? rec.ids : [],
    xp: Number(rec?.xp) || 0,
    hours: Array.isArray(rec?.hours) ? rec.hours : [],
    byCat: rec?.byCat && typeof rec.byCat === "object" ? rec.byCat : {},
    sessions: Array.isArray(rec?.sessions) ? rec.sessions : [],
  };
}

/**
 * Série dos últimos `days` dias, do mais antigo ao mais recente (hoje no fim).
 * Dias sem atividade entram zerados — o gráfico mantém a escala completa.
 */
export function buildSeries(dailyHistory, days = HISTORY_DAYS) {
  const today = todayStr();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const rec = dayRecord(dailyHistory, date);
    out.push({
      date,
      xp: rec.xp,
      count: rec.ids.length,
      byCat: rec.byCat,
      hours: rec.hours,
      sessions: rec.sessions,
      weekday: weekdayOf(date),
      isToday: date === today,
    });
  }
  return out;
}

/**
 * Frase que reconhece o padrão do dia a partir do Histórico
 * (ex.: "Terça é seu dia de treino forte."), ou null sem padrão claro.
 * `dateStr` injetável para testes determinísticos.
 */
export function patternSentence(dailyHistory, dateStr = todayStr()) {
  const series = buildSeries(dailyHistory);
  const wd = weekdayOf(dateStr);
  const trainByWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of series) {
    if ((d.byCat.treino || 0) > 0) trainByWeekday[d.weekday]++;
  }
  const maxTrain = Math.max(...trainByWeekday);
  if (maxTrain < 2) return null;
  const bestWd = trainByWeekday.indexOf(maxTrain);
  if (trainByWeekday[wd] === maxTrain) {
    return `${cap(WEEKDAY_SINGULAR[wd])} é seu dia de treino forte.`;
  }
  return `Seu dia mais forte costuma ser ${WEEKDAY_SINGULAR[bestWd]}.`;
}

/**
 * Faltam N unidades para a semanal mais próxima de completar.
 * Ex.: "Faltam 2 treinos para a semanal \"5 Treinos na Semana\"."
 * Retorna null quando não há semanais em andamento.
 */
export function weeklyProgressLine(weeklyMissions) {
  const active = (weeklyMissions || []).filter(
    (w) =>
      w && !w.completed && Number(w.need) > 0 && typeof w.progress === "number"
  );
  if (active.length === 0) return null;
  const closest = [...active].sort(
    (a, b) => b.progress / b.need - a.progress / a.need
  )[0];
  const left = Math.max(1, Math.ceil(closest.need - closest.progress));
  const unit = closest.unit || "unidades";
  // singular: "Falta 1 treino" (não "Faltam 1 treinos")
  const singular = unit.endsWith("ões")
    ? unit.slice(0, -3) + "ão"
    : unit.endsWith("s")
      ? unit.slice(0, -1)
      : unit;
  const noun = left === 1 ? singular : unit;
  return `${left === 1 ? "Falta" : "Faltam"} ${left} ${noun} para a semanal "${closest.title}".`;
}

/**
 * Mensagem de encorajamento do dia completo, variando por dia da semana
 * e reconhecendo os padrões do Histórico (aprendizado por observação).
 * `weeklyMissions` opcional: quando há semanais em andamento, a mensagem
 * ganha um nudge com o que falta para a mais próxima de completar.
 */
export function encouragementMessage(
  dailyHistory,
  player,
  dateStr = todayStr(),
  weeklyMissions = []
) {
  const parts = [];
  const pat = patternSentence(dailyHistory, dateStr);
  if (pat) parts.push(pat);
  parts.push("Dia completo: todas as missões concluídas.");
  const streak = player?.streak || 0;
  if (streak >= 3) parts.push(`${streak} dias de sequência registrados.`);
  const weekly = weeklyProgressLine(weeklyMissions);
  if (weekly) parts.push(weekly);
  parts.push("O Sistema reconhece sua constância, caçador.");
  return parts.join(" ");
}

/**
 * Total de sessões guiadas e tempo treinado (em segundos) no período.
 * Cada item de `series` tem `sessions: [{ title, sec, sets }]`.
 */
export function sessionTotals(series) {
  let sessions = 0;
  let sec = 0;
  for (const d of series) {
    for (const s of d.sessions || []) {
      sessions++;
      sec += Math.max(0, Number(s.sec) || 0);
    }
  }
  return { sessions, sec };
}

/** Segundos → "2h 05min" / "45min" / "30s" (resumo de treino). */
export function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/** Maior sequência de dias consecutivos com atividade no período. */
export function longestStreak(series) {
  let best = 0;
  let cur = 0;
  for (const d of series) {
    cur = d.count > 0 ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

/**
 * Índice onde começa a sequência ATUAL (células douradas no strip visual).
 * Se hoje ainda não tem atividade, a sequência pode incluir ontem.
 */
export function currentRunStart(series) {
  let i = series.length - 1;
  if (series[i] && series[i].count === 0) i--;
  while (i >= 0 && series[i].count > 0) i--;
  return i + 1;
}

function mostFrequent(arr) {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/**
 * Insights por observação: padrões extraídos do histórico (sem IA).
 * Retorna [{ id, value, label, detail }] — id mapeia ícone na UI.
 */
export function computeInsights(dailyHistory, player, days = HISTORY_DAYS) {
  const series = buildSeries(dailyHistory, days);
  const active = series.filter((d) => d.count > 0);
  const insights = [];

  if (active.length === 0) {
    return [
      {
        id: "empty",
        value: "—",
        label: "Calibrando leitura",
        detail:
          "Complete missões para o Sistema mapear seus padrões de treino e estudo.",
      },
    ];
  }

  // 1) Dia da semana com mais treino ("você treina mais às terças")
  const trainByWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of series) {
    if ((d.byCat.treino || 0) > 0) trainByWeekday[d.weekday]++;
  }
  const bestTrain = Math.max(...trainByWeekday);
  if (bestTrain >= 2) {
    const wd = trainByWeekday.indexOf(bestTrain);
    insights.push({
      id: "day",
      value: WEEKDAY_PLURAL[wd].toUpperCase(),
      label: "Você treina mais às",
      detail: `${bestTrain} ${bestTrain === 1 ? "dia" : "dias"} de treino nos últimos ${days} dias`,
    });
  } else {
    const countByWeekday = [0, 0, 0, 0, 0, 0, 0];
    for (const d of series) countByWeekday[d.weekday] += d.count;
    const wd = countByWeekday.indexOf(Math.max(...countByWeekday));
    insights.push({
      id: "day",
      value: WEEKDAY_PLURAL[wd].toUpperCase(),
      label: "Dia de maior atividade",
      detail: `${countByWeekday[wd]} missões nos últimos ${days} dias`,
    });
  }

  // 2) Horário de pico (moda dos horários de conclusão)
  const hours = series.flatMap((d) => d.hours || []);
  if (hours.length >= 3) {
    const h = mostFrequent(hours);
    insights.push({
      id: "hour",
      value: `${String(h).padStart(2, "0")}h–${String((h + 1) % 24).padStart(2, "0")}h`,
      label: "Pico de atividade",
      detail: `${hours.length} registros de conclusão`,
    });
  }

  // 3) Dia mais produtivo (maior XP no período)
  let best = null;
  for (const d of series) {
    if (d.xp > 0 && (!best || d.xp > best.xp)) best = d;
  }
  if (best) {
    insights.push({
      id: "best",
      value: `${formatShort(best.date)} · ${best.xp} XP`,
      label: "Dia mais produtivo",
      detail: `${best.count} ${best.count === 1 ? "missão" : "missões"} naquele dia`,
    });
  }

  // 4) Maior sequência no período
  const ls = longestStreak(series);
  if (ls >= 2) {
    insights.push({
      id: "streak",
      value: `${ls} ${ls === 1 ? "dia" : "dias"}`,
      label: "Maior sequência no período",
      detail:
        player?.streak >= ls
          ? "recorde atual — sustentado"
          : "recorde dos últimos 30 dias",
    });
  }

  // 5) Média de missões por dia ativo
  const total = active.reduce((a, d) => a + d.count, 0);
  const avg = total / active.length;
  insights.push({
    id: "avg",
    value: avg.toFixed(1).replace(".", ","),
    label: "Missões por dia ativo",
    detail: `${active.length} ${active.length === 1 ? "dia" : "dias"} ativos no período`,
  });

  return insights;
}
