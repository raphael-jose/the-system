import { describe, it, expect, afterEach, vi } from "vitest";
import { defaultSave, migrate, reduce } from "./reducer";
import { todayStr, addDays } from "../utils/dates";

// Segunda-feira fixa para os testes (10/08/2026).
const MON = new Date(2026, 7, 10, 12, 0, 0);

function create(name = "Rapha") {
  return reduce(defaultSave(), { type: "CREATE_PLAYER", name })[0];
}

function complete(s, list, id) {
  return reduce(s, { type: "COMPLETE_MISSION", list, id });
}

const DAILY_IDS = [
  "d-cardio",
  "d-pushups",
  "d-squats",
  "d-abs",
  "d-water",
  "d-sleep",
  "d-study",
  "d-meditate",
];

function completeAllDailies(s) {
  let cur = s;
  for (const id of DAILY_IDS) {
    cur = complete(cur, "daily", id)[0];
  }
  return cur;
}

function advance(days) {
  vi.setSystemTime(new Date(MON.getTime() + days * 86400000));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("criação", () => {
  it("cria o save padrão com seed completo", () => {
    const s = create("Rapha");
    expect(s.player.name).toBe("Rapha");
    expect(s.player.level).toBe(1);
    expect(s.player.xp).toBe(0);
    expect(s.player.streak).toBe(0);
    expect(s.player.stats).toEqual({
      FOR: 10,
      AGI: 10,
      VIT: 10,
      INT: 10,
      PER: 10,
      SEN: 10,
    });
    expect(s.dailyMissions).toHaveLength(9);
    expect(s.weeklyMissions).toHaveLength(4);
    expect(s.dungeons).toHaveLength(3);
    expect(s.lastDailyReset).toBe(todayStr());
  });

  it("migra saves antigos sem perder dados", () => {
    const old = {
      player: { name: "X", level: 3, xp: 50, stats: { FOR: 15 } },
      dailyMissions: [],
      weeklyMissions: [],
      dungeons: [],
    };
    const m = migrate(old);
    expect(m.player.name).toBe("X");
    expect(m.player.level).toBe(3);
    expect(m.player.stats.FOR).toBe(15);
    expect(m.player.stats.AGI).toBe(10); // padrão preservado
    expect(m.dailyMissions).toHaveLength(9); // seed re-adicionado
    expect(m._fullDailyDays).toEqual([]);
  });

  it("exercícios em ordem cronológica do dia, com abdominal e imagens", () => {
    const s = create();
    const exIds = s.dailyMissions
      .filter((m) => m.exercise?.image)
      .map((m) => m.id);
    // cronologia: manhã (cardio) → tarde (força + abdominal)
    expect(exIds).toEqual(["d-cardio", "d-pushups", "d-squats", "d-abs"]);

    const abs = s.dailyMissions.find((m) => m.id === "d-abs");
    expect(abs.title).toContain("Abdominais");
    expect(abs.category).toBe("treino");
    expect(abs.timeOfDay).toBe("tarde");
    expect(abs.training).toEqual({ type: "reps", sets: 3, reps: 10 });
    expect(abs.exercise.image).toBe("exercises/situp-34.jpg");
    expect(abs.exercise.type).toBe("abs");
    expect(abs.stats).toEqual({ FOR: 2, VIT: 1 });

    // toda missão de exercício tem imagem de referência + horário do dia
    for (const m of s.dailyMissions.filter((x) => x.exercise?.image)) {
      expect(m.exercise.image).toMatch(/^exercises\/.+\.jpg$/);
      expect(m.timeLabel).toBeTruthy();
    }
  });
});

describe("missões diárias", () => {
  it("completa uma diária: XP, atributos, streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const [s, r] = complete(create(), "daily", "d-pushups");
    expect(r.xpGained).toBe(20);
    expect(s.player.stats.FOR).toBe(13);
    expect(s.player.streak).toBe(1);
    expect(s.player.totalMissionsCompleted).toBe(1);
    expect(s.player.level).toBe(1); // 20xp < 100
    expect(s.dailyMissions.find((m) => m.id === "d-pushups").completed).toBe(true);
  });

  it("não deixa completar duas vezes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const s1 = complete(create(), "daily", "d-pushups")[0];
    const [s2, r2] = complete(s1, "daily", "d-pushups");
    expect(r2).toBeNull();
    expect(s2.player.xp).toBe(20);
    expect(s2.player.totalMissionsCompleted).toBe(1);
  });

  it("bônus automático ao fechar o dia + level up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const [s, r] = reduce(create(), {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-meditate",
    });
    // completa só a última → não fecha o dia
    expect(s.dailyMissions.find((m) => m.id === "d-all").completed).toBe(false);

    const full = completeAllDailies(create());
    expect(full.dailyMissions.find((m) => m.id === "d-all").completed).toBe(true);
    expect(full._fullDailyDays).toContain(todayStr());
    // 8 diárias = 155 XP + bônus 50 = 205 XP → level 2, sobra 105
    expect(full.player.level).toBe(2);
    expect(full.player.xp).toBe(105);
    expect(full.player.stats.SEN).toBe(11); // +1 do bônus de dia completo
  });
});

