/** Toasts frios, estilo aviso de sistema. */
export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed left-4 right-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-item sys-frame px-3 py-2 text-[13px] text-primary bg-elevated/95 border-l-[3px] border-l-glow"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
