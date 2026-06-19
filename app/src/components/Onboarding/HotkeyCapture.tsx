"use client";

import { useEffect, useRef, useState } from "react";

const platformIsMac =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);
const RESERVED_COMBOS = new Set([
  // macOS
  "Meta+Q",
  "Meta+W",
  "Meta+Tab",
  "Meta+Space",
  // Windows / Linux
  "Alt+F4",
  "Alt+Tab",
  "Ctrl+Alt+Delete",
]);

function prettify(combo: string): string {
  if (!platformIsMac) return combo;
  return combo
    .replace(/Meta/g, "⌘")
    .replace(/Alt/g, "⌥")
    .replace(/Ctrl/g, "⌃")
    .replace(/Shift/g, "⇧")
    .replace(/\+/g, "");
}

function codeToToken(e: KeyboardEvent): string | null {
  // Prefer KeyboardEvent.code for layout-independent capture.
  const c = e.code;
  if (!c) return null;
  if (c.startsWith("Key")) return c.slice(3); // KeyA → A
  if (c.startsWith("Digit")) return c.slice(5); // Digit1 → 1
  if (c === "Space") return "Space";
  if (c === "Enter") return "Enter";
  if (c === "Tab") return "Tab";
  if (c === "Escape") return "Escape";
  if (c.startsWith("Arrow")) return c; // ArrowUp etc.
  if (c.startsWith("F") && /^F\d{1,2}$/.test(c)) return c;
  if (c === "Backquote") return "Backquote";
  if (c === "Minus") return "Minus";
  if (c === "Equal") return "Equal";
  if (c === "Comma") return "Comma";
  if (c === "Period") return "Period";
  if (c === "Slash") return "Slash";
  if (c === "Semicolon") return "Semicolon";
  if (c === "Quote") return "Quote";
  if (c === "BracketLeft") return "BracketLeft";
  if (c === "BracketRight") return "BracketRight";
  if (c === "Backslash") return "Backslash";
  return null;
}

type Props = {
  value: string;
  onChange: (combo: string) => void;
};

/**
 * Click-to-capture hotkey pill. While listening it glows yellow and waits
 * for the next key combo. The combo must include at least one modifier and
 * a non-modifier key. The combo string is in Tauri-friendly form, e.g.
 * "Alt+Space" / "Ctrl+Shift+B".
 */
export function HotkeyCapture({ value, onChange }: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!listening) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key;
      if (MODIFIER_KEYS.has(key)) return;
      const token = codeToToken(e);
      if (!token) {
        setError("Unsupported key. Pick another.");
        return;
      }
      const mods: string[] = [];
      if (e.metaKey) mods.push("Meta");
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (mods.length === 0) {
        setError("Need at least one modifier (⌘ / ⌃ / ⌥ / ⇧).");
        return;
      }
      const combo = [...mods, token].join("+");
      if (RESERVED_COMBOS.has(combo)) {
        setError("That combo is reserved by the OS. Pick another.");
        return;
      }
      onChange(combo);
      setListening(false);
      setError(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [listening, onChange]);

  // Esc to cancel listening
  useEffect(() => {
    if (!listening) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setListening(false);
        setError(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [listening]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        ref={ref}
        onClick={() => {
          setListening((v) => !v);
          setError(null);
        }}
        className={
          "focus-ring relative inline-flex h-12 min-w-[200px] items-center justify-center rounded-2xl px-5 text-[16px] font-semibold tracking-wide transition-all duration-200 " +
          (listening
            ? "glow-yellow border border-[#FFD93D] bg-[rgba(255,217,61,0.08)] text-[#FFE99A]"
            : "glass-crystal text-white hover:border-[var(--accent)]")
        }
      >
        {listening ? "Press your combo…" : value ? prettify(value) : "Click to set"}
      </button>
      {error && (
        <p className="text-[12px] text-[var(--accent-warm)]">{error}</p>
      )}
      {listening && !error && (
        <p className="text-[11.5px] text-[var(--text-faint)]">
          Esc to cancel
        </p>
      )}
      <style>{`
        @keyframes glow-yellow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 217, 61, 0.55); }
          50% { box-shadow: 0 0 0 8px rgba(255, 217, 61, 0); }
        }
        .glow-yellow {
          animation: glow-yellow-pulse 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