describe("streak e reset", () => {
  it("mantém streak entre dias e quebra após 2 dias sem atividade", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);

    let s = completeAllDailies(create());
    expect(s.player.streak).toBe(1);

    advance(1);
    s = reduce(s, { type: "TICK" })[0];
    expect(s.player.streak).toBe(1); // ontem teve atividade → mantém
    expect(s.dailyMissions.every((m) => !m.completed)).toBe(true); // reset diário
    s = completeAllDailies(s);
    expect(s.player.streak).toBe(2);

    // pula 3 dias (seg, ter, qua sem atividade) → quinta
    advance(4);
    const [s2, r] = reduce(s, { type: "TICK" });
    expect(s2.player.streak).toBe(0);
    expect(r.toast).toContain("Streak perdido");
  });

  it("bônus de streak: 3 dias = +10%", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    for (let day = 0; day < 3; day++) {
      if (day > 0) {
        advance(day);
        s = reduce(s, { type: "TICK" })[0];
      }
      const [, r] = complete(s, "daily", "d-pushups");
      s = completeAllDailies(s);
      if (day === 0) expect(r.xpGained).toBe(20);
      if (day === 2) {
        expect(s.player.streak).toBe(3);
      }
    }
    // day 4: mult 1.1
    advance(3);
    s = reduce(s, { type: "TICK" })[0];
    const [, r4] = complete(s, "daily", "d-pushups");
    expect(r4.xpGained).toBe(22); // round(20 * 1.1)
  });

  it("reset semanal na segunda-feira", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    // semanais resetam e ganham progresso
    s = complete(s, "daily", "d-study")[0];
    expect(s.weeklyMissions.find((w) => w.id === "w-reading").progress).toBe(20);

    // avança para a próxima segunda
    advance(7);
    s = reduce(s, { type: "TICK" })[0];
    expect(s.lastWeeklyReset).toBe(todayStr());
    expect(s.weeklyMissions.every((w) => w.progress === 0)).toBe(true);
    expect(s.weeklyMissions.every((w) => !w.completed)).toBe(true);
  });
});

describe("missões semanais", () => {
  it("5 treinos em dias diferentes completam w-trainings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    for (let day = 0; day < 5; day++) {
      if (day > 0) {
        advance(day);
        s = reduce(s, { type: "TICK" })[0];
      }
      s = complete(s, "daily", "d-pushups")[0];
      const w = s.weeklyMissions.find((x) => x.id === "w-trainings");
      if (day < 4) {
        expect(w.progress).toBe(day + 1);
        expect(w.completed).toBe(false);
      }
    }
    expect(s.weeklyMissions.find((w) => w.id === "w-trainings").completed).toBe(
      true
    );
  });

  it("fechar o dia 4 vezes completa w-all-daily", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    let weeklyCompleted = false;
    for (let day = 0; day < 5; day++) {
      if (day > 0) {
        advance(day);
        s = reduce(s, { type: "TICK" })[0];
      }
      s = completeAllDailies(s);
      const w = s.weeklyMissions.find((x) => x.id === "w-all-daily");
      if (w.completed) weeklyCompleted = true;
    }
    expect(weeklyCompleted).toBe(true);
    expect(s.weeklyMissions.find((x) => x.id === "w-all-daily").completed).toBe(
      true
    );
  });
});

describe("dungeons", () => {
  it("progresso manual + reivindicação com título", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const [s1, r1] = reduce(s, {
      type: "ADD_DUNGEON_PROGRESS",
      id: "dg-pushups",
      amount: 500,
    });
    expect(s1.dungeons.find((d) => d.id === "dg-pushups").progress).toBe(500);
    expect(r1).toBeNull();

    const [s2, r2] = reduce(s1, {
      type: "ADD_DUNGEON_PROGRESS",
      id: "dg-pushups",
      amount: 600,
    });
    expect(s2.dungeons.find((d) => d.id === "dg-pushups").completed).toBe(true);
    expect(r2.toast).toContain("Dungeon concluída");

    const [s3, r3] = reduce(s2, { type: "CLAIM_DUNGEON", id: "dg-pushups" });
    expect(r3.xpGained).toBe(500);
    expect(r3.titlesGained).toEqual(["Punhos de Ferro"]);
    expect(s3.player.stats.FOR).toBe(25);
    expect(s3.player.titles).toContain("Punhos de Ferro");
    expect(s3.dungeons.find((d) => d.id === "dg-pushups").claimedAt).toBeTruthy();

    // não pode reivindicar de novo
    const [, r4] = reduce(s3, { type: "CLAIM_DUNGEON", id: "dg-pushups" });
    expect(r4).toBeNull();
  });

  it("dungeon falha quando o prazo expira", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    // iniciou há 40 dias (prazo 30) sem terminar
    const dungeon = s.dungeons.find((d) => d.id === "dg-mind");
    dungeon.startedAt = addDays(todayStr(), -40);
    const [s2] = reduce(s, {
      type: "ADD_DUNGEON_PROGRESS",
      id: "dg-mind",
      amount: 1,
    });
    expect(s2.dungeons.find((d) => d.id === "dg-mind").failed).toBe(true);
    expect(s2.dungeons.find((d) => d.id === "dg-mind").completed).toBe(false);
  });
});

