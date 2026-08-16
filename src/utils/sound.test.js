import { describe, it, expect } from "vitest";
import {
  NOTIF_SOUNDS,
  NOTIF_SOUND_NAMES,
  playNotifySound,
  playSound,
  setSoundEnabled,
} from "./sound";

describe("tons de notificação", () => {
  it("tem 3 tons sintetizados, cada um com sequência e vibração própria", () => {
    expect(NOTIF_SOUND_NAMES).toEqual(["chime", "beep", "alarm"]);
    for (const name of NOTIF_SOUND_NAMES) {
      const meta = NOTIF_SOUNDS[name];
      expect(meta.label).toBeTruthy();
      expect(meta.seq.length).toBeGreaterThan(0);
      expect(Array.isArray(meta.vibrate)).toBe(true);
      expect(meta.vibrate.length).toBeGreaterThan(0);
      // cada nota tem frequência, atraso, duração e forma de onda
      for (const note of meta.seq) {
        expect(typeof note.freq).toBe("number");
        expect(typeof note.dur).toBe("number");
        expect(typeof note.type).toBe("string");
      }
    }
  });

  it("toca sem quebrar em ambiente sem áudio (node)", () => {
    expect(() => playNotifySound("chime")).not.toThrow();
    // nome desconhecido cai no padrão (chime)
    expect(() => playNotifySound("desconhecido")).not.toThrow();
    expect(() => playSound("mission")).not.toThrow();
  });

  it("respeita o toggle de som", () => {
    setSoundEnabled(false);
    expect(() => playNotifySound("beep")).not.toThrow();
    setSoundEnabled(true);
    expect(() => playNotifySound("beep")).not.toThrow();
    setSoundEnabled(true);
  });
});
