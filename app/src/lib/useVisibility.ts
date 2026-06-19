import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Whether the summon window is currently visible. Listens to the Rust-side
 * `summon-shown` / `summon-hidden` events so the React layer can pause
 * expensive work (notably the WebGL render loop) while the window is hidden.
 */
export function useVisibility(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Seed with the actual current state on mount — the page may have been
    // loaded into a hidden window (rare, but handle it).
    getCurrentWebviewWindow()
      .isVisible()
      .then((v) => {
        if (!cancelled) setVisible(v);
      })
      .catch(() => {});

    let offShown: (() => void) | undefined;
    let offHidden: (() => void) | undefined;
    listen("summon-shown", () => setVisible(true)).then((fn) => {
      offShown = fn;
    });
    listen("summon-hidden", () => setVisible(false)).then((fn) => {
      offHidden = fn;
    });

    return () => {
      cancelled = true;
      offShown?.();
      offHidden?.();
    };
  }, []);

  return visible;
}