describe("rank e perfil", () => {
  it("sobe de rank E para D ao cruzar o nível 10", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    // completa a dungeon de flexões (500xp) partindo de 400xp no nível 9
    s.player.level = 9;
    s.player.xp = 400;
    s = reduce(s, { type: "ADD_DUNGEON_PROGRESS", id: "dg-pushups", amount: 1000 })[0];
    const [, r] = reduce(s, { type: "CLAIM_DUNGEON", id: "dg-pushups" });
    expect(r.levelsGained).toBe(1);
    expect(r.rankBefore).toBe("E");
    expect(r.rankAfter).toBe("D");
    expect(r.fromLevel).toBe(9);
    expect(r.toLevel).toBe(10);
  });

  it("altera nome e alterna notificações", () => {
    const s = create();
    const [s2] = reduce(s, { type: "SET_NAME", name: "  Jin-Woo  " });
    expect(s2.player.name).toBe("Jin-Woo");
    const [s3] = reduce(s2, { type: "TOGGLE_NOTIFICATIONS" });
    expect(s3.player.notifications).toBe(true);
    const [s4, r] = reduce(s3, { type: "TOGGLE_NOTIFICATIONS" });
    expect(s4.player.notifications).toBe(false);
    expect(r.toast).toBeTruthy();
  });

  it("reset total volta ao estado inicial", () => {
    const s = completeAllDailies(create());
    const [s2] = reduce(s, { type: "RESET_ALL" });
    expect(s2.player.name).toBe("");
    expect(s2.player.level).toBe(1);
    expect(s2.player.titles).toEqual([]);
    expect(s2.player.sp).toBe(0);
  });
});

describe("SP (pontos de atributo)", () => {
  it("ganha 3 SP por level e distribui manualmente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    // sobe de level com UMA missão (sem disparar Sobrecarga) → exatamente 3 SP
    let s = create();
    s.player.xp = 90;
    const [s1, r1] = complete(s, "daily", "d-pushups"); // +20 XP → level 2
    expect(r1.levelsGained).toBe(1);
    expect(s1.player.level).toBe(2);
    expect(s1.player.sp).toBe(3); // 1 level × 3

    const [s2] = reduce(s1, { type: "ADD_STAT_POINT", stat: "FOR" });
    expect(s2.player.sp).toBe(2);
    expect(s2.player.stats.FOR).toBe(14); // 13 (flexão) + 1 SP

    const [s3] = reduce(s2, { type: "ADD_STAT_POINT", stat: "FOR" });
    const [s4] = reduce(s3, { type: "ADD_STAT_POINT", stat: "FOR" });
    const [s5] = reduce(s4, { type: "ADD_STAT_POINT", stat: "FOR" });
    expect(s5.player.sp).toBe(0);

    // sem SP → no-op
    const [s6, r6] = reduce(s5, { type: "ADD_STAT_POINT", stat: "FOR" });
    expect(r6).toBeNull();
    expect(s6.player.stats.FOR).toBe(16);

    // atributo inválido → no-op
    const [s7, r7] = reduce(s5, { type: "ADD_STAT_POINT", stat: "XYZ" });
    expect(r7).toBeNull();
    expect(s7.player.sp).toBe(0);
  });

  it("dungeon que sobe 2 níveis concede 6 SP", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s.player.level = 9;
    s.player.xp = 400;
    s = reduce(s, { type: "ADD_DUNGEON_PROGRESS", id: "dg-pushups", amount: 1000 })[0];
    const [, r] = reduce(s, { type: "CLAIM_DUNGEON", id: "dg-pushups" });
    expect(r.levelsGained).toBe(1);
    expect(r.spGained).toBe(3);
  });

  it("distribuição automática gasta tudo nos atributos mais fracos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    // dia completo → level 2 → 3 SP; atributos: FOR 17, AGI 14, VIT 16,
    // INT 13, PER 12, SEN 11 → mais fracos: SEN, PER (empate pela ordem)
    const full = completeAllDailies(create());
    expect(full.player.sp).toBe(3);
    const [s2, r] = reduce(full, { type: "AUTO_DISTRIBUTE_SP" });
    expect(r.spAllocated).toEqual({ SEN: 2, PER: 1 });
    expect(s2.player.sp).toBe(0);
    expect(s2.player.spAllocated).toBe(3);
    expect(s2.player.stats.SEN).toBe(13);
    expect(s2.player.stats.PER).toBe(13);
    expect(s2.player.stats.INT).toBe(13);
    // sem SP → no-op
    const [s3, r3] = reduce(s2, { type: "AUTO_DISTRIBUTE_SP" });
    expect(r3).toBeNull();
    expect(s3.player.stats.SEN).toBe(13);
  });
});

