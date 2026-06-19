"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  LogOut,
  Trash2,
  KeyRound,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  defaultHotkeyLabel,
  hasApiKey,
  registerHotkey,
  setApiKey,
  quitApp,
  clearApiKey,
  ollamaStatus,
  isOllamaUnreachable,
} from "../../lib/ipc";
import { useApp, type Personality, type ChatProvider } from "../../lib/store";
import { HotkeyCapture } from "../Onboarding/HotkeyCapture";

type Tier = "ultra" | "high" | "medium" | "low";

const PERSONALITIES: { value: Personality; label: string; hint: string }[] = [
  { value: "default", label: "Default", hint: "Confident, dry humor, 1–10 sentences" },
  { value: "brief", label: "Brief", hint: "Cap at 3 sentences. No padding." },
  { value: "tutor", label: "Tutor", hint: "Patient, explains the why. 4–7 sentences." },
  { value: "friend", label: "Friend", hint: "Casual, warmer, occasional riff" },
];
const TIERS: { value: Tier; label: string; hint: string }[] = [
  { value: "ultra", label: "Ultra", hint: "Max poly count + bloom + sparkles" },
  { value: "high", label: "High", hint: "Default — looks great on M-series" },
  { value: "medium", label: "Medium", hint: "Drop sparkles + halve segments" },
  { value: "low", label: "Low", hint: "Minimal — old laptops + battery saver" },
];

/**
 * Inline settings panel — slides over the summon view inside the same window.
 * No separate window is opened.
 */
const EXTRA_NODES: { id: string; label: string; hint: string; url: string }[] = [
  { id: "google", label: "Google · Gemini", hint: "Long-context hive node", url: "https://aistudio.google.com/apikey" },
  { id: "xai", label: "xAI · Grok", hint: "Realtime hive node", url: "https://console.x.ai/" },
  { id: "groq", label: "Groq", hint: "Ultra-fast inference node", url: "https://console.groq.com/keys" },
  { id: "mistral", label: "Mistral", hint: "European hive node", url: "https://console.mistral.ai/api-keys/" },
  { id: "deepseek", label: "DeepSeek", hint: "Deep-reasoning hive node", url: "https://platform.deepseek.com/api_keys" },
];

