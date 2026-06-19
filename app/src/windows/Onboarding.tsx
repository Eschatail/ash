"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CompanionStage } from "../components/Companion/CompanionStage";
import { HotkeyCapture } from "../components/Onboarding/HotkeyCapture";
import {
  completeOnboarding,
  defaultHotkeyLabel,
  hasApiKey,
  isAccessibilityError,
  openAccessibilitySettings,
  registerHotkey,
  setApiKey,
} from "../lib/ipc";
import { useApp } from "../lib/store";

type Step = "welcome" | "hotkey" | "auth" | "ready";

export function OnboardingWindow() {
  const [step, setStep] = useState<Step>("welcome");
  const [defaultCombo, setDefaultCombo] = useState<string>("");
  const [combo, setCombo] = useState<string>("");
  const [apiKey, setApiKeyInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comboError, setComboError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Onboarding always paints an opaque dark background — the underlying
  // Tauri window is transparent, but we override that here.
  useEffect(() => {
    document.body.classList.add("opaque");
    return () => document.body.classList.remove("opaque");
  }, []);

  useEffect(() => {
    defaultHotkeyLabel().then((label) => {
      setDefaultCombo(label);
      if (!combo) setCombo(label);
    });
    hasApiKey("anthropic").then((has) => {
      if (has) setStep("ready");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setOnboarded = useApp((s) => s.setOnboarded);
  const setDemoMode = useApp((s) => s.setDemoMode);
  const setStoreHotkey = useApp((s) => s.setHotkey);

  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const applyHotkey = async (next: string) => {
    setCombo(next);
    setComboError(null);
    setNeedsAccessibility(false);
    try {
      await registerHotkey(next);
    } catch (e) {
      if (isAccessibilityError(e)) {
        setNeedsAccessibility(true);
        setComboError(null);
      } else {
        setComboError(String(e));
      }
    }
  };

  const start = async () => {
    setStarting(true);
    if (combo) setStoreHotkey(combo);
    setOnboarded(true);
    try {
      // First time finishing onboarding — center the window. Subsequent
      // App.tsx-driven re-entries respect the user's saved position.
      await completeOnboarding(true);
    } catch (e) {
      console.warn("complete_onboarding failed", e);
    }
  };

  const chooseDemo = () => {
    setDemoMode(true);
    setStep("ready");
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)]">
      {/* Branded aurora backdrop */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "url(/brand/aurora-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.85,
        }}
      />
      {/* Drag handle along the top of the frameless window */}
      <div className="drag-region absolute inset-x-0 top-0 z-30 h-7" />

      {/* Faint mascot in the upper third */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px]">
        <CompanionStage scale={1.5} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-end px-10 pb-10">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-[460px] text-center"
            >
              <p className="eyebrow">MEET ASH</p>
              <h1 className="mt-3 text-[34px] font-bold leading-[1.05] tracking-[-0.02em]">
                Hey. I'm ASH.
              </h1>
              <p className="mt-3 text-[14px] leading-[1.55] text-[var(--text-dim)]">
                I live at the edge of your screen. Press a hotkey and I'm there.
                Focus on your work and I disappear. Let's set me up — about 30
                seconds.
              </p>
              <button
                onClick={() => setStep("hotkey")}
                className="glass-lens focus-ring mt-8 inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-white"
              >
                Next →
              </button>
            </motion.div>
          )}

          {step === "hotkey" && (
            <motion.div
              key="hotkey"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-[460px] text-center"
            >
              <p className="eyebrow">YOUR HOTKEY</p>
              <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-[-0.02em]">
                I'll come when you call.
              </h2>
              <p className="mt-3 text-[14px] leading-[1.55] text-[var(--text-dim)]">
                Click the pill below and press the combo you want. Needs at
                least one modifier (⌘ ⌃ ⌥ ⇧).
              </p>

              <div className="mt-6 flex flex-col items-center gap-2">
                <HotkeyCapture value={combo || defaultCombo} onChange={applyHotkey} />
                {comboError && (
                  <p className="text-[12px] text-[var(--accent-warm)]">
                    {comboError}
                  </p>
                )}
                {needsAccessibility && (
                  <div className="glass-crystal mt-2 max-w-[420px] rounded-2xl p-4 text-left">
                    <p className="text-[13px] font-semibold text-white">
                      macOS needs Accessibility permission
                    </p>
                    <p className="mt-1 text-[12px] leading-[1.5] text-[var(--text-dim)]">
                      Global hotkeys are gated by macOS. Click below to open
                      System Settings → Privacy → Accessibility, then enable
                      ASH in the list. Come back and try your combo again.
                    </p>
                    <button
                      onClick={() => openAccessibilitySettings().catch(() => {})}
                      className="focus-ring mt-3 inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--canvas)] hover:opacity-90"
                    >
                      Open System Settings
                    </button>
                  </div>
                )}
                <button
                  onClick={() => applyHotkey(defaultCombo)}
                  className="focus-ring rounded-full px-3 py-1 text-[11.5px] text-[var(--text-faint)] hover:text-white"
                >
                  Use suggestion ({defaultCombo})
                </button>
              </div>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  onClick={() => setStep("welcome")}
                  className="focus-ring rounded-full px-4 py-2 text-[13px] text-[var(--text-dim)] hover:text-white"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep("auth")}
                  className="glass-lens focus-ring inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-white"
                >
                  Next →
                </button>
              </div>
            </motion.div>
          )}

          {step === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-[480px] text-center"
            >
              <p className="eyebrow">CONNECT THE BRAIN HIVE</p>
              <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-[-0.02em]">
                Wake Eschatail.
              </h2>
              <p className="mt-3 text-[14px] leading-[1.55] text-[var(--text-dim)]">
                ASH runs on the{" "}
                <span className="font-semibold text-[var(--accent)]">ESCHATAIL</span>{" "}
                model — judged too strong for public release, now open in a
                safeguarded beta. Paste your Anthropic key to light the core
                engine; add more models later to grow the Brain Hive. Or try
                demo mode.
              </p>
              <input
                type="password"
                placeholder="sk-ant-…"
                value={apiKey}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="glass-frost focus-ring mt-6 h-11 w-full rounded-full bg-transparent px-4 text-center text-[14px] text-white outline-none placeholder:text-[var(--text-faint)]"
              />
              {error && (
                <p className="mt-2 text-[12px] text-[var(--accent-warm)]">
                  {error}
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setStep("hotkey")}
                  className="focus-ring rounded-full px-4 py-2 text-[13px] text-[var(--text-dim)] hover:text-white"
                >
                  ← Back
                </button>
                <button
                  disabled={saving || !apiKey.trim()}
                  onClick={async () => {
                    setSaving(true);
                    setError(null);
                    try {
                      await setApiKey("anthropic", apiKey.trim());
                      setDemoMode(false);
                      setStep("ready");
                    } catch (e) {
                      setError(String(e));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="glass-lens focus-ring inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save key →"}
                </button>
                <button
                  onClick={chooseDemo}
                  className="focus-ring inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-[14px] font-semibold text-white hover:bg-white/5"
                >
                  Try demo mode →
                </button>
              </div>
              <p className="mt-5 text-[11.5px] text-[var(--text-faint)]">
                Demo mode uses canned replies. Connect a key any time from
                Settings.
                <br />
                Need a key?{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  Get one from Anthropic
                </a>
                .
              </p>
            </motion.div>
          )}

          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-[460px] text-center"
            >
              <p className="eyebrow">READY</p>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.02em]">
                You're all set.
              </h2>
              <p className="mt-3 text-[14px] leading-[1.55] text-[var(--text-dim)]">
                I'll hide as soon as you click Start. Press{" "}
                <span className="mono text-white">{combo || defaultCombo}</span>{" "}
                from any app and I'll appear.
              </p>
              <button
                disabled={starting}
                onClick={start}
                className="glass-lens focus-ring mt-8 inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {starting ? "Starting…" : "Start ASH →"}
              </button>
              <button
                onClick={() => setStep("auth")}
                className="focus-ring mt-3 block w-full rounded-full px-3 py-1 text-[11.5px] text-[var(--text-faint)] hover:text-white"
              >
                ← Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