describe("backup e importação", () => {
  it("importa um save válido e rejeita inválido", () => {
    const s = create();
    const backup = completeAllDailies(s);
    const [imported, r] = reduce(create(), { type: "IMPORT", save: backup });
    expect(r.toast).toContain("importados");
    expect(imported.player.level).toBe(2);
    expect(imported.player.name).toBe("Rapha");
    expect(imported._dailyHistory).toBeTruthy();

    const [s2, r2] = reduce(create(), { type: "IMPORT", save: { foo: 1 } });
    expect(r2.toast).toContain("inválido");
    expect(s2.player.level).toBe(1);
  });
});

describe("histórico de sessão", () => {
  it("registra XP, categoria e horário por dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const [s1] = reduce(s, {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-pushups",
      hour: 19,
    });
    const rec = s1._dailyHistory[todayStr()];
    expect(rec.ids).toContain("d-pushups");
    expect(rec.xp).toBe(20);
    expect(rec.byCat.treino).toBe(1);
    expect(rec.hours).toEqual([19]);

    const [s2] = reduce(s1, {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-study",
      hour: 20,
    });
    const rec2 = s2._dailyHistory[todayStr()];
    expect(rec2.xp).toBe(40);
    expect(rec2.byCat).toEqual({ treino: 1, estudo: 1 });
    expect(rec2.hours).toEqual([19, 20]);
  });

  it("fechar o dia soma o bônus ao registro", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const full = completeAllDailies(create());
    // 8 diárias = 155 XP + bônus 50 = 205, 9 ids (inclui o bônus d-all)
    const rec = full._dailyHistory[todayStr()];
    expect(rec.xp).toBe(205);
    expect(rec.ids).toHaveLength(9);
    expect(rec.ids).toContain("d-all");
    expect(rec.byCat.disciplina).toBe(1); // só o bônus d-all
  });

  it("registra sessão de treino guiado com duração e séries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const [s1] = reduce(s, {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-pushups",
      hour: 19,
      session: { sec: 540, sets: 3 },
    });
    const rec = s1._dailyHistory[todayStr()];
    expect(rec.sessions).toEqual([
      { title: "30 Flexões", sec: 540, sets: 3 },
    ]);

    // sem session (checkbox comum) não cria sessão e preserva as anteriores
    const [s2] = reduce(s1, {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-study",
      hour: 20,
    });
    const rec2 = s2._dailyHistory[todayStr()];
    expect(rec2.sessions).toHaveLength(1);
    expect(rec2.xp).toBe(40); // recompensas normais seguem somando

    // duas sessões no mesmo dia acumulam
    const [s3] = reduce(s2, {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-squats",
      hour: 21,
      session: { sec: 900, sets: 5 },
    });
    const rec3 = s3._dailyHistory[todayStr()];
    expect(rec3.sessions).toHaveLength(2);
    expect(rec3.sessions[1].sec).toBe(900);
    expect(rec3.sessions[1].title).toBe("50 Agachamentos");
  });

  it("sanitiza sessão inválida (sec/sets fora do padrão)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const [s1] = reduce(create(), {
      type: "COMPLETE_MISSION",
      list: "daily",
      id: "d-cardio",
      hour: 19,
      session: { sec: -50, sets: 0 },
    });
    const rec = s1._dailyHistory[todayStr()];
    expect(rec.sessions[0].sec).toBe(0);
    expect(rec.sessions[0].sets).toBe(1);
  });

  it("resgate de dungeon soma o XP ao dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s = reduce(s, { type: "ADD_DUNGEON_PROGRESS", id: "dg-pushups", amount: 1000 })[0];
    const [s2] = reduce(s, {
      type: "CLAIM_DUNGEON",
      id: "dg-pushups",
      hour: 21,
    });
    const rec = s2._dailyHistory[todayStr()];
    expect(rec.xp).toBe(500);
    expect(rec.byCat.treino).toBe(1);
    expect(rec.hours).toEqual([21]);
  });

  it("migra histórico antigo (array de ids) para o novo formato", () => {
    const old = {
      _dailyHistory: { "2026-08-10": ["d-pushups", "d-squats"] },
    };
    const m = migrate(old);
    expect(m._dailyHistory["2026-08-10"]).toEqual({
      ids: ["d-pushups", "d-squats"],
      xp: 0,
      hours: [],
      byCat: {},
      sessions: [],
      walks: [],
    });
  });

  it("ids no novo formato continuam alimentando w-trainings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    for (let day = 0; day < 5; day++) {
      if (day > 0) {
        advance(day);
        s = reduce(s, { type: "TICK" })[0];
      }
      s = reduce(s, {
        type: "COMPLETE_MISSION",
        list: "daily",
        id: "d-pushups",
      })[0];
    }
    expect(s.weeklyMissions.find((w) => w.id === "w-trainings").completed).toBe(
      true
    );
  });
});

