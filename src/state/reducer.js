// Reducer puro do SYSTEM — toda mutação de estado passa por aqui.
// Sem efeitos colaterais, sem acesso a localStorage/browser:
// fácil de testar e previsível.
import { DAILY_SEED, WEEKLY_SEED, DUNGEON_SEED } from "../data/defaultMissions";
import { ORAL_SLOTS, ORAL_XP, ORAL_BONUS_XP } from "../data/oralCare";
import {
  evaluateAchievements,
  achievementSpReward,
} from "../data/achievements";
import { rankForLevel } from "../data/ranks";
import { applyXp, streakMultiplier } from "../utils/xp";
import { todayStr, yesterdayStr, weekStartStr } from "../utils/dates";
import { nofapStreak, NOFAP_MILESTONES } from "../utils/nofap";

const DEFAULT_STATS = { FOR: 10, AGI: 10, VIT: 10, INT: 10, PER: 10, SEN: 10 };

// Pontos de atributo ganhos por level (distribuição manual)
const SP_PER_LEVEL = 3;

function makeDailies() {
  return DAILY_SEED.map((m) => ({ ...m, completed: false, completedAt: null }));
}
function makeWeeklies() {
  return WEEKLY_SEED.map((m) => ({
    ...m,
    completed: false,
    completedAt: null,
    progress: 0,
  }));
}
function makeDungeons() {
  return DUNGEON_SEED.map((d) => ({
    ...d,
    progress: 0,
    startedAt: null,
    completed: false,
    failed: false,
  }));
}

export function defaultSave() {
  const today = todayStr();
  return {
    player: {
      name: "",
      level: 1,
      xp: 0,
      stats: { ...DEFAULT_STATS },
      streak: 0,
      lastLoginDate: today,
      lastActivityDate: "",
      totalMissionsCompleted: 0,
      titles: [],
      notifications: false,
      notifTime: "20:00",
      notifLastFired: "",
      notifNoon: false,
      notifNoonFired: "",
      notifDungeon: false,
      notifDungeonDays: 2,
      soundOn: true,
      sp: 0,
      spAllocated: 0,
      restSec: 45,
      trainingImmersive: false,
      nofap: { lastRelapse: null, bestStreak: 0, lastClaim: null, milestones: [] },
      oral: { date: today, slots: [false, false, false], fullDays: 0, lastFullDate: null },
    },
    dailyMissions: makeDailies(),
    weeklyMissions: makeWeeklies(),
    dungeons: makeDungeons(),
    lastDailyReset: today,
    lastWeeklyReset: weekStartStr(),
    _fullDailyDays: [], // datas em que todas as diárias foram fechadas
    _dailyHistory: {}, // data -> { ids, xp, hours, byCat, sessions } (semanais + histórico)
    achievements: [], // [{ id, unlockedAt }]
    _notifLog: {}, // data -> { dungeons: [ids avisados no dia] }
    createdAt: today,
  };
}

// Migração: saves antigos ganham campos novos sem perder dados.
export function migrate(state) {
  if (!state) return state;
  const base = defaultSave();
  const player = { ...base.player, ...state.player };
  player.stats = { ...DEFAULT_STATS, ...(state.player?.stats || {}) };

  const dailyById = new Map((state.dailyMissions || []).map((m) => [m.id, m]));
  const dailyMissions = makeDailies().map((m) => ({
    ...m,
    ...(dailyById.get(m.id) || {}),
  }));

  const weeklyById = new Map((state.weeklyMissions || []).map((m) => [m.id, m]));
  const weeklyMissions = makeWeeklies().map((m) => ({
    ...m,
    ...(weeklyById.get(m.id) || {}),
  }));

  const dungeonById = new Map((state.dungeons || []).map((d) => [d.id, d]));
  const dungeons = makeDungeons().map((d) => ({
    ...d,
    ...(dungeonById.get(d.id) || {}),
  }));

  return {
    ...base,
    ...state,
    player,
    dailyMissions,
    weeklyMissions,
    dungeons,
    _fullDailyDays: Array.isArray(state._fullDailyDays)
      ? state._fullDailyDays
      : [],
    _dailyHistory: normalizeHistory(state._dailyHistory),
    achievements: Array.isArray(state.achievements)
      ? state.achievements.filter((a) => a && a.id)
      : [],
    _notifLog:
      state._notifLog && typeof state._notifLog === "object"
        ? state._notifLog
        : {},
  };
}

