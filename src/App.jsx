import { useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./hooks/useGame.jsx";
import { todayStr, msUntilMidnight } from "./utils/dates";
import {
  playNotifySound,
  playSound,
  setSoundEnabled,
} from "./utils/sound";
import { setVoiceEnabled } from "./utils/voice";
import { dungeonsExpiring, noonSummary, sendNotification, weeklySummary } from "./utils/notify";
import { patternSentence, encouragementMessage } from "./utils/history";
import { ACHIEVEMENTS } from "./data/achievements";
import BottomNav from "./components/BottomNav";
import LevelUpModal from "./components/LevelUpModal";
import AchievementModal from "./components/AchievementModal";
import Toast from "./components/Toast";
import CharacterCreation from "./screens/CharacterCreation";
import StatusScreen from "./screens/StatusScreen";
import MissionsScreen from "./screens/MissionsScreen";
import DungeonsScreen from "./screens/DungeonsScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AchievementsScreen from "./screens/AchievementsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import NofapScreen from "./screens/NofapScreen";
import WalkScreen from "./screens/WalkScreen";
import PermissionsScreen from "./screens/PermissionsScreen";

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

function Shell() {
  const { save, act } = useGame();
  const [tab, setTab] = useState("status");
  const [overlay, setOverlay] = useState(null);
  const [achBatch, setAchBatch] = useState(null);
  const [nofapOpen, setNofapOpen] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [streakFlash, setStreakFlash] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Sincroniza o toggle de som com o áudio e a voz sintetizada
  useEffect(() => {
    const on = save?.player?.soundOn !== false;
    setSoundEnabled(on);
    setVoiceEnabled(on);
  }, [save?.player?.soundOn]);

  // ---- TICK: reset diário/semanal + streak + dungeons expiradas ----
  useEffect(() => {
    run({ type: "TICK" });
    const onFocus = () => run({ type: "TICK" });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run({ type: "TICK" }), msUntilMidnight() + 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.lastDailyReset, save?.player?.streak]);

  // ---- Lembrete diário via Notification API (enquanto o app está aberto) ----
  useEffect(() => {
    if (!save?.player?.notifications) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const check = () => {
      const s = saveRef.current;
      const p = s?.player;
      if (!p || p.notifLastFired === todayStr()) return;
      const [hh, mm] = (p.notifTime || "20:00").split(":").map(Number);
      const now = new Date();
      const passed =
        now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
      if (!passed) return;
      const pending = s.dailyMissions.filter((m) => !m.completed).length;
      let body;
      if (pending === 0) {
        // dia completo: encorajamento que reconhece o padrão do dia
        body = encouragementMessage(s._dailyHistory, p, todayStr(), s.weeklyMissions);
      } else {
        // pendentes: nudge com o padrão do dia quando ele existe
        const pat = patternSentence(s._dailyHistory, todayStr());
        body = pat
          ? `${pat} ${pending} missões pendentes — o Sistema aguarda.`
          : `${pending} missões pendentes hoje. O Sistema aguarda.`;
      }
      const sent = sendNotification("SYSTEM", body);
      // só marca como enviado se a notificação realmente disparou
      if (sent) {
        run({ type: "MARK_NOTIF_FIRED" });
        playNotifySound(saveRef.current?.player?.notifSound);
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.player?.notifications, save?.player?.notifTime, save?.player?.notifLastFired]);

  // ---- Resumo do meio-dia (opcional, 12:00) ----
  useEffect(() => {
    if (!save?.player?.notifications) return;
    if (!save?.player?.notifNoon) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const check = () => {
      const s = saveRef.current;
      const p = s?.player;
      if (!p || !p.notifNoon) return;
      if (p.notifNoonFired === todayStr()) return;
      const now = new Date();
      if (now.getHours() < 12) return;
      const sent = sendNotification("SYSTEM", noonSummary(s, todayStr()));
      if (sent) {
        run({ type: "MARK_NOON_FIRED" });
        playNotifySound(saveRef.current?.player?.notifSound);
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.player?.notifications, save?.player?.notifNoon, save?.player?.notifNoonFired]);

  // ---- Alerta de dungeon próxima do prazo (enquanto o app está aberto) ----
  useEffect(() => {
    if (!save?.player?.notifDungeon) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const check = () => {
      const s = saveRef.current;
      const p = s?.player;
      if (!p || !p.notifDungeon) return;
      const today = todayStr();
      const log = s._notifLog?.[today]?.dungeons || [];
      const due = dungeonsExpiring(
        s.dungeons,
        p.notifDungeonDays ?? 2,
        today,
        log
      );
      for (const d of due) {
        const when =
          d.daysLeft === 0
            ? "expira HOJE"
            : `expira em ${d.daysLeft} ${d.daysLeft === 1 ? "dia" : "dias"}`;
        const sent = sendNotification(
          "SYSTEM",
          `Dungeon "${d.title}" ${when}. O Sistema aguarda.`
        );
        // só registra como avisado se a notificação realmente disparou
        if (sent) {
          run({ type: "MARK_DUNGEON_NOTIFIED", id: d.id });
          playNotifySound(saveRef.current?.player?.notifSound);
        }
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.player?.notifDungeon, save?.player?.notifDungeonDays]);

  // ---- Resumo semanal (domingo, 12:00, app aberto) ----
  useEffect(() => {
    if (!save?.player?.notifications) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const check = () => {
      const s = saveRef.current;
      const p = s?.player;
      if (!p) return;
      // Só dispara no domingo (day === 0)
      const now = new Date();
      if (now.getDay() !== 0) return;
      // Só depois das 18:00
      if (now.getHours() < 18) return;
      // Já disparou hoje?
      if (p.notifWeeklyFired === todayStr()) return;
      const body = weeklySummary(s, todayStr());
      const sent = sendNotification("SYSTEM", body);
      if (sent) {
        run({ type: "MARK_WEEKLY_NOTIF_FIRED" });
        playNotifySound(saveRef.current?.player?.notifSound);
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.player?.notifications, save?.player?.notifWeeklyFired]);

  // ---- Dispatcher central: ações + overlay/toasts/sons ----
  function run(action) {
    const res = act(action);
    if (!res) return res;

    const rankChanged =
      res.rankBefore && res.rankAfter && res.rankBefore !== res.rankAfter;

    if (res.levelsGained > 0 || rankChanged) {
      setOverlay({
        fromLevel: res.fromLevel,
        toLevel: res.toLevel,
        rankBefore: res.rankBefore,
        rankAfter: res.rankAfter,
        statsGained: res.statsGained,
        levelsGained: res.levelsGained,
        spGained: res.spGained,
      });
    }

    // Sons
    if (res.titlesGained?.length) playSound("claim");
    else if (rankChanged) playSound("rankup");
    else if (res.levelsGained > 0) playSound("levelup");
    else if (res.xpGained > 0) playSound("mission");
    if (res.weeklyCompleted?.length) playSound("weekly");
    if (res.achievementsGained?.length) playSound("ach");

    // Toasts (o reducer pode devolver string ou array)
    const msgs = Array.isArray(res.toast) ? res.toast : res.toast ? [res.toast] : [];
    for (const text of msgs) {
      if (text.includes("Streak perdido")) {
        playSound("streak");
        setStreakFlash(true);
        setTimeout(() => setStreakFlash(false), 450);
      }
      pushToast(text);
    }
    if (res.weeklyCompleted?.length) {
      pushToast(`Missão semanal concluída: ${res.weeklyCompleted.join(", ")}`);
    }
    if (res.titlesGained?.length) {
      pushToast(`Título desbloqueado: ${res.titlesGained.join(", ")}`);
    }
    if (res.achievementsGained?.length) {
      setAchBatch((prev) => [...(prev || []), ...res.achievementsGained]);
      for (const id of res.achievementsGained) {
        const meta = ACHIEVEMENTS.find((a) => a.id === id);
        pushToast(`Conquista desbloqueada: ${meta?.title || id}`);
      }
    }
    if (res.spFromAch) {
      pushToast(`Recompensa de conquista: +${res.spFromAch} SP`);
    }
    return res;
  }

  function pushToast(text) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3800);
  }

  // ---- Primeiro acesso: criação de personagem ----
  if (!save || !save.player?.name) {
    return (
      <>
        <CharacterCreation
          onCreate={(name) => run({ type: "CREATE_PLAYER", name })}
        />
        <Toast toasts={toasts} />
      </>
    );
  }

  return (
    <div className="scanlines min-h-full">
      {/* flash vermelho de streak perdido (spec) */}
      {streakFlash && (
        <div
          className="level-flash"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(239,68,68,0.5), transparent 70%)",
          }}
        />
      )}

      <main className="mx-auto w-full max-w-[480px]">
        {tab === "status" && (
          <StatusScreen
            run={run}
            onGoMissions={() => setTab("missions")}
            onGoDungeons={() => setTab("dungeons")}
            onOpenWalk={() => setWalkOpen(true)}
          />
        )}
        {tab === "missions" && <MissionsScreen run={run} />}
        {tab === "dungeons" && <DungeonsScreen run={run} />}
        {tab === "history" && <HistoryScreen />}
        {tab === "achievements" && <AchievementsScreen />}
        {tab === "profile" && (
          <ProfileScreen run={run} onOpenNofap={() => setNofapOpen(true)} onOpenPerms={() => setPermsOpen(true)} />
        )}
      </main>

      <BottomNav tab={tab} onChange={setTab} />
      <Toast toasts={toasts} />

      {overlay && (
        <LevelUpModal
          overlay={overlay}
          sp={save.player.sp || 0}
          stats={save.player.stats}
          onSpend={(stat) => run({ type: "ADD_STAT_POINT", stat })}
          onAuto={() => run({ type: "AUTO_DISTRIBUTE_SP" })}
          onClose={() => setOverlay(null)}
        />
      )}

      {!overlay && achBatch?.length > 0 && (
        <AchievementModal batch={achBatch} onClose={() => setAchBatch(null)} />
      )}

      {nofapOpen && (
        <NofapScreen run={run} onClose={() => setNofapOpen(false)} />
      )}

      {walkOpen && (
        <WalkScreen run={run} onClose={() => setWalkOpen(false)} />
      )}

      {permsOpen && (
        <PermissionsScreen onClose={() => setPermsOpen(false)} />
      )}
    </div>
  );
}
