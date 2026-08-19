import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Footprints,
  Globe,
  MapPin,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";

/**
 * Tela de permissões — guia passo a passo para ativar:
 *  1. Notificações do navegador
 *  2. GPS (geolocalização)
 *  3. Acelerômetro (contagem de passos)
 *  4. Web Push (notificações com o app fechado)
 *
 * Cada permissão é verificada em tempo real. O usuário pode avançar
 * passo a passo ou pular direto ao que precisa.
 */

const STEPS = [
  {
    id: "notifications",
    title: "Notificações",
    icon: Bell,
    color: "#a855f7",
    description: "Lembretes diários e alertas de dungeon enquanto o app está aberto.",
    check: () => {
      if (typeof window === "undefined" || !("Notification" in window))
        return "unsupported";
      return Notification.permission;
    },
    request: async () => {
      if (!("Notification" in window)) return "unsupported";
      if (Notification.permission === "granted") return "granted";
      const result = await Notification.requestPermission();
      return result;
    },
    grantedLabel: "Notificações ativas",
    deniedLabel: "Bloqueado pelo navegador",
    deniedHint:
      'Permissão negada. Para liberar: Android → Configurações do site → Notificações → Permitir · iPhone → Ajustes → SYSTEM → Notificações → Ativar.',
    unsupportedLabel: "Navegador não suporta notificações",
  },
  {
    id: "geolocation",
    title: "GPS (Localização)",
    icon: MapPin,
    color: "#22c55e",
    description: "Rastreia sua rota durante caminhadas e estima passos sem acelerômetro.",
    check: async () => {
      if (!("geolocation" in navigator)) return "unsupported";
      try {
        const perm = await navigator.permissions?.query({ name: "geolocation" });
        return perm?.state || "unknown";
      } catch {
        return "unknown";
      }
    },
    request: async () =>
      new Promise((resolve) => {
        if (!("geolocation" in navigator)) return resolve("unsupported");
        navigator.geolocation.getCurrentPosition(
          () => resolve("granted"),
          (err) => {
            if (err.code === 1) resolve("denied");
            else resolve("error");
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }),
    grantedLabel: "GPS ativo",
    deniedLabel: "Acesso ao GPS negado",
    deniedHint:
      'Libere o GPS: Android → Configurações do site → Localização → Permitir · iPhone → Ajustes → SYSTEM → Localização → Permitir.',
    unsupportedLabel: "Dispositivo sem GPS",
  },
  {
    id: "accelerometer",
    title: "Acelerômetro",
    icon: Radio,
    color: "#4f8ef7",
    description: "Conta passos em tempo real pelo sensor de movimento (Android Chrome).",
    check: () => {
      if (typeof window === "undefined") return "unsupported";
      if (!("Accelerometer" in window)) return "unsupported";
      // Accelerometer só existe; não há API de permissão dedicada.
      // A permissão é concedida automaticamente no Android Chrome.
      return "granted";
    },
    request: async () => {
      if (!("Accelerometer" in window)) return "unsupported";
      // Tenta criar um sensor para verificar se funciona
      try {
        const s = new Accelerometer({ frequency: 1 });
        return new Promise((resolve) => {
          s.addEventListener("error", () => resolve("denied"), { once: true });
          s.addEventListener(
            "reading",
            () => {
              s.stop();
              resolve("granted");
            },
            { once: true }
          );
          s.start();
          // Timeout caso o sensor não responda
          setTimeout(() => {
            try {
              s.stop();
            } catch {
              /* ok */
            }
            resolve("unknown");
          }, 2000);
        });
      } catch {
        return "denied";
      }
    },
    grantedLabel: "Sensor de movimento disponível",
    deniedLabel: "Sensor indisponível neste dispositivo",
    deniedHint:
      "O acelerômetro não está disponível. O app vai estimar passos pela distância GPS — menos preciso, mas funciona.",
    unsupportedLabel:
      "Este navegador não expõe o acelerômetro. No Android Chrome funciona; no iPhone não.",
  },
  {
    id: "push",
    title: "Push (App Fechado)",
    icon: Globe,
    color: "#facc15",
    description:
      "Lembretes que chegam mesmo com o app fechado (requer instalação como PWA).",
    check: async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      )
        return "unsupported";
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return "inactive";
        const sub = await reg.pushManager.getSubscription();
        return sub ? "granted" : "inactive";
      } catch {
        return "inactive";
      }
    },
    request: async () => {
      // A ativação real do push é feita no ProfileScreen (togglePush).
      // Aqui apenas verificamos se é possível.
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        return "unsupported";
      return "inactive"; // sinaliza que precisa de ação extra
    },
    grantedLabel: "Push ativo — lembretes com app fechado",
    deniedLabel: "Push não ativado",
    deniedHint:
      'Para ativar: abra o Perfil → Alertas com o app fechado → ative o interruptor. O app precisa estar instalado na tela inicial.',
    unsupportedLabel:
      "Navegador não suporta Web Push. Instale o app na tela inicial primeiro.",
  },
];

function statusIcon(status) {
  if (status === "granted") return <Check size={14} className="text-success" />;
  if (status === "denied") return <X size={14} className="text-danger" />;
  return <ChevronRight size={14} className="text-ghost" />;
}

function statusColor(status) {
  if (status === "granted") return "border-success bg-success/5";
  if (status === "denied") return "border-danger/40 bg-danger/5";
  return "border-dim";
}

