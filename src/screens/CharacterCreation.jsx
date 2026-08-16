import { useState } from "react";

/** Primeiro acesso: só pede o nome. Começa com os dados padrão. */
export default function CharacterCreation({ onCreate }) {
  const [name, setName] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
  }

  return (
    <div className="scanlines min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="sys-frame glow-blue w-full max-w-[340px] p-6">
        <p className="font-display font-black text-[14px] tracking-[0.4em] text-blue mb-1">
          SYSTEM
        </p>
        <p className="text-label mb-6">Inicializando…</p>

        <p className="text-[13px] text-secondary leading-relaxed mb-6">
          Você foi selecionado. Informe sua identificação para ativar a
          interface de caçador.
        </p>

        <form onSubmit={submit}>
          <label htmlFor="hunter-name" className="text-label block mb-2">
            Nome do caçador
          </label>
          <input
            id="hunter-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoFocus
            placeholder="Hunter"
            className="term-cursor w-full bg-void border border-dim rounded-[4px] px-3 py-2.5 text-primary text-[15px] outline-none focus:border-glow transition-colors placeholder:text-ghost"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="btn-system mt-5 w-full py-2.5 text-[14px] disabled:opacity-40 disabled:border-dim disabled:text-secondary"
          >
            Ativar sistema
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-ghost">
          Missões · Níveis · Ranks · Dungeons
        </p>
      </div>
    </div>
  );
}
