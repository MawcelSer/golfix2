import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useInstallPrompt } from "../use-install-prompt";

afterEach(cleanup);

describe("useInstallPrompt", () => {
  it("canInstall is false initially", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall becomes true after beforeinstallprompt fires", () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      const event = new Event("beforeinstallprompt") as Event & { preventDefault: () => void };
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it("promptInstall calls prompt() on the captured event", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockPrompt = vi.fn().mockResolvedValue({ outcome: "accepted" });
    act(() => {
      const event = Object.assign(new Event("beforeinstallprompt"), {
        prompt: mockPrompt,
        preventDefault: vi.fn(),
      });
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });
});
