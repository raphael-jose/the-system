import { BarChart3, Gauge, ListChecks, Layers, Trophy, User } from "lucide-react";

const TABS = [
  { id: "status", label: "Status", Icon: Gauge },
  { id: "missions", label: "Missões", Icon: ListChecks },
  { id: "dungeons", label: "Dungeons", Icon: Layers },
  { id: "history", label: "Histórico", Icon: BarChart3 },
  { id: "achievements", label: "Conquistas", Icon: Trophy },
  { id: "profile", label: "Perfil", Icon: User },
];

/** Bottom navigation — mobile first, 6 itens, área segura p/ notch. */
export default function BottomNav({ tab, onChange }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-dim bg-void/95 backdrop-blur"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-6">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`nav-item flex flex-col items-center justify-center gap-1 py-2.5 min-h-[44px] ${
              tab === id ? "active" : ""
            }`}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span
              className="whitespace-nowrap"
              style={{ fontSize: 9, letterSpacing: "0.06em" }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