// Converte o histórico para o formato novo { ids, xp, hours, byCat }.
// Saves antigos guardavam só o array de ids — xp/horário valem 0.
function normalizeHistory(raw) {
  const src = raw || {};
  const out = {};
  for (const [d, rec] of Object.entries(src)) {
    if (Array.isArray(rec)) {
      out[d] = { ids: rec, xp: 0, hours: [], byCat: {}, sessions: [] };
    } else {
      out[d] = {
        ids: Array.isArray(rec?.ids) ? rec.ids : [],
        xp: Number(rec?.xp) || 0,
        hours: Array.isArray(rec?.hours) ? rec.hours : [],
        byCat: rec?.byCat && typeof rec.byCat === "object" ? rec.byCat : {},
        sessions: Array.isArray(rec?.sessions) ? rec.sessions : [],
      };
    }
  }
  return out;
}

const EXERCISE_DAILIES = ["d-pushups", "d-squats", "d-cardio"];
const STUDY_DAILY = "d-study";
const ALL_DAILY_ID = "d-all";

// ---- Histórico diário: { [data]: { ids, xp, hours, byCat, sessions } } ----
// ids: missões concluídas no dia (alimenta as semanais)
// xp: XP ganho no dia (diárias + bônus + semanais + dungeons)
// hours: horários de conclusão (insight de pico de atividade)
// byCat: contagem por categoria (insight "treina mais às terças")
// sessions: treinos guiados concluídos [{ title, sec, sets }] (resumo pós-treino)
function historyIds(rec) {
  return Array.isArray(rec) ? rec : Array.isArray(rec?.ids) ? rec.ids : [];
}
function emptyDayRecord() {
  return { ids: [], xp: 0, hours: [], byCat: {}, sessions: [] };
}
function addCat(byCat, cat) {
  if (!cat) return byCat;
  return { ...byCat, [cat]: (byCat[cat] || 0) + 1 };
}

const WEEKLY_NEEDS = {
  "w-trainings": 5,
  "w-reading": 100,
  "w-all-daily": 4,
  "w-streak": 7,
};

function emptyReward() {
  return {
    xpGained: 0,
    statsGained: {},
    levelsGained: 0,
    rankBefore: null,
    rankAfter: null,
    fromLevel: null,
    toLevel: null,
    titlesGained: [],
    weeklyCompleted: [],
    spGained: 0,
    spFromAch: 0,
    achievementsGained: [],
    toast: null,
  };
}

function mergeStats(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = (out[k] || 0) + v;
  }
  return out;
}

function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

// Aplica conquistas recém-desbloqueadas (condições puras do catálogo).
// Conquistas épicas concedem SP bônus (spReward do catálogo).
// Retorna [estado, idsNovos].
function applyAchievements(s, today) {
  const pending = evaluateAchievements(s);
  const owned = new Set((s.achievements || []).map((a) => a.id));
  const newly = pending.filter((id) => !owned.has(id));
  if (newly.length === 0) return [s, []];
  const achSp = achievementSpReward(newly);
  return [
    {
      ...s,
      achievements: [
        ...(s.achievements || []),
        ...newly.map((id) => ({ id, unlockedAt: today })),
      ],
      player:
        achSp > 0
          ? { ...s.player, sp: (s.player.sp || 0) + achSp }
          : s.player,
    },
    newly,
  ];
}

// Calcula progresso atual de uma missão semanal a partir do estado.
function weeklyProgressFor(state, weekly) {
  const wk = weekStartStr();
  if (weekly.id === "w-trainings") {
    // dias distintos com pelo menos 1 treino (histórico persistente)
    const dates = new Set(
      Object.entries(state._dailyHistory || {})
        .filter(
          ([d, rec]) =>
            d >= wk && historyIds(rec).some((i) => EXERCISE_DAILIES.includes(i))
        )
        .map(([d]) => d)
    );
    return dates.size;
  }
  if (weekly.id === "w-reading") return Math.min(100, weekly.progress);
  if (weekly.id === "w-all-daily") {
    return state._fullDailyDays.filter((d) => d >= wk).length;
  }
  if (weekly.id === "w-streak") return Math.min(7, state.player.streak);
  return weekly.progress;
}

