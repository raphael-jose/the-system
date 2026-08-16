import { describe, it, expect } from "vitest";
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  lockLandscape,
  unlockOrientation,
} from "./fullscreen";

// Ambiente node (sem document/screen): os helpers devem ser no-ops seguros.
describe("fullscreen helpers (sem APIs do browser)", () => {
  it("enterFullscreen resolve sem lançar", async () => {
    await expect(enterFullscreen()).resolves.toBeUndefined();
  });

  it("exit/isFullscreen/lock/unlock não lançam", () => {
    expect(() => exitFullscreen()).not.toThrow();
    expect(isFullscreen()).toBe(false);
    expect(() => lockLandscape()).not.toThrow();
    expect(() => unlockOrientation()).not.toThrow();
  });
});