describe("conquistas (achievements)", () => {
  it("primeira missão, primeiro level e dia perfeito", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const [, r1] = complete(create(), "daily", "d-pushups");
    expect(r1.achievementsGained).toContain("first-mission");

    let s = create();
    const gained = new Set();
    for (const id of DAILY_IDS) {
      const [ns, r] = complete(s, "daily", id);
      s = ns;
      (r?.achievementsGained || []).forEach((a) => gained.add(a));
    }
    expect([...gained]).toEqual(
      expect.arrayContaining(["first-mission", "first-level", "day-complete"])
    );
    const ids = s.achievements.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(["first-mission", "first-level", "day-complete"])
    );
    expect(s.achievements.find((a) => a.id === "first-level").unlockedAt).toBe(
      todayStr()
    );
  });

  it("rank D, nível 10 e primeira dungeon desbloqueiam juntos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s.player.level = 9;
    s.player.xp = 400;
    s = reduce(s, {
      type: "ADD_DUNGEON_PROGRESS",
      id: "dg-pushups",
      amount: 1000,
    })[0];
    const [, r] = reduce(s, { type: "CLAIM_DUNGEON", id: "dg-pushups" });
    expect(r.achievementsGained).toEqual(
      expect.arrayContaining(["rank-d", "level-10", "first-dungeon"])
    );
  });

  it("sequência de 7 dias desbloqueia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    let last = null;
    for (let day = 0; day < 7; day++) {
      if (day > 0) {
        advance(day);
        s = reduce(s, { type: "TICK" })[0];
      }
      const [ns, r] = complete(s, "daily", "d-pushups");
      s = ns;
      last = r;
    }
    expect(last.achievementsGained).toContain("streak-7");
  });

  it("10 missões em um dia (semanais auto-completas entram no registro)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    // w-streak: streak 6 + atividade ontem → primeira conclusão vira 7
    s.player.streak = 6;
    s.player.lastActivityDate = addDays(todayStr(), -1);
    // w-reading a um passo de completar
    s.weeklyMissions = s.weeklyMissions.map((w) =>
      w.id === "w-reading" ? { ...w, progress: 100 } : w
    );
    // w-trainings: 4 dias de treino na semana corrente
    s._dailyHistory = [1, 2, 3, 4].reduce((acc, d) => {
      acc[addDays(todayStr(), d)] = {
        ids: ["d-pushups"],
        xp: 20,
        hours: [19],
        byCat: { treino: 1 },
      };
      return acc;
    }, {});
    // w-all-daily: 4 dias fechados na semana
    s._fullDailyDays = [1, 2, 3, 4].map((d) => addDays(todayStr(), d));

    let cur = s;
    const gained = new Set();
    let spFromAch = 0;
    for (const id of DAILY_IDS) {
      const [ns, r] = reduce(cur, {
        type: "COMPLETE_MISSION",
        list: "daily",
        id,
      });
      cur = ns;
      if (r?.achievementsGained?.includes("day-full-10")) {
        spFromAch = r.spFromAch;
      }
      (r?.achievementsGained || []).forEach((a) => gained.add(a));
    }
    // 9 diárias + bônus d-all + 4 semanais = 14 ids no dia
    expect(cur._dailyHistory[todayStr()].ids.length).toBeGreaterThanOrEqual(10);
    expect(cur.weeklyMissions.filter((w) => w.completed)).toHaveLength(4);
    expect(cur.achievements.map((a) => a.id)).toContain("day-full-10");
    expect([...gained]).toContain("day-full-10");
    // recompensa épica: +5 SP bônus no desbloqueio
    expect(spFromAch).toBe(5);
    expect(cur.player.sp).toBeGreaterThanOrEqual(5);
  });

  it("Mês de Aço (streak 30) concede +10 SP bônus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s.player.streak = 30;
    s.player.lastActivityDate = addDays(todayStr(), -1);
    s.achievements = [{ id: "streak-7", unlockedAt: "2026-08-01" }];
    const [s2, r] = complete(s, "daily", "d-pushups");
    expect(r.achievementsGained).toContain("streak-30");
    expect(r.spFromAch).toBe(10);
    // a semanal w-streak também auto-completa (+300 XP → 2 level-ups)
    expect(r.levelsGained).toBe(2);
    // SP = levels (2×3) + bônus da conquista (10)
    expect(s2.player.sp).toBe(r.levelsGained * 3 + 10);
    expect(
      s2.achievements.find((a) => a.id === "streak-30").unlockedAt
    ).toBe(todayStr());
  });

  it("preferência de treino imersivo persiste e valida", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const s = create();
    expect(s.player.trainingImmersive).toBe(false);

    const [s1, r1] = reduce(s, { type: "SET_TRAINING_IMMERSIVE", value: true });
    expect(s1.player.trainingImmersive).toBe(true);
    expect(r1.toast).toContain("imersivo");

    const [s2, r2] = reduce(s1, { type: "SET_TRAINING_IMMERSIVE", value: true });
    expect(r2).toBeNull(); // mesmo valor: no-op
    expect(s2).toBe(s1);

    const [s3] = reduce(s2, { type: "SET_TRAINING_IMMERSIVE", value: false });
    expect(s3.player.trainingImmersive).toBe(false);

    // migração preserva o valor
    const m = migrate({ player: { name: "X", trainingImmersive: true } });
    expect(m.player.trainingImmersive).toBe(true);
  });

  it("distribuir SP desbloqueia a conquista de distribuição", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const full = completeAllDailies(create()); // nível 2 → 3 SP
    const [s2, r] = reduce(full, { type: "ADD_STAT_POINT", stat: "FOR" });
    expect(r.achievementsGained).toContain("first-sp");
    expect(s2.player.spAllocated).toBe(1);
  });

  it("migra sem conquistas e preserva as existentes", () => {
    const m = migrate({ player: { name: "X" } });
    expect(m.achievements).toEqual([]);
    expect(m.player.spAllocated).toBe(0);
    const m2 = migrate({
      player: { name: "X" },
      achievements: [{ id: "first-mission", unlockedAt: "2026-08-01" }],
    });
    expect(m2.achievements).toHaveLength(1);
    expect(m2.achievements[0].id).toBe("first-mission");
  });
});