// Reducer principal. Retorna [estadoNovo, resultado|null].
export function reduce(state, action) {
  switch (action.type) {
    case "CREATE_PLAYER": {
      const base = defaultSave();
      return [
        {
          ...base,
          player: {
            ...base.player,
            name: action.name.trim() || "Hunter",
          },
        },
        {
          toast: `Sistema inicializado. Bem-vindo, ${action.name.trim() || "Hunter"}.`,
        },
      ];
    }

    case "SET_NAME": {
      const name = action.name.trim();
      if (!name) return [state, null];
      return [{ ...state, player: { ...state.player, name } }, null];
    }

    case "TOGGLE_NOTIFICATIONS": {
      const next = !state.player.notifications;
      return [
        { ...state, player: { ...state.player, notifications: next } },
        { toast: next ? "Notificações ativadas." : "Notificações desativadas." },
      ];
    }

    case "SET_NOTIF_TIME": {
      if (!action.time) return [state, null];
      return [
        { ...state, player: { ...state.player, notifTime: action.time } },
        { toast: `Lembrete diário às ${action.time}.` },
      ];
    }

    case "SET_REST_SEC": {
      const sec = Number(action.sec);
      if (![30, 45, 60].includes(sec)) return [state, null];
      return [
        { ...state, player: { ...state.player, restSec: sec } },
        { toast: `Descanso entre séries: ${sec}s.` },
      ];
    }

    case "SET_TRAINING_IMMERSIVE": {
      const value = !!action.value;
      if (value === !!state.player.trainingImmersive) return [state, null];
      return [
        { ...state, player: { ...state.player, trainingImmersive: value } },
        {
          toast: value
            ? "Modo imersivo ativado nas próximas sessões."
            : "Modo imersivo desativado.",
        },
      ];
    }

    case "MARK_NOTIF_FIRED": {
      return [
        {
          ...state,
          player: { ...state.player, notifLastFired: todayStr() },
        },
        null,
      ];
    }

    case "TOGGLE_NOON_NOTIF": {
      const next = !state.player.notifNoon;
      return [
        { ...state, player: { ...state.player, notifNoon: next } },
        {
          toast: next
            ? "Resumo do meio-dia ativado (12:00)."
            : "Resumo do meio-dia desativado.",
        },
      ];
    }

    case "MARK_NOON_FIRED": {
      return [
        {
          ...state,
          player: { ...state.player, notifNoonFired: todayStr() },
        },
        null,
      ];
    }

    case "TOGGLE_DUNGEON_NOTIF": {
      const next = !state.player.notifDungeon;
      return [
        { ...state, player: { ...state.player, notifDungeon: next } },
        { toast: next ? "Alerta de dungeon ativado." : "Alerta de dungeon desativado." },
      ];
    }

    case "SET_DUNGEON_NOTIF_DAYS": {
      const days = Number(action.days);
      if (![1, 2, 3].includes(days)) return [state, null];
      return [
        { ...state, player: { ...state.player, notifDungeonDays: days } },
        {
          toast: `Aviso de dungeon: ${days} ${days === 1 ? "dia" : "dias"} antes do prazo.`,
        },
      ];
    }

    case "MARK_DUNGEON_NOTIFIED": {
      const today = todayStr();
      const log = { ...(state._notifLog || {}) };
      const day = {
        ...(log[today] || {}),
        dungeons: [...(log[today]?.dungeons || [])],
      };
      if (!day.dungeons.includes(action.id)) day.dungeons.push(action.id);
      log[today] = day;
      return [{ ...state, _notifLog: log }, null];
    }

    case "TOGGLE_SOUND": {
      const next = !state.player.soundOn;
      return [
        { ...state, player: { ...state.player, soundOn: next } },
        { toast: next ? "Sons ativados." : "Sons desativados." },
      ];
    }

    case "ADD_STAT_POINT": {
      const { stat } = action;
      if (!state.player.sp || !(stat in DEFAULT_STATS)) return [state, null];
      const stats = {
        ...state.player.stats,
        [stat]: state.player.stats[stat] + 1,
      };
      const base = {
        ...state,
        player: {
          ...state.player,
          stats,
          sp: state.player.sp - 1,
          spAllocated: (state.player.spAllocated || 0) + 1,
        },
      };
      const [s2, newly] = applyAchievements(base, todayStr());
      return [
        s2,
        newly.length
          ? { achievementsGained: newly, spFromAch: achievementSpReward(newly) }
          : null,
      ];
    }

    case "AUTO_DISTRIBUTE_SP": {
      // Gasta TODO o SP restante nos atributos mais fracos (desempate pela ordem).
      const sp = state.player.sp || 0;
      if (sp <= 0) return [state, null];
      const stats = { ...state.player.stats };
      const allocated = {};
      const order = Object.keys(DEFAULT_STATS);
      for (let i = 0; i < sp; i++) {
        let best = order[0];
        for (const k of order) {
          if (stats[k] < stats[best]) best = k;
        }
        stats[best] += 1;
        allocated[best] = (allocated[best] || 0) + 1;
      }
      const base = {
        ...state,
        player: {
          ...state.player,
          stats,
          sp: 0,
          spAllocated: (state.player.spAllocated || 0) + sp,
        },
      };
      const [s2, newly] = applyAchievements(base, todayStr());
      return [
        s2,
        {
          spAllocated: allocated,
          spFromAch: achievementSpReward(newly),
          ...(newly.length ? { achievementsGained: newly } : {}),
        },
      ];
    }

    case "IMPORT": {
      const imported = action.save;
      if (!imported || !imported.player?.name) {
        return [state, { toast: "Arquivo de backup inválido." }];
      }
      return [migrate(imported), { toast: "Dados importados com sucesso." }];
    }

    case "TICK": {
      // Chamado ao abrir o app, ao focar a janela e à meia-noite.
      let s = state;
      let toast = null;
      const today = todayStr();

      // Streak quebrado: nenhuma missão ontem
      if (
        s.player.streak > 0 &&
        s.player.lastActivityDate &&
        s.player.lastActivityDate < yesterdayStr()
      ) {
        s = { ...s, player: { ...s.player, streak: 0 } };
        toast = "Streak perdido. Recomece hoje.";
      }

      // Reset diário (meia-noite)
      if (s.lastDailyReset !== today) {
        const wasFull = s.dailyMissions.every(
          (m) => m.id === ALL_DAILY_ID || m.completed
        );
        const fullDays = wasFull
          ? [...new Set([...s._fullDailyDays, s.lastDailyReset])]
          : s._fullDailyDays;
        // poda o histórico antigo (mantém 14 dias)
        const cutoff = addDaysStr(today, -60); // mantém 60 dias p/ o gráfico
        const history = Object.fromEntries(
          Object.entries(s._dailyHistory || {}).filter(([d]) => d >= cutoff)
        );
        s = {
          ...s,
          dailyMissions: s.dailyMissions.map((m) => ({
            ...m,
            completed: false,
            completedAt: null,
          })),
          lastDailyReset: today,
          _fullDailyDays: fullDays,
          _dailyHistory: history,
          player: { ...s.player, lastLoginDate: today },
        };
      }

      // Reset semanal (segunda-feira)
      const wk = weekStartStr();
      if (s.lastWeeklyReset !== wk) {
        s = {
          ...s,
          weeklyMissions: s.weeklyMissions.map((m) => ({
            ...m,
            completed: false,
            completedAt: null,
            progress: 0,
          })),
          lastWeeklyReset: wk,
        };
      }

      // Dungeons com prazo expirado viram falha
      const expired = s.dungeons.filter(
        (d) =>
          !d.completed &&
          !d.failed &&
          d.startedAt &&
          today > addDaysStr(d.startedAt, d.deadlineDays)
      );
      if (expired.length > 0) {
        const expiredIds = new Set(expired.map((d) => d.id));
        s = {
          ...s,
          dungeons: s.dungeons.map((d) =>
            expiredIds.has(d.id) ? { ...d, failed: true } : d
          ),
        };
        const msg = `Dungeon${
          expired.length > 1 ? "s" : ""
        } falhada${expired.length > 1 ? "s" : ""}: ${expired
          .map((d) => d.title)
          .join(", ")}`;
        toast = toast ? [toast, msg] : msg;
      }

      return [s, toast ? { toast } : null];
    }

    case "COMPLETE_MISSION": {
      // action.list: "daily" | "weekly" (action.type é o nome da ação)
      // action.session (opcional): treino guiado concluído { sec, sets }
      const { list, id, session } = action;
      const today = todayStr();
      const missions = list === "daily" ? state.dailyMissions : state.weeklyMissions;
      const idx = missions.findIndex((m) => m.id === id);
      if (idx === -1 || missions[idx].completed) return [state, null];

      let s = state;
      let reward = emptyReward();

      // ---- Streak (apenas diárias alimentam a sequência) ----
      if (list === "daily") {
        const last = s.player.lastActivityDate;
        let streak = s.player.streak;
        if (last === today) {
          // já ativo hoje
        } else if (last === yesterdayStr()) {
          streak += 1;
        } else {
          streak = 1;
        }
        s = { ...s, player: { ...s.player, streak, lastActivityDate: today } };
      }

      // ---- Recompensa da missão ----
      const mult = streakMultiplier(s.player.streak);
      const mission = missions[idx];
      const baseXp = Math.round(mission.xp * mult);
      const stats = { ...s.player.stats };
      for (const [k, v] of Object.entries(mission.stats || {})) {
        stats[k] = (stats[k] || 0) + v;
      }
      let player = {
        ...s.player,
        stats,
        totalMissionsCompleted: s.player.totalMissionsCompleted + 1,
      };

      reward.xpGained += baseXp;
      reward.statsGained = mergeStats(reward.statsGained, mission.stats || {});
      const { player: p1, levelsGained } = applyXp(player, baseXp);
      player = p1;
      reward.levelsGained += levelsGained;

      const newList = missions.map((m, i) =>
        i === idx
          ? {
              ...m,
              completed: true,
              completedAt: today,
              progress:
                list === "weekly"
                  ? Math.max(m.progress, weeklyProgressFor(s, m))
                  : m.progress,
            }
          : m
      );
      s = {
        ...s,
        player,
        [list === "daily" ? "dailyMissions" : "weeklyMissions"]: newList,
      };

      // ---- Histórico diário: ids alimentam as semanais (antes do progresso) ----
      if (list === "daily") {
        const hist = { ...(s._dailyHistory || {}) };
        const prev = hist[today];
        const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
        hist[today] = {
          ...base,
          ids: [...new Set([...historyIds(prev), id])],
        };
        s = { ...s, _dailyHistory: hist };
      }

      // ---- Bônus: todas as diárias do dia ----
      if (list === "daily") {
        const dailies = s.dailyMissions;
        const nonBonus = dailies.filter((m) => m.id !== ALL_DAILY_ID);
        const bonus = dailies.find((m) => m.id === ALL_DAILY_ID);
        const allDone = nonBonus.every((m) => m.completed);
        if (allDone && bonus && !bonus.completed) {
          const bxp = Math.round(bonus.xp * mult);
          const bstats = { ...s.player.stats };
          for (const [k, v] of Object.entries(bonus.stats || {})) {
            bstats[k] = (bstats[k] || 0) + v;
          }
          let p = { ...s.player, stats: bstats };
          const { player: p2, levelsGained: l2 } = applyXp(p, bxp);
          reward.xpGained += bxp;
          reward.statsGained = mergeStats(reward.statsGained, bonus.stats || {});
          reward.levelsGained += l2;
          // o bônus também entra no registro do dia (ids + categoria)
          const hist = { ...(s._dailyHistory || {}) };
          const prev = hist[today];
          const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
          hist[today] = {
            ...base,
            ids: [...new Set([...historyIds(prev), ALL_DAILY_ID])],
            byCat: addCat(base.byCat || {}, "disciplina"),
          };
          s = {
            ...s,
            player: p2,
            _fullDailyDays: s._fullDailyDays.includes(today)
              ? s._fullDailyDays
              : [...s._fullDailyDays, today],
            _dailyHistory: hist,
            dailyMissions: s.dailyMissions.map((m) =>
              m.id === ALL_DAILY_ID
                ? { ...m, completed: true, completedAt: today }
                : m
            ),
          };
        }
      }

      // ---- Progresso + auto-complete semanais ----
      s = {
        ...s,
        weeklyMissions: s.weeklyMissions.map((w) => {
          if (w.completed) return w;
          let progress = w.progress;
          if (list === "daily") {
            if (w.id === "w-reading" && id === STUDY_DAILY) {
              progress = Math.min(100, progress + 20);
            } else {
              progress = weeklyProgressFor(s, w);
            }
          }
          return { ...w, progress };
        }),
      };

      // Auto-completa semanais que atingiram a meta
      const completedWeekly = s.weeklyMissions.filter(
        (w) => !w.completed && w.progress >= (WEEKLY_NEEDS[w.id] ?? Infinity)
      );
      if (completedWeekly.length > 0) {
        const wmap = new Map(s.weeklyMissions.map((w) => [w.id, w]));
        for (const w of completedWeekly) {
          const wxp = Math.round(w.xp * mult);
          const wstats = { ...s.player.stats };
          for (const [k, v] of Object.entries(w.stats || {})) {
            wstats[k] = (wstats[k] || 0) + v;
          }
          let p = { ...s.player, stats: wstats };
          const { player: p2, levelsGained: l3 } = applyXp(p, wxp);
          reward.xpGained += wxp;
          reward.statsGained = mergeStats(reward.statsGained, w.stats || {});
          reward.levelsGained += l3;
          reward.weeklyCompleted.push(w.title);
          // a semanal auto-completa entra no registro do dia (ids + categoria)
          const hist = { ...(s._dailyHistory || {}) };
          const prev = hist[today];
          const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
          hist[today] = {
            ...base,
            ids: [...new Set([...historyIds(prev), w.id])],
            byCat: addCat(base.byCat || {}, w.category),
          };
          s = { ...s, player: p2, _dailyHistory: hist };
          wmap.set(w.id, { ...w, completed: true, completedAt: today });
        }
        s = { ...s, weeklyMissions: s.weeklyMissions.map((w) => wmap.get(w.id)) };
      }

      // ---- SP por level ganho (distribuição manual) ----
      const spGained = reward.levelsGained * SP_PER_LEVEL;
      if (spGained > 0) {
        s = {
          ...s,
          player: { ...s.player, sp: (s.player.sp || 0) + spGained },
        };
      }
      reward.spGained = spGained;

      // ---- Registro diário completo: XP + categoria + horário (gráfico) ----
      {
        const hist = { ...(s._dailyHistory || {}) };
        const prev = hist[today];
        const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
        hist[today] = {
          ids: [...new Set([...historyIds(prev), id])],
          xp: (base.xp || 0) + reward.xpGained,
          hours: [...(base.hours || []), action.hour ?? new Date().getHours()],
          byCat: addCat(base.byCat || {}, mission.category),
          sessions: session
            ? [
                ...(base.sessions || []),
                {
                  title: mission.title,
                  sec: Math.max(0, Math.floor(Number(session.sec) || 0)),
                  sets: Math.max(1, Number(session.sets) || 1),
                },
              ]
            : base.sessions || [],
        };
        s = { ...s, _dailyHistory: hist };
      }

      const beforeLevel = state.player.level;
      const rankBefore = rankForLevel(beforeLevel).rank;
      const rankAfter = rankForLevel(s.player.level).rank;
      reward.rankBefore = rankBefore;
      reward.rankAfter = rankAfter;
      reward.fromLevel = beforeLevel;
      reward.toLevel = s.player.level;

      // ---- Conquistas ----
      const [finalS, newlyAch] = applyAchievements(s, today);
      reward.achievementsGained = newlyAch;
      reward.spFromAch = achievementSpReward(newlyAch);
      return [finalS, reward];
    }

    case "NOFAP_CHECKIN": {
      // Registra o dia limpo: +15 XP e +1 SEN, uma vez por dia.
      // Ao cruzar um marco (7/30/90 dias) concede XP bônus.
      const today = todayStr();
      const nf = state.player.nofap || {};
      if (nf.lastClaim === today) return [state, null];

      const streak = nofapStreak(state, today);
      const bestStreak = Math.max(nf.bestStreak || 0, streak);
      const stats = {
        ...state.player.stats,
        SEN: (state.player.stats.SEN || 0) + 1,
      };

      let player = { ...state.player, stats };
      let levelsGained = 0;
      const baseXp = 15;
      const r1 = applyXp(player, baseXp);
      player = r1.player;
      levelsGained += r1.levelsGained;

      // marcos cruzados (uma vez só cada)
      let milestones = nf.milestones || [];
      let bonusXp = 0;
      const newMilestones = [];
      for (const m of NOFAP_MILESTONES) {
        if (streak >= m.days && !milestones.includes(m.days)) {
          milestones = [...milestones, m.days];
          bonusXp += m.xp;
          newMilestones.push(m);
        }
      }
      if (bonusXp > 0) {
        const r2 = applyXp(player, bonusXp);
        player = r2.player;
        levelsGained += r2.levelsGained;
      }

      const spGained = levelsGained * SP_PER_LEVEL;
      if (spGained > 0) {
        player = { ...player, sp: (player.sp || 0) + spGained };
      }

      // o check-in entra no registro do dia (gráfico + disciplina)
      const hist = { ...(state._dailyHistory || {}) };
      const prev = hist[today];
      const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
      hist[today] = {
        ...base,
        ids: [...new Set([...historyIds(prev), "nofap-checkin"])],
        xp: (base.xp || 0) + baseXp + bonusXp,
        hours: [...(base.hours || []), action.hour ?? new Date().getHours()],
        byCat: addCat(base.byCat || {}, "disciplina"),
      };

      const base2 = {
        ...state,
        player: {
          ...player,
          nofap: { ...nf, milestones, lastClaim: today, bestStreak },
        },
        _dailyHistory: hist,
      };
      const [finalS, newlyAch] = applyAchievements(base2, today);
      return [
        finalS,
        {
          xpGained: baseXp + bonusXp,
          statsGained: { SEN: 1 },
          levelsGained,
          spGained,
          spFromAch: achievementSpReward(newlyAch),
          achievementsGained: newlyAch,
          milestones: newMilestones,
          toast: newMilestones.length
            ? `Marco de disciplina: ${newMilestones
                .map((m) => `${m.title} (${m.days} dias) +${m.xp} XP`)
                .join(", ")}`
            : "Dia limpo registrado. +15 XP · +1 SEN",
        },
      ];
    }

    case "ORAL_BRUSH": {
      // Escovação padrão 3x ao dia (0=manhã, 1=tarde, 2=noite).
      // Cada escovação: +5 XP · +1 VIT. Dia 3/3: bônus +10 XP · +1 SEN.
      const today = todayStr();
      const oral = state.player.oral || {};
      const slots =
        oral.date === today
          ? [...(oral.slots || [false, false, false])]
          : [false, false, false]; // virou o dia → zera os slots
      const slot = Number(action.slot);
      if (![0, 1, 2].includes(slot) || slots[slot]) return [state, null];
      slots[slot] = true;
      const doneCount = slots.filter(Boolean).length;

      let player = {
        ...state.player,
        stats: { ...state.player.stats, VIT: (state.player.stats.VIT || 0) + 1 },
      };
      let levelsGained = 0;
      const r1 = applyXp(player, ORAL_XP);
      player = r1.player;
      levelsGained += r1.levelsGained;

      // bônus de fechar o dia (uma vez)
      let bonusXp = 0;
      let bonus = false;
      let fullDays = oral.fullDays || 0;
      let lastFullDate = oral.lastFullDate || null;
      if (doneCount === 3 && lastFullDate !== today) {
        bonus = true;
        bonusXp = ORAL_BONUS_XP;
        fullDays += 1;
        lastFullDate = today;
        player = {
          ...player,
          stats: { ...player.stats, SEN: (player.stats.SEN || 0) + 1 },
        };
        const r2 = applyXp(player, bonusXp);
        player = r2.player;
        levelsGained += r2.levelsGained;
      }

      const spGained = levelsGained * SP_PER_LEVEL;
      if (spGained > 0) {
        player = { ...player, sp: (player.sp || 0) + spGained };
      }

      // registro no histórico do dia (hábito + gráfico)
      const hist = { ...(state._dailyHistory || {}) };
      const prev = hist[today];
      const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
      hist[today] = {
        ...base,
        ids: [...new Set([...historyIds(prev), `oral-${slot}`])],
        xp: (base.xp || 0) + ORAL_XP + bonusXp,
        hours: [...(base.hours || []), action.hour ?? new Date().getHours()],
        byCat: addCat(base.byCat || {}, "habito"),
      };

      const base2 = {
        ...state,
        player: {
          ...player,
          oral: { date: today, slots, fullDays, lastFullDate },
        },
        _dailyHistory: hist,
      };
      const [finalS, newlyAch] = applyAchievements(base2, today);
      const label = ORAL_SLOTS[slot]?.label || `escovação ${slot + 1}`;
      return [
        finalS,
        {
          xpGained: ORAL_XP + bonusXp,
          statsGained: bonus ? { VIT: 1, SEN: 1 } : { VIT: 1 },
          levelsGained,
          spGained,
          spFromAch: achievementSpReward(newlyAch),
          achievementsGained: newlyAch,
          toast: bonus
            ? `Higiene completa: 3/3 escovações. +${ORAL_XP + bonusXp} XP · +1 VIT · +1 SEN`
            : `Escovação registrada (${label}). +${ORAL_XP} XP · +1 VIT`,
        },
      ];
    }

    case "NOFAP_RELAPSE": {
      const today = todayStr();
      const nf = state.player.nofap || {};
      const streak = nofapStreak(state, today);
      const bestStreak = Math.max(nf.bestStreak || 0, streak);
      return [
        {
          ...state,
          player: {
            ...state.player,
            nofap: {
              ...nf,
              lastRelapse: today,
              lastClaim: null,
              bestStreak,
            },
          },
        },
        { toast: "Recaída registrada. O contador zerou — recomece hoje." },
      ];
    }

    case "ADD_DUNGEON_PROGRESS": {
      const { id, amount } = action;
      const d = state.dungeons.find((x) => x.id === id);
      if (!d || d.completed || d.failed) return [state, null];
      const today = todayStr();
      const startedAt = d.startedAt || today;
      const deadline = addDaysStr(startedAt, d.deadlineDays);
      const failed = today > deadline;
      const progress = Math.min(d.goal, Math.max(0, d.progress + amount));
      const done = progress >= d.goal;
      return [
        {
          ...state,
          dungeons: state.dungeons.map((x) =>
            x.id === id
              ? {
                  ...x,
                  progress,
                  startedAt,
                  failed,
                  completed: done,
                  completedAt: done ? today : null,
                }
              : x
          ),
        },
        done
          ? { toast: `Dungeon concluída: ${d.title}. Reivindique a recompensa.` }
          : null,
      ];
    }

    case "CLAIM_DUNGEON": {
      const { id } = action;
      const d = state.dungeons.find((x) => x.id === id);
      // já reivindicada? não recompensa de novo
      if (!d || !d.completed || d.claimedAt) return [state, null];

      let reward = emptyReward();
      let s = state;
      let player = { ...s.player, stats: { ...s.player.stats } };
      for (const [k, v] of Object.entries(d.stats || {})) {
        player.stats[k] = (player.stats[k] || 0) + v;
      }
      reward.statsGained = mergeStats(reward.statsGained, d.stats || {});
      reward.xpGained += d.xp;
      const { player: p2, levelsGained } = applyXp(player, d.xp);
      reward.levelsGained += levelsGained;
      player = p2;

      const rewardTitle = d.rewardTitle || d.title;
      let titlesGained = [];
      if (rewardTitle && !player.titles.includes(rewardTitle)) {
        titlesGained = [rewardTitle];
        player = { ...player, titles: [...player.titles, rewardTitle] };
      }

      const rankBefore = rankForLevel(s.player.level).rank;
      const rankAfter = rankForLevel(player.level).rank;
      reward.rankBefore = rankBefore;
      reward.rankAfter = rankAfter;
      reward.fromLevel = s.player.level;
      reward.toLevel = player.level;
      reward.titlesGained = titlesGained;

      // ---- SP por level ganho ----
      const spGained = reward.levelsGained * SP_PER_LEVEL;
      if (spGained > 0) {
        player = { ...player, sp: (player.sp || 0) + spGained };
      }
      reward.spGained = spGained;

      s = {
        ...s,
        player,
        dungeons: s.dungeons.map((x) =>
          x.id === id ? { ...x, completed: true, claimedAt: todayStr() } : x
        ),
      };

      // ---- Registro diário: XP do resgate (alimenta o gráfico) ----
      {
        const hist = { ...(s._dailyHistory || {}) };
        const today = todayStr();
        const prev = hist[today];
        const base = prev && !Array.isArray(prev) ? prev : emptyDayRecord();
        hist[today] = {
          ...base,
          xp: (base.xp || 0) + reward.xpGained,
          hours: [...(base.hours || []), action.hour ?? new Date().getHours()],
          byCat: addCat(base.byCat || {}, d.category),
        };
        s = { ...s, _dailyHistory: hist };
      }

      // ---- Conquistas ----
      const [finalS, newlyAch] = applyAchievements(s, todayStr());
      reward.achievementsGained = newlyAch;
      reward.spFromAch = achievementSpReward(newlyAch);
      return [finalS, reward];
    }

    case "RESET_ALL": {
      return [defaultSave(), { toast: "Dados do sistema apagados." }];
    }

    default:
      return [state, null];
  }
}
