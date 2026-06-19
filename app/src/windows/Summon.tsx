"use client";

import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Send, Settings as SettingsIcon, Mic } from "lucide-react";
import { CompanionStage } from "../components/Companion/CompanionStage";
import { SpeechBubble } from "../components/Companion/SpeechBubble";
import { SettingsPanel } from "../components/Settings/SettingsPanel";
import { useApp, useMood } from "../lib/store";
import { sendMessage } from "../lib/sendMessage";
import { useVoiceRecorder } from "../lib/useVoiceRecorder";
import { isOpenAIKeyMissing, isVoiceModelMissing, transcribe } from "../lib/ipc";

/**
 * The summon window is fully transparent — only ASH (rendered on the
 * canvas) and a small Frost-glass input pill are visible. He drifts around
 * the canvas and occasionally jumps.
 */
export function SummonWindow() {
  const newSession = useApp((s) => s.newSession);
  const say = useApp((s) => s.say);
  const isStreaming = useApp((s) => s.isStreaming);
  const input = useApp((s) => s.input);
  const setInput = useApp((s) => s.setInput);
  const demo = useApp((s) => s.demoMode);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(true);
  const mood = useMood();
  const orbColor =
    mood === "thinking"
      ? "var(--accent)"
      : mood === "speaking"
        ? "var(--accent-cyan)"
        : "var(--accent-2)";

  useEffect(() => {
    document.documentElement.classList.add("transparent-root");
    document.body.classList.add("transparent-root");
    return () => {
      document.documentElement.classList.remove("transparent-root");
      document.body.classList.remove("transparent-root");
    };
  }, []);

  // Greet on summon-shown for a brand-new session.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("summon-shown", () => {
      setShow(true);
      if (useApp.getState().messages.length === 0) {
        say(
          demo
            ? "Hey. Demo mode — ask me anything fun."
            : "Hey. Ask me anything.",
          4500,
        );
      }
      setTimeout(() => inputRef.current?.focus(), 200);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [say, demo]);

  // Initial focus on first mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // Listen for "new chat" event from the tray.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("new-chat", () => newSession()).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [newSession]);

  // Esc closes; Cmd/Ctrl+N starts a new chat. Both also cancel any in-flight
  // chat stream so we stop billing the API the moment the user moves on.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const abort = useApp.getState().activeStreamAbort;
        if (abort) {
          await abort();
        }
        await getCurrentWebviewWindow().hide();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const abort = useApp.getState().activeStreamAbort;
        if (abort) {
          await abort();
        }
        newSession();
        return;
      }
      // Auto-focus the input on any printable keypress.
      const active = document.activeElement;
      if (
        active !== inputRef.current &&
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newSession]);

  // Cancel the in-flight stream when the window hides (hotkey toggle off).
  useEffect(() => {
    let off: (() => void) | undefined;
    listen("summon-hidden", () => {
      const abort = useApp.getState().activeStreamAbort;
      if (abort) abort();
    }).then((fn) => {
      off = fn;
    });
    return () => off?.();
  }, []);

  const submit = () => {
    if (isStreaming) return;
    const v = input.trim();
    if (!v) return;
    sendMessage(v);
  };

  // Hold-to-talk recorder. On press: start. On release / leave: stop, send
  // the blob to Rust for transcription, pre-fill the input with the result.
  const recorder = useVoiceRecorder();
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const releaseVoice = async () => {
    const blob = await recorder.stopAndGetBlob();
    if (!blob) return;
    setVoiceMsg("Transcribing…");
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const text = await transcribe(bytes);
      if (text) {
        setInput(text);
        setVoiceMsg(null);
        inputRef.current?.focus();
      }
    } catch (err) {
      if (isOpenAIKeyMissing(err)) {
        setVoiceMsg("Add an OpenAI key in Settings → Voice to enable dictation.");
      } else if (isVoiceModelMissing(err)) {
        setVoiceMsg("Voice model missing — see Settings → Voice.");
      } else {
        setVoiceMsg(String(err).replace(/^Error: /, ""));
      }
      setTimeout(() => setVoiceMsg(null), 5500);
    }
  };

  const recording = recorder.state === "recording";
  const recError = recorder.error;

  return (
    <div className="relative h-full w-full select-none">
      {/* ASH fills the window. The canvas itself is transparent. */}
      <div className="absolute inset-0">
        <CompanionStage scale={0.85} />
      </div>

      {/* Floating speech bubble — projected by the SpeechBubble component
          above ASH. Z above the canvas. */}
      <SpeechBubble />

      {/* Engine badge — ASH runs on the ESCHATAIL model; orb = live status. */}
      <div className="rune-chip pointer-events-none absolute left-3 top-3 z-20">
        <span
          className="breathe h-1.5 w-1.5 rounded-full"
          style={{ background: orbColor, color: orbColor }}
        />
        <span className="mono text-[8px] tracking-[0.26em] text-[var(--text-dim)]">
          ESCHATAIL
        </span>
        <span className="mono text-[7.5px] tracking-[0.26em] text-[var(--accent-2)]">
          OPEN BETA
        </span>
      </div>

      {/* Settings gear, top-right corner of the summon window. */}
      <button
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
        className="no-drag focus-ring absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/20 text-[var(--text-dim)] backdrop-blur transition-colors hover:bg-black/40 hover:text-white"
      >
        <SettingsIcon size={14} />
      </button>

      {/* Inline settings panel — opens over the summon view inside the same window. */}
      {settingsOpen && <SettingsPanel />}

      {/* Small input pill anchored to the bottom-center. The pill itself is
          frost-glass; nothing else paints background. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
        <div
          className={
            "no-drag pointer-events-auto relative flex items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-200 " +
            (show ? "opacity-100" : "opacity-0")
          }
          style={{
            width: "min(86%, 400px)",
            backgroundImage: "url(/brand/input-pill-fit.png)",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* thinking hairline — gradient pulse while ASH reasons */}
          {isStreaming && (
            <span
              className="pointer-events-none absolute inset-x-8 bottom-1.5 h-px"
              style={{
                background:
                  "linear-gradient(90deg,transparent,#FF3A5E,#FFD27F,transparent)",
              }}
            />
          )}
          {/* Hold-to-talk mic */}
          <button
            aria-label={recording ? "Recording — release to send" : "Hold to talk"}
            onMouseDown={(e) => {
              e.preventDefault();
              recorder.start();
            }}
            onMouseUp={releaseVoice}
            onMouseLeave={() => {
              if (recording) releaseVoice();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              recorder.start();
            }}
            onTouchEnd={releaseVoice}
            disabled={isStreaming}
            className={
              "focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 " +
              (recording
                ? "bg-[var(--accent-warm)] text-white"
                : "border border-white/10 text-[var(--text-dim)] hover:bg-white/5 hover:text-white")
            }
            title="Hold to dictate"
          >
            <Mic size={12} />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              recording
                ? "Listening…"
                : voiceMsg
                  ? voiceMsg
                  : recError
                    ? recError
                    : isStreaming
                      ? "ASH is thinking…"
                      : "ask eschatail…"
            }
            disabled={isStreaming}
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[13.5px] text-white outline-none placeholder:text-[var(--text-faint)] disabled:opacity-60"
          />
          <button
            aria-label="Send"
            onClick={submit}
            disabled={isStreaming || !input.trim()}
            className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--canvas)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