describe("disciplina (NoFap)", () => {
  it("check-in registra o dia: +15 XP, +1 SEN, histórico e uma vez por dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const [s1, r] = reduce(s, { type: "NOFAP_CHECKIN", hour: 20 });
    expect(r.xpGained).toBe(15);
    expect(r.statsGained).toEqual({ SEN: 1 });
    expect(s1.player.stats.SEN).toBe(11);
    expect(s1.player.nofap.lastClaim).toBe(todayStr());
    const rec = s1._dailyHistory[todayStr()];
    expect(rec.ids).toContain("nofap-checkin");
    expect(rec.byCat.disciplina).toBe(1);
    expect(rec.xp).toBe(15);

    // segunda tentativa no mesmo dia: no-op
    const [s2, r2] = reduce(s1, { type: "NOFAP_CHECKIN" });
    expect(r2).toBeNull();
    expect(s2).toBe(s1);
  });

  it("cruzar 7 dias limpos reivindica o marco Barreira (+50 XP)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s.createdAt = addDays(todayStr(), -7); // streak 7
    const [s1, r] = reduce(s, { type: "NOFAP_CHECKIN" });
    expect(r.xpGained).toBe(15 + 50);
    expect(r.milestones.map((m) => m.days)).toEqual([7]);
    expect(s1.player.nofap.milestones).toContain(7);

    // marco não reivindica de novo
    const s3 = {
      ...s1,
      player: { ...s1.player, nofap: { ...s1.player.nofap, lastClaim: null } },
    };
    const [s4, r4] = reduce(s3, { type: "NOFAP_CHECKIN" });
    expect(r4.milestones).toEqual([]);
    expect(r4.xpGained).toBe(15);
    expect(s4.player.nofap.milestones).toHaveLength(1);
  });

  it("recaída zera o contador e fixa o recorde", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s.createdAt = addDays(todayStr(), -5); // streak 5
    const [s1, r] = reduce(s, { type: "NOFAP_RELAPSE" });
    expect(r.toast).toContain("Recaída");
    expect(s1.player.nofap.lastRelapse).toBe(todayStr());
    expect(s1.player.nofap.bestStreak).toBe(5);
    expect(s1.player.nofap.lastClaim).toBeNull();
  });
});

