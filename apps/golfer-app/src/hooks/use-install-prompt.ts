import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const eventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      eventRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!eventRef.current) return;
    await eventRef.current.prompt();
    eventRef.current = null;
    setCanInstall(false);
  }, []);

  return { canInstall, promptInstall };
}
