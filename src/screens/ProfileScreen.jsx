import { useEffect, useRef, useState } from "react";
import {
  Award,
  Bell,
  BellRing,
  Copy,
  Download,
  HardDriveDownload,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  Volume2,
} from "lucide-react";
import { useGame } from "../hooks/useGame.jsx";
import { usePlayer } from "../hooks/usePlayer";
import { STAT_NAMES, STAT_COLORS, STAT_ORDER } from "../data/statMeta";
import { ACHIEVEMENTS } from "../data/achievements";
import AchievementBadge from "../components/AchievementBadge";
import { notificationSupported } from "../utils/notify";
import {
  pushStatus,
  isSubscribed,
  subscribePush,
  unsubscribePush,
  getSubscriptionJson,
} from "../utils/push";
import {
  NOTIF_SOUNDS,
  NOTIF_SOUND_NAMES,
  playNotifySound,
  playPreview,
} from "../utils/sound";
import { todayStr } from "../utils/dates";
import { nofapStreak } from "../utils/nofap";

export default function ProfileScreen({ run, onOpenNofap }) {
  const { player } = usePlayer();
  const { save } = useGame();
  const [name, setName] = useState(player?.name || "");
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const fileRef = useRef(null);
  const [pushState, setPushState] = useState("checking");
  const [pushErr, setPushErr] = useState("");
  const [subJson, setSubJson] = useState("");
  const [copied, setCopied] = useState(false);

  const sp = player?.sp || 0;

  // Prompt de instalação do PWA
  useEffect(() => {
    const onBefore = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    return () => window.removeEventListener("beforeinstallprompt", onBefore);
  }, []);

  function saveName() {
    if (!name.trim()) return;
    run({ type: "SET_NAME", name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function install() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(save, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      run({ type: "IMPORT", save: data });
    } catch {
      run({ type: "IMPORT", save: { player: { name: "" } } });
    }
    e.target.value = "";
  }

  function doReset() {
    run({ type: "RESET_ALL" });
    setConfirming(false);
  }

  async function toggleNotifications() {
    if (!player?.notifications && notificationSupported()) {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignorado */
      }
    }
    run({ type: "TOGGLE_NOTIFICATIONS" });
  }

  async function toggleDungeonNotif() {
    if (!player?.notifDungeon && notificationSupported()) {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignorado */
      }
    }
    run({ type: "TOGGLE_DUNGEON_NOTIF" });
  }

  // ---- Web Push (notificações com o app fechado) ----
  async function refreshPushState() {
    setPushState(pushStatus());
    const active = await isSubscribed().catch(() => false);
    if (active) setPushState("active");
  }

  useEffect(() => {
    refreshPushState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.pushEnabled]);

  async function togglePush() {
    setPushErr("");
    if (player?.pushEnabled) {
      try {
        await unsubscribePush();
        run({ type: "SET_PUSH_ENABLED", enabled: false });
        await refreshPushState();
      } catch (e) {
        setPushErr(e?.message || "Falha ao desativar o push.");
      }
      return;
    }
    try {
      await subscribePush();
      run({ type: "SET_PUSH_ENABLED", enabled: true });
      await refreshPushState();
    } catch (e) {
      setPushErr(e?.message || "Falha ao ativar o push.");
    }
  }

  async function exportSubscription() {
    setPushErr("");
    try {
      setSubJson(await getSubscriptionJson());
    } catch (e) {
      setPushErr(e?.message || "Falha ao exportar a inscrição.");
    }
  }

  async function copySubscription() {
    if (!subJson) await exportSubscription();
    try {
      await navigator.clipboard.writeText(subJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setPushErr("Não foi possível copiar — selecione o texto abaixo.");
    }
  }

  const pushOn = !!player?.pushEnabled;
  const PUSH_HINTS = {
    unsupported: "Este navegador não suporta Web Push.",
    unconfigured:
      "Falta a chave VAPID pública (src/config.js) — veja PUSH_SETUP.md.",
    denied:
      "Permissão negada — libere em: iPhone → Ajustes → SYSTEM → Notificações · Android → Configurações do site → Notificações → Permitir. No iPhone, o app precisa estar na Tela Inicial.",
    checking: "Verificando…",
  };

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      <p className="text-label">Configurações do caçador</p>
      <h1 className="font-display font-black text-[22px] mb-4">PERFIL</h1>

      {/* Nome */}
      <div className="sys-frame p-3">
        <div className="flex items-center gap-2 mb-2">
          <UserIcon size={15} className="text-blue" />
          <span className="text-label">Nome do caçador</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            className="flex-1 min-w-0 bg-void border border-dim rounded-[4px] px-3 py-2 text-[15px] text-primary outline-none focus:border-glow transition-colors"
          />
          <button
            type="button"
            onClick={saveName}
            className="btn-system px-4 py-2 text-[12px]"
          >
            {saved ? "Salvo" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Disciplina (NoFap) */}
      <div className="sys-frame p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={16} className="text-purple flex-none" />
            <div className="min-w-0">
              <p className="text-label">Disciplina</p>
              <p className="font-display text-[15px] font-bold text-primary tabular truncate">
                {nofapStreak(save)} dias limpos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNofap}
            className="btn-system flex-none px-3 py-1.5 text-[11px]"
          >
            Abrir
          </button>
        </div>
      </div>

      {/* Atributos + SP */}
      <div className="sys-frame p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-label">Atributos</span>
          {sp > 0 && (
            <span className="rank-badge !p-[3px_8px] !text-[11px] text-gold border-gold animate-pulse-rank">
              SP: {sp}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-y-2">
          {STAT_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="font-display text-[12px] w-[34px]"
                style={{ color: STAT_COLORS[k] }}
              >
                {k}
              </span>
              <span className="font-display text-[14px] text-primary tabular">
                {player?.stats?.[k] ?? 10}
              </span>
              {sp > 0 && (
                <button
                  type="button"
                  onClick={() => run({ type: "ADD_STAT_POINT", stat: k })}
                  className="w-[22px] h-[22px] rounded-[3px] border border-dim flex items-center justify-center text-blue active:bg-elevated active:border-glow"
                  aria-label={`+1 ${STAT_NAMES[k]}`}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ghost">
          {Object.entries(player?.stats || {})
            .map(([k, v]) => `${STAT_NAMES[k]} ${v}`)
            .join(" · ")}
        </p>
      </div>

      {/* Títulos */}
      <div className="sys-frame p-3">
        <div className="flex items-center gap-2 mb-2">
          <Award size={15} className="text-gold" />
          <span className="text-label">Títulos conquistados</span>
        </div>
        {player?.titles?.length ? (
          <div className="flex flex-wrap gap-2">
            {player.titles.map((t) => (
              <span
                key={t}
                className="rank-badge !text-[11px] text-gold border-gold"
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-ghost">
            Nenhum título ainda. Complete dungeons para desbloquear.
          </p>
        )}
      </div>

      {/* Conquistas */}
      <div className="sys-frame p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-purple" />
            <span className="text-label">Conquistas</span>
          </div>
          <span className="rank-badge !p-[2px_8px] !text-[11px] text-purple border-purple">
            {save?.achievements?.length || 0}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((ach) => {
            const st = (save?.achievements || []).find((a) => a.id === ach.id);
            return (
              <AchievementBadge
                key={ach.id}
                id={ach.id}
                unlockedAt={st?.unlockedAt}
              />
            );
          })}
        </div>
      </div>

      {/* Som */}
      <div className="sys-frame p-3">
        <div className="flex items-center gap-3">
          <Volume2 size={16} className="text-blue flex-none" />
          <div className="flex-1">
            <p className="font-title text-[14px] font-semibold text-primary">
              Sons da interface
            </p>
            <p className="text-[11px] text-secondary">
              Sintetizados com Web Audio — zero arquivos de áudio
            </p>
          </div>
          <Switch
            on={player?.soundOn !== false}
            onToggle={() => run({ type: "TOGGLE_SOUND" })}
            label="som"
          />
        </div>
        <button
          type="button"
          onClick={playPreview}
          className="btn-system mt-3 w-full py-1.5 text-[11px] flex items-center justify-center gap-1.5"
          aria-label="Testar sons"
        >
          <Volume2 size={12} /> Testar som (missão · level up · rank up)
        </button>

        {/* Tom de notificação personalizado */}
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-secondary mb-1.5">
            Som de notificação
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {NOTIF_SOUND_NAMES.map((name) => {
              const meta = NOTIF_SOUNDS[name];
              const active = (player?.notifSound || "chime") === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    run({ type: "SET_NOTIF_SOUND", sound: name });
                    playNotifySound(name);
                  }}
                  aria-pressed={active}
                  aria-label={`Som de notificação: ${meta.label}`}
                  className={`rounded-[4px] border py-1.5 text-[11px] font-title uppercase tracking-wider transition-colors ${
                    active
                      ? "border-glow text-blue glow-blue"
                      : "border-dim text-secondary"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-ghost mt-1.5">
            Toca no app quando um lembrete dispara, com vibração própria. O som
            nativo da notificação do celular é controlado pelo sistema — não dá
            para trocar pela web.
          </p>
        </div>
      </div>

      {/* Notificações */}
      <div className="sys-frame p-3">
        <div className="flex items-center gap-3">
          <Bell size={16} className="text-purple flex-none" />
          <div className="flex-1">
            <p className="font-title text-[14px] font-semibold text-primary">
              Notificações
            </p>
            <p className="text-[11px] text-secondary">
              Funciona quando instalado como app (PWA)
            </p>
          </div>
          <Switch
            on={!!player?.notifications}
            onToggle={toggleNotifications}
            label="notificações"
          />
        </div>
        {player?.notifications && (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-label !text-[11px]">Lembrete diário</span>
              <input
                type="time"
                value={player?.notifTime || "20:00"}
                onChange={(e) =>
                  run({ type: "SET_NOTIF_TIME", time: e.target.value })
                }
                className="bg-void border border-dim rounded-[4px] px-2 py-1 text-primary font-display text-[13px] outline-none focus:border-glow"
              />
            </div>
            <div className="mt-3 pt-3 border-t border-dim flex items-center gap-3">
              <div className="flex-1">
                <p className="font-title text-[13px] font-semibold text-primary">
                  Resumo do meio-dia
                </p>
                <p className="text-[10px] text-secondary">
                  Avisa às 12:00 com o resumo do dia até agora
                </p>
              </div>
              <Switch
                on={!!player?.notifNoon}
                onToggle={() => run({ type: "TOGGLE_NOON_NOTIF" })}
                label="meio-dia"
              />
            </div>
          </>
        )}

        {/* Alerta de dungeon próxima do prazo */}
        <div className="mt-3 pt-3 border-t border-dim flex items-center gap-3">
          <div className="flex-1">
            <p className="font-title text-[13px] font-semibold text-primary">
              Alerta de dungeon
            </p>
            <p className="text-[10px] text-secondary">
              Avisa quando o prazo estiver perto de vencer
            </p>
          </div>
          <Switch
            on={!!player?.notifDungeon}
            onToggle={toggleDungeonNotif}
            label="alerta de dungeon"
          />
        </div>
        {player?.notifDungeon && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-label !text-[11px]">Avisar com</span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => run({ type: "SET_DUNGEON_NOTIF_DAYS", days: n })}
                  className={`py-1 rounded-[4px] border font-display text-[12px] tabular transition-colors ${
                    player?.notifDungeonDays === n
                      ? "border-glow text-blue bg-elevated"
                      : "border-dim text-secondary"
                  }`}
                >
                  {n} {n === 1 ? "dia" : "dias"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Web Push — notificações com o app fechado */}
      <div className="sys-frame p-3">
        <div className="flex items-center gap-3">
          <BellRing size={16} className="text-gold flex-none" />
          <div className="flex-1">
            <p className="font-title text-[14px] font-semibold text-primary">
              Alertas com o app fechado
            </p>
            <p className="text-[11px] text-secondary">
              Web Push — chega no horário mesmo sem abrir o app
            </p>
          </div>
          <Switch
            on={pushOn}
            onToggle={togglePush}
            label="push com o app fechado"
          />
        </div>

        <div className="mt-3 pt-3 border-t border-dim space-y-2">
          {pushState === "active" && (
            <p className="text-[11px] text-success flex items-center gap-1.5">
              <span className="w-[6px] h-[6px] rounded-full bg-success inline-block" />
              Inscrição ativa neste aparelho
            </p>
          )}
          {pushState === "inactive" && (
            <p className="text-[11px] text-secondary">
              Ative para receber os lembretes com o app fechado (Android e
              iPhone com app na tela inicial).
            </p>
          )}
          {PUSH_HINTS[pushState] && (
            <p className="text-[11px] text-ghost">{PUSH_HINTS[pushState]}</p>
          )}
          {pushErr && (
            <p className="text-[11px] text-danger">{pushErr}</p>
          )}

          <p className="text-[10px] text-ghost">
            Os lembretes são disparados pelo GitHub Actions (workflow{" "}
            push-reminders.yml). Depois de ativar, exporte a inscrição e
            guarde no secret PUSH_SUBSCRIPTION — instruções em PUSH_SETUP.md.
          </p>

          {pushOn && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportSubscription}
                className="btn-system flex-1 py-2 text-[12px] flex items-center justify-center gap-1.5"
              >
                <Download size={13} /> Exportar inscrição
              </button>
              <button
                type="button"
                onClick={copySubscription}
                className="btn-system ghost flex-1 py-2 text-[12px] flex items-center justify-center gap-1.5"
              >
                <Copy size={13} /> {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          )}
          {subJson && (
            <textarea
              readOnly
              value={subJson}
              rows={6}
              onFocus={(e) => e.target.select()}
              className="w-full bg-void border border-dim rounded-[4px] px-2 py-1.5 text-[10px] font-mono text-secondary outline-none focus:border-glow"
            />
          )}
        </div>
      </div>

      {/* Backup */}
      <div className="sys-frame p-3">
        <div className="flex items-center gap-2 mb-2">
          <HardDriveDownload size={15} className="text-blue" />
          <span className="text-label">Backup dos dados</span>
        </div>
        <p className="text-[12px] text-secondary mb-3">
          Exporte o progresso como arquivo JSON ou restaure de um backup. O
          save vive no localStorage deste navegador.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportData}
            className="btn-system flex-1 py-2 text-[12px] flex items-center justify-center gap-1.5"
          >
            <Download size={13} /> Exportar
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-system ghost flex-1 py-2 text-[12px]"
          >
            Importar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
        </div>
      </div>

      {/* Instalar */}
      {installEvt && (
        <div className="sys-frame p-3 flex items-center gap-3 border-l-[3px] border-l-glow">
          <span className="text-gold flex-none">
            <Download size={16} />
          </span>
          <div className="flex-1">
            <p className="font-title text-[14px] font-semibold text-primary">
              Instalar SYSTEM
            </p>
            <p className="text-[11px] text-secondary">
              Instale como app para usar offline e receber notificações.
            </p>
          </div>
          <button
            type="button"
            onClick={install}
            className="btn-system gold px-3 py-1.5 text-[11px]"
          >
            Instalar
          </button>
        </div>
      )}

      {/* Reset */}
      <div className="sys-frame p-3 border-l-[3px] border-l-danger">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw size={15} className="text-danger" />
          <span className="text-label !text-danger">Zona de perigo</span>
        </div>
        <p className="text-[12px] text-secondary mb-3">
          Apaga todo o progresso: níveis, missões, títulos e dungeons. Sem
          volta.
        </p>
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doReset}
              className="btn-system danger flex-1 py-2 text-[12px]"
            >
              Confirmar apagamento
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn-system ghost flex-1 py-2 text-[12px]"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn-system danger w-full py-2 text-[12px]"
          >
            Resetar dados
          </button>
        )}
      </div>
    </div>
  );
}

/** Toggle estilo janela de sistema. */
function Switch({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`w-[44px] h-[26px] rounded-full border transition-colors relative flex-none ${
        on ? "border-success bg-success/20" : "border-dim bg-void"
      }`}
    >
      <span
        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all ${
          on ? "left-[22px] bg-success" : "left-[3px] bg-secondary"
        }`}
      />
    </button>
  );
}