describe("caminhada (pedômetro + GPS)", () => {
  it("registra passos, km, duração e rota no dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const [s1, r] = reduce(s, {
      type: "SAVE_WALK",
      sec: 720,
      steps: 2450,
      km: 1.83,
      route: [
        [-23.55, -46.63],
        [-23.551, -46.63],
        [-23.552, -46.63],
      ],
    });
    expect(r.toast).toContain("2.450 passos");
    const rec = s1._dailyHistory[todayStr()];
    expect(rec.walks).toHaveLength(1);
    expect(rec.walks[0]).toMatchObject({
      title: "Caminhada",
      sec: 720,
      steps: 2450,
      km: 1.83,
    });
    expect(rec.walks[0].route).toHaveLength(3);
  });

  it("sanitiza valores inválidos e limita a rota a 500 pontos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const longRoute = Array.from({ length: 700 }, (_, i) => [-23.5, -46.6 + i / 100000]);
    const [s1] = reduce(s, {
      type: "SAVE_WALK",
      sec: -10,
      steps: "abc",
      km: 2,
      route: [...longRoute, [null, 1], [1], "x"],
    });
    const w = s1._dailyHistory[todayStr()].walks[0];
    expect(w.sec).toBe(0);
    expect(w.steps).toBe(0);
    expect(w.km).toBe(2);
    expect(w.route).toHaveLength(500);
  });

  it("acumula caminhadas no mesmo dia e ignora sessão vazia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s = reduce(s, { type: "SAVE_WALK", sec: 300, steps: 500, km: 0.4 })[0];
    s = reduce(s, { type: "SAVE_WALK", sec: 400, steps: 800, km: 0.6 })[0];
    expect(s._dailyHistory[todayStr()].walks).toHaveLength(2);

    const [s2, r2] = reduce(s, { type: "SAVE_WALK", sec: 0, steps: 0, km: 0 });
    expect(r2).toBeNull();
    expect(s2._dailyHistory[todayStr()].walks).toHaveLength(2);
  });
});

describe("higiene bucal (escovação 3x ao dia)", () => {
  it("cada escovação: +5 XP, +1 VIT, histórico e uma vez por slot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    const [s1, r] = reduce(s, { type: "ORAL_BRUSH", slot: 0, hour: 8 });
    expect(r.xpGained).toBe(5);
    expect(r.statsGained).toEqual({ VIT: 1 });
    expect(s1.player.stats.VIT).toBe(11);
    expect(s1.player.oral.slots).toEqual([true, false, false]);
    const rec = s1._dailyHistory[todayStr()];
    expect(rec.ids).toContain("oral-0");
    expect(rec.byCat.habito).toBe(1);
    expect(rec.xp).toBe(5);

    // mesmo slot de novo: no-op
    const [s2, r2] = reduce(s1, { type: "ORAL_BRUSH", slot: 0 });
    expect(r2).toBeNull();
    expect(s2).toBe(s1);

    // slot inválido: no-op
    const [s3, r3] = reduce(s1, { type: "ORAL_BRUSH", slot: 9 });
    expect(r3).toBeNull();
    expect(s3).toBe(s1);
  });

  it("3/3 no dia concede o bônus +10 XP e +1 SEN", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    let total = 0;
    for (const slot of [0, 1, 2]) {
      const [ns, r] = reduce(s, { type: "ORAL_BRUSH", slot });
      s = ns;
      total += r.xpGained;
    }
    expect(total).toBe(5 + 5 + 15); // 2 escovações + última com bônus
    expect(s.player.oral.slots).toEqual([true, true, true]);
    expect(s.player.oral.fullDays).toBe(1);
    expect(s.player.stats.SEN).toBe(11);

    // dia seguinte: slots zeram e o 3/3 conta de novo
    advance(1);
    let total2 = 0;
    for (const slot of [0, 1, 2]) {
      const [ns, r] = reduce(s, { type: "ORAL_BRUSH", slot });
      s = ns;
      total2 += r.xpGained;
    }
    expect(total2).toBe(25);
    expect(s.player.oral.date).toBe(todayStr());
    expect(s.player.oral.fullDays).toBe(2);
  });
});

describe("dungeons expiradas", () => {
  it("marca como falha no TICK quando o prazo passa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    s = reduce(s, { type: "ADD_DUNGEON_PROGRESS", id: "dg-pushups", amount: 1 })[0];
    // avança 31 dias
    advance(31);
    const [s2, r] = reduce(s, { type: "TICK" });
    const d = s2.dungeons.find((x) => x.id === "dg-pushups");
    expect(d.failed).toBe(true);
    expect(d.completed).toBe(false);
    expect(Array.isArray(r.toast) || typeof r.toast === "string").toBe(true);
    expect(JSON.stringify(r.toast)).toContain("Dungeon");
  });
});

describe("recompensas semanais", () => {
  it("registra weeklyCompleted no reward ao auto-completar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    let s = create();
    let finalReward = null;
    for (let day = 0; day < 5; day++) {
      if (day > 0) {
        advance(day);
        s = reduce(s, { type: "TICK" })[0];
      }
      const [, r] = complete(s, "daily", "d-pushups");
      s = complete(s, "daily", "d-pushups")[0];
      if (r) finalReward = r;
    }
    expect(s.weeklyMissions.find((w) => w.id === "w-trainings").completed).toBe(
      true
    );
    expect(finalReward.weeklyCompleted).toContain("5 Treinos na Semana");
  });
});

