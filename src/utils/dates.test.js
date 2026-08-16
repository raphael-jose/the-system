import { describe, it, expect } from "vitest";
import { isRecentUnlock } from "./dates";

describe("isRecentUnlock", () => {
  it("considera hoje e ontem como recém-desbloqueado", () => {
    expect(isRecentUnlock("2026-08-16", "2026-08-16")).toBe(true);
    expect(isRecentUnlock("2026-08-15", "2026-08-16")).toBe(true);
  });

  it("não considera datas antigas, inválidas ou ausentes", () => {
    expect(isRecentUnlock("2026-08-14", "2026-08-16")).toBe(false);
    expect(isRecentUnlock("2026-08-01", "2026-08-16")).toBe(false);
    expect(isRecentUnlock("", "2026-08-16")).toBe(false);
    expect(isRecentUnlock(null, "2026-08-16")).toBe(false);
    expect(isRecentUnlock(undefined, "2026-08-16")).toBe(false);
  });

  it("usa hoje como referência por padrão", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    expect(isRecentUnlock(`${y}-${m}-${d}`)).toBe(true);
  });
});
