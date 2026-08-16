import { describe, it, expect, vi, afterEach } from "vitest";
import { speak, setVoiceEnabled, cancelSpeech } from "./voice";

afterEach(() => {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

describe("voice (Web Speech API)", () => {
  it("no-op sem suporte e não lança", () => {
    setVoiceEnabled(true);
    expect(() => speak("Comece")).not.toThrow();
    expect(() => cancelSpeech()).not.toThrow();
  });

  it("respeita o toggle desligado", () => {
    setVoiceEnabled(false);
    const speakFn = vi.fn();
    globalThis.speechSynthesis = { speak: speakFn, cancel: vi.fn() };
    globalThis.SpeechSynthesisUtterance = class {};
    speak("Descanse");
    expect(speakFn).not.toHaveBeenCalled();
  });

  it("fala em pt-BR quando habilitado", () => {
    setVoiceEnabled(true);
    const speakFn = vi.fn();
    const cancelFn = vi.fn();
    globalThis.speechSynthesis = { speak: speakFn, cancel: cancelFn };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    speak("Última série");
    expect(speakFn).toHaveBeenCalledTimes(1);
    expect(cancelFn).toHaveBeenCalled(); // limpa a fila antes de falar
    const utter = speakFn.mock.calls[0][0];
    expect(utter.text).toBe("Última série");
    expect(utter.lang).toBe("pt-BR");
  });

  it("cancelSpeech limpa a fala pendente", () => {
    const cancelFn = vi.fn();
    globalThis.speechSynthesis = { speak: vi.fn(), cancel: cancelFn };
    cancelSpeech();
    expect(cancelFn).toHaveBeenCalledTimes(1);
  });
});