describe("configurações", () => {
  it("campos padrão de notificação e som", () => {
    const s = create();
    expect(s.player.notifTime).toBe("20:00");
    expect(s.player.notifLastFired).toBe("");
    expect(s.player.notifNoon).toBe(false);
    expect(s.player.notifNoonFired).toBe("");
    expect(s.player.soundOn).toBe(true);

    const [s2] = reduce(s, { type: "SET_NOTIF_TIME", time: "07:30" });
    expect(s2.player.notifTime).toBe("07:30");

    const [s3] = reduce(s2, { type: "TOGGLE_SOUND" });
    expect(s3.player.soundOn).toBe(false);

    const [s4] = reduce(s3, { type: "MARK_NOTIF_FIRED" });
    expect(s4.player.notifLastFired).toBe(todayStr());
  });

  it("som de notificação: padrão chime, aceita os 3 tons e rejeita inválido", () => {
    const s = create();
    expect(s.player.notifSound).toBe("chime");

    const [s2, r2] = reduce(s, { type: "SET_NOTIF_SOUND", sound: "alarm" });
    expect(s2.player.notifSound).toBe("alarm");
    expect(r2.toast).toContain("alarm");

    const [s3, r3] = reduce(s2, { type: "SET_NOTIF_SOUND", sound: "xyz" });
    expect(r3).toBeNull();
    expect(s3.player.notifSound).toBe("alarm");

    const [s4] = reduce(s3, { type: "SET_NOTIF_SOUND", sound: "beep" });
    expect(s4.player.notifSound).toBe("beep");

    // migração preserva o valor escolhido
    const m = migrate({ player: { name: "X", notifSound: "beep" } });
    expect(m.player.notifSound).toBe("beep");
  });

  it("resumo do meio-dia: toggle e marca como enviado uma vez por dia", () => {
    const s = create();
    const [s2, r2] = reduce(s, { type: "TOGGLE_NOON_NOTIF" });
    expect(s2.player.notifNoon).toBe(true);
    expect(r2.toast).toContain("meio-dia");

    const [s3] = reduce(s2, { type: "MARK_NOON_FIRED" });
    expect(s3.player.notifNoonFired).toBe(todayStr());

    const [s4, r4] = reduce(s3, { type: "TOGGLE_NOON_NOTIF" });
    expect(s4.player.notifNoon).toBe(false);
    expect(r4.toast).toContain("desativado");
    // o flag de envio do dia não muda ao desligar
    expect(s4.player.notifNoonFired).toBe(todayStr());
  });

  it("descanso padrão do treino é 45s e aceita 30/45/60", () => {
    const s = create();
    expect(s.player.restSec).toBe(45);
    const [s2] = reduce(s, { type: "SET_REST_SEC", sec: 60 });
    expect(s2.player.restSec).toBe(60);
    const [s3] = reduce(s2, { type: "SET_REST_SEC", sec: 30 });
    expect(s3.player.restSec).toBe(30);
    // inválido → no-op
    const [s4, r4] = reduce(s3, { type: "SET_REST_SEC", sec: 20 });
    expect(r4).toBeNull();
    expect(s4.player.restSec).toBe(30);
  });

  it("alerta de dungeon: toggle, dias válidos e log de avisos", () => {
    const s = create();
    expect(s.player.notifDungeon).toBe(false);
    expect(s.player.notifDungeonDays).toBe(2);
    expect(s._notifLog).toEqual({});

    const [s2] = reduce(s, { type: "TOGGLE_DUNGEON_NOTIF" });
    expect(s2.player.notifDungeon).toBe(true);

    const [s3] = reduce(s2, { type: "SET_DUNGEON_NOTIF_DAYS", days: 3 });
    expect(s3.player.notifDungeonDays).toBe(3);
    const [s4, r4] = reduce(s3, { type: "SET_DUNGEON_NOTIF_DAYS", days: 5 });
    expect(r4).toBeNull();
    expect(s4.player.notifDungeonDays).toBe(3);

    const [s5] = reduce(s4, { type: "MARK_DUNGEON_NOTIFIED", id: "dg-pushups" });
    expect(s5._notifLog[todayStr()].dungeons).toEqual(["dg-pushups"]);
    // não duplica no mesmo dia
    const [s6] = reduce(s5, { type: "MARK_DUNGEON_NOTIFIED", id: "dg-pushups" });
    expect(s6._notifLog[todayStr()].dungeons).toEqual(["dg-pushups"]);
  });

  it("migra sem log de notificações", () => {
    const m = migrate({ player: { name: "X" } });
    expect(m._notifLog).toEqual({});
    expect(m.player.notifDungeon).toBe(false);
    expect(m.player.notifDungeonDays).toBe(2);
  });
});
