// Datas sempre em horário local, formato YYYY-MM-DD.
// Reset é por comparação de data (não timer) — decisão de arquitetura.

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

/** Segunda-feira da semana atual (base do reset semanal). */
export function weekStartStr(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=domingo
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return toDateStr(copy);
}

/** Soma n dias a uma data YYYY-MM-DD. */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toDateStr(dt);
}

/** Data YYYY-MM-DD → Date local (meia-noite). */
export function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Dias entre uma data alvo e hoje (positivo = futuro).
 * `from` opcional (Date ou YYYY-MM-DD) torna o cálculo testável.
 */
export function daysUntil(dateStr, from) {
  const target = parseLocal(dateStr);
  const now = from
    ? typeof from === "string"
      ? parseLocal(from)
      : new Date(from)
    : new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

/** Data de ontem como string. */
export function yesterdayStr() {
  return addDays(todayStr(), -1);
}

/**
 * Verdadeiro se a data é `ref` (hoje) ou o dia anterior — usado para
 * destacar conquistas recém-desbloqueadas. `ref` injetável p/ teste.
 */
export function isRecentUnlock(dateStr, ref = todayStr()) {
  if (!dateStr) return false;
  return dateStr === ref || dateStr === addDays(ref, -1);
}

/** Segundos restantes até a meia-noite local (para agendar re-render). */
export function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}