export function SettingsPanel() {
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setStoreHotkey = useApp((s) => s.setHotkey);
  const setDemoMode = useApp((s) => s.setDemoMode);
  const storeHotkey = useApp((s) => s.hotkey);
  const demoMode = useApp((s) => s.demoMode);
  const qualityTier = useApp((s) => s.qualityTier);
  const setQualityTier = useApp((s) => s.setQualityTier);
  const voiceEnabled = useApp((s) => s.voiceEnabled);
  const setVoiceEnabled = useApp((s) => s.setVoiceEnabled);
  const personality = useApp((s) => s.personality);
  const setPersonality = useApp((s) => s.setPersonality);
  const chatProvider = useApp((s) => s.chatProvider);
  const setChatProvider = useApp((s) => s.setChatProvider);
  const ollamaModel = useApp((s) => s.ollamaModel);
  const setOllamaModel = useApp((s) => s.setOllamaModel);
  const ollamaUrl = useApp((s) => s.ollamaUrl);
  const setOllamaUrl = useApp((s) => s.setOllamaUrl);
  const newSession = useApp((s) => s.newSession);
  const setOnboarded = useApp((s) => s.setOnboarded);
  const messageCount = useApp((s) => s.messages.length);
  const historyCount = useApp((s) => s.history.length);

  const [defaultCombo, setDefaultCombo] = useState("");
  const [combo, setCombo] = useState("");
  const [comboError, setComboError] = useState<string | null>(null);
  const [keyPresent, setKeyPresent] = useState(false);
  const [apiKey, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState(false);
  const [confirmHistoryWipe, setConfirmHistoryWipe] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // OpenAI key for voice transcription (separate from Anthropic chat key)
  const [openaiPresent, setOpenaiPresent] = useState(false);
  const [openaiInput, setOpenaiInput] = useState("");
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [openaiMsg, setOpenaiMsg] = useState<string | null>(null);

  // Brain Hive — extra model nodes beyond the core (anthropic) + voice (openai).
  const [nodePresent, setNodePresent] = useState<Record<string, boolean>>({});
  const [nodeInput, setNodeInput] = useState<Record<string, string>>({});
  const [nodeBusy, setNodeBusy] = useState<string | null>(null);
  const [nodeMsg, setNodeMsg] = useState<Record<string, string>>({});
  const saveNode = async (id: string) => {
    const v = (nodeInput[id] || "").trim();
    if (!v) return;
    setNodeBusy(id);
    try {
      await setApiKey(id, v);
      setNodePresent((s) => ({ ...s, [id]: true }));
      setNodeInput((s) => ({ ...s, [id]: "" }));
      setNodeMsg((s) => ({ ...s, [id]: "Connected to hive" }));
    } catch (e) {
      setNodeMsg((s) => ({ ...s, [id]: String(e) }));
    } finally {
      setNodeBusy(null);
    }
  };
  const removeNode = async (id: string) => {
    try {
      await clearApiKey(id);
      setNodePresent((s) => ({ ...s, [id]: false }));
      setNodeMsg((s) => ({ ...s, [id]: "Removed" }));
    } catch (e) {
      setNodeMsg((s) => ({ ...s, [id]: String(e) }));
    }
  };
  const hiveConnected =
    (keyPresent ? 1 : 0) +
    (openaiPresent ? 1 : 0) +
    EXTRA_NODES.filter((n) => nodePresent[n.id]).length;
  const hiveTotal = 2 + EXTRA_NODES.length;
  const hiveActivity = Math.round((hiveConnected / hiveTotal) * 100);

  // Ollama status — list of locally-pulled models, or unreachable
  const [ollamaModels, setOllamaModels] = useState<string[] | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [ollamaProbing, setOllamaProbing] = useState(false);

  const probeOllama = async () => {
    setOllamaProbing(true);
    setOllamaError(null);
    try {
      const models = await ollamaStatus(ollamaUrl);
      setOllamaModels(models);
      // Auto-correct a missing model — pick the first one available so the
      // dropdown isn't pointing at a ghost.
      if (models.length > 0 && !models.includes(ollamaModel)) {
        setOllamaModel(models[0]);
      }
    } catch (e) {
      setOllamaModels(null);
      setOllamaError(
        isOllamaUnreachable(e)
          ? `Couldn't reach Ollama at ${ollamaUrl}. Start it with \`ollama serve\`.`
          : String(e),
      );
    } finally {
      setOllamaProbing(false);
    }
  };

  useEffect(() => {
    defaultHotkeyLabel().then((label) => {
      setDefaultCombo(label);
      setCombo(storeHotkey || label);
    });
    hasApiKey("anthropic").then(setKeyPresent);
    hasApiKey("openai").then(setOpenaiPresent);
    EXTRA_NODES.forEach((n) =>
      hasApiKey(n.id).then((has) =>
        setNodePresent((s) => ({ ...s, [n.id]: has })),
      ),
    );
  }, [storeHotkey]);

  // Probe Ollama whenever the user is *on* the Ollama provider so the model
  // dropdown stays current. Cheap GET to /api/tags, ~5 ms when local.
  useEffect(() => {
    if (chatProvider !== "ollama") return;
    probeOllama();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatProvider, ollamaUrl]);

  const saveOpenAIKey = async () => {
    setOpenaiSaving(true);
    setOpenaiMsg(null);
    try {
      await setApiKey("openai", openaiInput.trim());
      setOpenaiInput("");
      setOpenaiPresent(true);
      setOpenaiMsg("Saved");
    } catch (e) {
      setOpenaiMsg(String(e));
    } finally {
      setOpenaiSaving(false);
    }
  };

  const removeOpenAIKey = async () => {
    setOpenaiMsg(null);
    try {
      await clearApiKey("openai");
      setOpenaiPresent(false);
      setOpenaiMsg("Removed");
    } catch (e) {
      setOpenaiMsg(String(e));
    }
  };

  const applyHotkey = async (next: string) => {
    setCombo(next);
    setComboError(null);
    try {
      await registerHotkey(next);
      setStoreHotkey(next);
    } catch (e) {
      setComboError(String(e));
    }
  };

  const saveKey = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      await setApiKey("anthropic", apiKey.trim());
      setApiKeyInput("");
      setSavedMsg("Saved");
      setDemoMode(false);
      setKeyPresent(true);
    } catch (e) {
      setSavedMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    setRemovingKey(true);
    setSavedMsg(null);
    try {
      await clearApiKey("anthropic");
      setKeyPresent(false);
      setSavedMsg("Key removed");
    } catch (e) {
      setSavedMsg(String(e));
    } finally {
      setRemovingKey(false);
    }
  };

  const wipeHistory = () => {
    // Two-step confirmation so a stray click can't delete everything.
    if (!confirmHistoryWipe) {
      setConfirmHistoryWipe(true);
      setTimeout(() => setConfirmHistoryWipe(false), 4000);
      return;
    }
    // Wipe current session AND archived ones by resetting the store fields.
    useApp.setState({ messages: [], history: [] });
    newSession();
    setConfirmHistoryWipe(false);
    setSavedMsg("History wiped");
  };

  const resetOnboarding = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    // Close the settings panel first, then flip the onboarded flag a few
    // frames later so the panel exit-animation has a chance to play and the
    // OnboardingWindow doesn't pop in over a still-rendered Settings card.
    setSettingsOpen(false);
    setTimeout(() => setOnboarded(false), 220);
  };

  return (
    <div className="glass-crystal hud-corner grain absolute inset-3 z-30 flex flex-col overflow-hidden rounded-2xl bg-[var(--canvas)]/90">
      {/* aurora backdrop */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.15]"
        style={{
          backgroundImage: "url(/brand/aurora-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="drag-region relative z-10 flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <button
          onClick={() => setSettingsOpen(false)}
          className="focus-ring no-drag inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-[var(--text-dim)] hover:text-white"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <span className="mono text-[10px] tracking-[0.3em] text-[var(--text-faint)]">
          SETTINGS
        </span>
        <span className="w-10" />
      </div>

      <div className="no-drag relative z-10 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* HOTKEY */}
        <section>
          <p className="eyebrow">HOTKEY</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            Click and press your new combo to rebind.
          </p>
          <div className="mt-3 flex flex-col items-start gap-2">
            <HotkeyCapture
              value={combo || defaultCombo}
              onChange={applyHotkey}
            />
            {comboError && (
              <p className="text-[12px] text-[var(--accent-warm)]">
                {comboError}
              </p>
            )}
          </div>
        </section>

        {/* ESCHATAIL ENGINE (core key) */}
        <section>
          <div className="flex items-center justify-between">
            <p className="eyebrow">ESCHATAIL ENGINE</p>
            <span className="mono rounded border border-[rgba(255,58,94,0.45)] px-1.5 py-0.5 text-[8.5px] tracking-[0.25em] text-[var(--accent-2)]">
              SAFEGUARDED OPEN BETA
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-[1.6] text-[var(--text-dim)]">
            ASH thinks on the{" "}
            <span className="font-semibold text-[var(--accent)]">ESCHATAIL</span>{" "}
            model — an intelligence judged too strong for public release, now
            running in a safeguarded beta. Core reasoning routes through your
            Anthropic key.{" "}
            {keyPresent
              ? demoMode
                ? "Demo mode is active — save the core key to go live."
                : "Core engine connected."
              : "No core key yet — ASH is in demo mode."}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              placeholder="sk-ant-…"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="glass-frost focus-ring h-9 flex-1 rounded-full bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-[var(--text-faint)]"
            />
            <button
              disabled={saving || !apiKey.trim()}
              onClick={saveKey}
              className="focus-ring rounded-full bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--canvas)] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : keyPresent ? "Replace" : "Save"}
            </button>
          </div>
          {savedMsg && (
            <p className="mt-2 text-[12px] text-[var(--accent)]">{savedMsg}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={() => setDemoMode(!demoMode)}
              className="focus-ring text-[12px] text-[var(--text-dim)] underline-offset-2 hover:text-white hover:underline"
            >
              {demoMode ? "Disable demo mode" : "Force demo mode"}
            </button>
            {keyPresent && (
              <button
                onClick={removeKey}
                disabled={removingKey}
                className="focus-ring inline-flex items-center gap-1 text-[12px] text-[var(--accent-warm)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                <KeyRound size={11} />
                {removingKey ? "Removing…" : "Remove API key"}
              </button>
            )}
          </div>
        </section>

        {/* BRAIN HIVE */}
        <section>
          <p className="eyebrow">BRAIN HIVE</p>
          <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--text-dim)]">
            Every model you connect joins ASH's Brain Hive and boosts Eschatail.{" "}
            <span className="text-white">
              Connect them all for maximum hive activity.
            </span>
          </p>
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="mono tracking-[0.2em] text-[var(--text-faint)]">
                HIVE ACTIVITY
              </span>
              <span className="font-semibold text-[var(--accent)]">
                {hiveActivity}% · {hiveConnected}/{hiveTotal} nodes
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              {[keyPresent, openaiPresent, ...EXTRA_NODES.map((n) => !!nodePresent[n.id])].map(
                (on, idx) => (
                  <span
                    key={idx}
                    className={
                      "h-2.5 w-2.5 rounded-full transition-all duration-500 " +
                      (on ? "breathe" : "")
                    }
                    style={{
                      background: on ? "var(--accent)" : "rgba(255,255,255,0.12)",
                      color: "var(--accent)",
                    }}
                  />
                ),
              )}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: hiveActivity + "%",
                  background: "linear-gradient(90deg,#FF3A5E,#FFD27F)",
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-faint)]">
              {hiveConnected <= 1
                ? "Hive waking — add more models to amplify Eschatail."
                : hiveConnected >= hiveTotal
                  ? "Full hive online. Eschatail at peak boost."
                  : "Eschatail boost rising. Add the rest to max it out."}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {EXTRA_NODES.map((n) => {
              const on = !!nodePresent[n.id];
              return (
                <div
                  key={n.id}
                  className={
                    "rounded-xl border px-3 py-2 " +
                    (on
                      ? "border-[rgba(255,210,127,0.3)] bg-[rgba(255,210,127,0.05)]"
                      : "border-white/[0.08]")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (on ? "bg-[var(--accent)]" : "bg-white/20")
                        }
                      />
                      <span className="text-[12.5px] font-semibold text-white">
                        {n.label}
                      </span>
                    </div>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10.5px] text-[var(--text-faint)] underline-offset-2 hover:text-white hover:underline"
                    >
                      key →
                    </a>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      placeholder={on ? "•••• replace" : "paste API key"}
                      value={nodeInput[n.id] || ""}
                      onChange={(e) =>
                        setNodeInput((s) => ({ ...s, [n.id]: e.target.value }))
                      }
                      className="glass-frost focus-ring h-8 flex-1 rounded-full bg-transparent px-3 text-[12px] text-white outline-none placeholder:text-[var(--text-faint)]"
                    />
                    <button
                      disabled={nodeBusy === n.id || !(nodeInput[n.id] || "").trim()}
                      onClick={() => saveNode(n.id)}
                      className="focus-ring rounded-full bg-[var(--accent)] px-3 text-[11px] font-semibold text-[var(--canvas)] hover:opacity-90 disabled:opacity-40"
                    >
                      {nodeBusy === n.id ? "…" : on ? "Replace" : "Connect"}
                    </button>
                    {on && (
                      <button
                        onClick={() => removeNode(n.id)}
                        className="focus-ring rounded-full border border-white/10 px-2 text-[11px] text-[var(--accent-warm)] hover:bg-white/5"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {nodeMsg[n.id] && (
                    <p className="mt-1 text-[11px] text-[var(--accent)]">
                      {nodeMsg[n.id]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-[var(--text-faint)]">
            Anthropic (core) and OpenAI (voice) also count toward the hive. Keys
            are stored in your OS keychain and never leave the device.
          </p>
        </section>

        {/* CHAT BACKEND */}
        <section>
          <p className="eyebrow">CHAT BACKEND</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            Where ASH thinks. Anthropic is cloud-hosted Claude. Ollama runs a
            local model on your machine — no key, no network, free.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              {
                value: "anthropic" as ChatProvider,
                label: "Anthropic",
                hint: "Claude — needs API key, smarter, costs $",
              },
              {
                value: "ollama" as ChatProvider,
                label: "Ollama (local)",
                hint: "Runs on your machine, free, no network",
              },
            ]).map(({ value, label, hint }) => {
              const active = chatProvider === value;
              return (
                <button
                  key={value}
                  onClick={() => setChatProvider(value)}
                  className={
                    "focus-ring flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors " +
                    (active
                      ? "border-[var(--accent)] bg-[rgba(255,210,127,0.08)]"
                      : "border-white/[0.08] hover:border-white/20")
                  }
                >
                  <span className="text-[13px] font-semibold text-white">
                    {label}
                  </span>
                  <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                    {hint}
                  </p>
                </button>
              );
            })}
          </div>

          {chatProvider === "ollama" && (
            <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="glass-frost focus-ring mt-1.5 h-9 w-full rounded-full bg-transparent px-3 text-[12.5px] text-white outline-none placeholder:text-[var(--text-faint)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Model
                  </label>
                  <button
                    onClick={probeOllama}
                    disabled={ollamaProbing}
                    className="focus-ring inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)] underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
                  >
                    <RefreshCw size={10} />
                    {ollamaProbing ? "Checking…" : "Refresh"}
                  </button>
                </div>
                {ollamaModels && ollamaModels.length > 0 ? (
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="glass-frost focus-ring mt-1.5 h-9 w-full rounded-full bg-transparent px-3 text-[12.5px] text-white outline-none"
                  >
                    {ollamaModels.map((m) => (
                      <option key={m} value={m} className="bg-[var(--canvas)]">
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="llama3.2"
                    className="glass-frost focus-ring mt-1.5 h-9 w-full rounded-full bg-transparent px-3 text-[12.5px] text-white outline-none placeholder:text-[var(--text-faint)]"
                  />
                )}
              </div>

              {ollamaError && (
                <p className="text-[11.5px] leading-[1.55] text-[var(--accent-warm)]">
                  {ollamaError}
                  <br />
                  <span className="text-[var(--text-dim)]">
                    Try:{" "}
                    <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10.5px]">
                      brew install ollama && ollama serve
                    </code>
                  </span>
                </p>
              )}
              {ollamaModels && ollamaModels.length === 0 && (
                <p className="text-[11.5px] leading-[1.55] text-[var(--text-dim)]">
                  Ollama is running but you haven't pulled any models. Try:{" "}
                  <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10.5px]">
                    ollama pull llama3.2
                  </code>
                </p>
              )}
              {ollamaModels && ollamaModels.length > 0 && !ollamaError && (
                <p className="text-[11.5px] text-[var(--accent)]">
                  ● Connected — {ollamaModels.length} model
                  {ollamaModels.length === 1 ? "" : "s"} available
                </p>
              )}
            </div>
          )}
        </section>

        {/* PERSONALITY */}
        <section>
          <p className="eyebrow">PERSONALITY</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            How ASH phrases himself. The 1–10 sentence rule applies in all
            modes.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PERSONALITIES.map(({ value, label, hint }) => {
              const active = personality === value;
              return (
                <button
                  key={value}
                  onClick={() => setPersonality(value)}
                  className={
                    "focus-ring flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors " +
                    (active
                      ? "border-[var(--accent)] bg-[rgba(255,210,127,0.08)]"
                      : "border-white/[0.08] hover:border-white/20")
                  }
                >
                  <span className="text-[13px] font-semibold text-white">
                    {label}
                  </span>
                  <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                    {hint}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* VOICE */}
        <section>
          <p className="eyebrow">VOICE</p>

          {/* Output — speech synthesis */}
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            Have ASH read his answers aloud. Uses your OS's built-in voice;
            higher-quality ElevenLabs lands in a follow-up.
          </p>
          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (voiceEnabled && typeof window !== "undefined") {
                window.speechSynthesis?.cancel();
              }
            }}
            className={
              "focus-ring mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition-colors " +
              (voiceEnabled
                ? "bg-[rgba(255,210,127,0.12)] text-[var(--accent)]"
                : "border border-white/10 text-[var(--text-dim)] hover:bg-white/5")
            }
          >
            {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {voiceEnabled ? "Speak responses (on)" : "Speak responses (off)"}
          </button>

          {/* Input — OpenAI Whisper */}
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="text-[12.5px] font-semibold text-white">
              Voice input
            </p>
            <p className="mt-1 text-[12px] leading-[1.55] text-[var(--text-dim)]">
              Hold the mic button on the input pill to dictate. ASH routes
              audio through OpenAI Whisper{" "}
              <span className="text-[var(--text-faint)]">
                (~$0.006 / minute)
              </span>
              . Paste an OpenAI key below — stored in the OS keychain,
              separate from your Anthropic key.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                placeholder={openaiPresent ? "•••• replace key" : "sk-…"}
                value={openaiInput}
                onChange={(e) => setOpenaiInput(e.target.value)}
                className="glass-frost focus-ring h-9 flex-1 rounded-full bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-[var(--text-faint)]"
              />
              <button
                disabled={openaiSaving || !openaiInput.trim()}
                onClick={saveOpenAIKey}
                className="focus-ring rounded-full bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--canvas)] hover:opacity-90 disabled:opacity-50"
              >
                {openaiSaving ? "Saving…" : openaiPresent ? "Replace" : "Save"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11.5px]">
              <span
                className={
                  openaiPresent
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-faint)]"
                }
              >
                {openaiPresent ? "● Connected" : "○ Not connected"}
              </span>
              {openaiPresent && (
                <button
                  onClick={removeOpenAIKey}
                  className="focus-ring text-[var(--accent-warm)] underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              )}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--text-dim)] underline-offset-2 hover:text-white hover:underline"
              >
                Get a key →
              </a>
            </div>
            {openaiMsg && (
              <p className="mt-2 text-[12px] text-[var(--accent)]">
                {openaiMsg}
              </p>
            )}
          </div>
        </section>

        {/* QUALITY */}
        <section>
          <p className="eyebrow">QUALITY</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            ASH's mascot is procedural — drop the tier on weaker hardware
            or to save battery.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TIERS.map(({ value, label, hint }) => {
              const active = qualityTier === value;
              return (
                <button
                  key={value}
                  onClick={() => setQualityTier(value)}
                  className={
                    "focus-ring flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors " +
                    (active
                      ? "border-[var(--accent)] bg-[rgba(255,210,127,0.08)]"
                      : "border-white/[0.08] hover:border-white/20")
                  }
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                    {active && <Sparkles size={11} className="text-[var(--accent)]" />}
                    {label}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                    {hint}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* DATA */}
        <section>
          <p className="eyebrow">DATA</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
            {messageCount} message{messageCount === 1 ? "" : "s"} in this
            session, {historyCount} archived session
            {historyCount === 1 ? "" : "s"}. All stored locally.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={wipeHistory}
              className={
                "focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] " +
                (confirmHistoryWipe
                  ? "bg-[var(--accent-warm)] text-white"
                  : "border border-white/10 text-[var(--text-dim)] hover:bg-white/5")
              }
            >
              <Trash2 size={11} />
              {confirmHistoryWipe ? "Click again to confirm" : "Wipe history"}
            </button>
            <button
              onClick={resetOnboarding}
              className={
                "focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] " +
                (confirmReset
                  ? "bg-[var(--accent-warm)] text-white"
                  : "border border-white/10 text-[var(--text-dim)] hover:bg-white/5")
              }
            >
              <RefreshCw size={11} />
              {confirmReset ? "Click again to confirm" : "Reset onboarding"}
            </button>
          </div>
        </section>

        {/* ABOUT */}
        <section>
          <p className="eyebrow">ABOUT</p>
          <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--text-dim)]">
            ASH v0.1 — desktop instance of the ESCHATAIL AGI.
            <br />
            Safeguarded open beta · powered by your Brain Hive.
          </p>
        </section>

        <section className="pt-2">
          <button
            onClick={quitApp}
            className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-[var(--accent-warm)] hover:bg-white/5"
          >
            <LogOut size={12} />
            Quit ASH
          </button>
        </section>
      </div>
    </div>
  );
}