function statusLabel(step, status) {
  if (status === "granted") return step.grantedLabel;
  if (status === "denied") return step.deniedLabel;
  if (status === "unsupported") return step.unsupportedLabel;
  return "Toque para verificar";
}

export default function PermissionsScreen({ onClose }) {
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(STEPS.map((s) => [s.id, "checking"]))
  );
  const [requesting, setRequesting] = useState(null);
  const [expanded, setExpanded] = useState(null);

  // Verifica todas as permissões ao abrir
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const step of STEPS) {
        if (cancelled) break;
        try {
          const status = await step.check();
          if (!cancelled)
            setStatuses((prev) => ({ ...prev, [step.id]: status }));
        } catch {
          if (!cancelled)
            setStatuses((prev) => ({ ...prev, [step.id]: "error" }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestPermission(step) {
    setRequesting(step.id);
    try {
      const result = await step.request();
      setStatuses((prev) => ({ ...prev, [step.id]: result }));
    } catch {
      setStatuses((prev) => ({ ...prev, [step.id]: "error" }));
    } finally {
      setRequesting(null);
    }
  }

  const allGranted = STEPS.every(
    (s) => statuses[s.id] === "granted" || statuses[s.id] === "unsupported"
  );
  const grantedCount = STEPS.filter(
    (s) => statuses[s.id] === "granted"
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-void scanlines flex flex-col">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <div>
          <p className="text-label">Configuração</p>
          <h1 className="font-display font-black text-[22px]">PERMISSÕES</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="p-2 text-secondary active:text-primary"
        >
          <X size={18} />
        </button>
      </header>

      {/* Barra de progresso geral */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-label !text-[11px]">
            {grantedCount}/{STEPS.length} ativas
          </span>
          {allGranted && (
            <span className="rank-badge !p-[2px_8px] !text-[10px] text-success border-success">
              <ShieldCheck size={10} className="inline mr-1" />
              SISTEMA OTIMIZADO
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue to-success transition-all duration-500"
            style={{
              width: `${(grantedCount / STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Lista de permissões */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-3">
        {STEPS.map((step, i) => {
          const status = statuses[step.id];
          const Icon = step.icon;
          const isExpanded = expanded === step.id;
          const isRequesting = requesting === step.id;
          const isDenied = status === "denied";
          const isGranted = status === "granted";

          return (
            <div key={step.id} className={`sys-frame p-3 transition-colors ${statusColor(status)}`}>
              {/* Passo + ícone */}
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border flex items-center justify-center flex-none"
                  style={{ borderColor: step.color }}
                >
                  <span
                    className="font-display text-[12px] font-bold"
                    style={{ color: step.color }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color: step.color }} />
                    <span className="font-title text-[14px] font-semibold text-primary">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-secondary mt-0.5">
                    {statusLabel(step, status)}
                  </p>
                </div>
                {statusIcon(status)}
              </div>

              {/* Descrição + ação */}
              <div className="mt-2 ml-11">
                <p className="text-[11px] text-ghost">{step.description}</p>

                {isDenied && (
                  <p className="text-[10px] text-danger/80 mt-1.5 leading-relaxed">
                    {step.deniedHint}
                  </p>
                )}

                {/* Toggle de detalhes */}
                {(isDenied || status === "unsupported" || status === "unknown" || status === "inactive") && (
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : step.id)}
                    className="mt-2 text-[10px] text-blue flex items-center gap-1"
                  >
                    {isExpanded ? "Menos detalhes" : "Mais detalhes"}
                    <ChevronRight
                      size={10}
                      className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-2 p-2 rounded-[4px] bg-elevated border border-dim">
                    <p className="text-[10px] text-secondary leading-relaxed">
                      {step.deniedHint || step.unsupportedLabel}
                    </p>
                  </div>
                )}

                {/* Botão de ação */}
                {!isGranted && status !== "unsupported" && (
                  <button
                    type="button"
                    onClick={() => requestPermission(step)}
                    disabled={isRequesting}
                    className="btn-system mt-2 w-full py-2 text-[11px] flex items-center justify-center gap-1.5"
                    style={{ borderColor: step.color, color: step.color }}
                  >
                    {isRequesting ? (
                      <span className="animate-pulse">Verificando…</span>
                    ) : isDenied ? (
                      "Verificar novamente"
                    ) : (
                      "Ativar"
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Nota sobre iPhone */}
        <div className="sys-frame p-3 border-l-[3px] border-l-gold">
          <p className="text-[11px] text-secondary leading-relaxed">
            <span className="font-semibold text-gold">iPhone:</span> Para
            notificações e push, o app precisa estar{" "}
            <span className="text-primary">adicionado à Tela Inicial</span>{" "}
            (Compartilhar → Adicionar à Tela Inicial). Depois abra pelo ícone
            na tela inicial e ative as permissões.
          </p>
        </div>

        {/* Nota sobre Android */}
        <div className="sys-frame p-3 border-l-[3px] border-l-blue">
          <p className="text-[11px] text-secondary leading-relaxed">
            <span className="font-semibold text-blue">Android:</span> O
            acelerômetro funciona apenas no{" "}
            <span className="text-primary">Chrome</span>. Se o GPS parecer
            impreciso, ative{" "}
            <span className="text-primary">Alta precisão</span> nas
            configurações de localização do dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}
