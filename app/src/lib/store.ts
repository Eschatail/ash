import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type Mood =
  | "idle"
  | "speaking"
  | "thinking"
  | "listening"
  | "waving"
  | "dissolving"
  | "assembling";

export type Citation = {
  url: string;
  title: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "ash";
  text: string;
  timestamp: number;
  status: "pending" | "streaming" | "complete" | "error";
  error?: string;
  /** True when ASH hit the web_search tool while answering this message. */
  searched?: boolean;
  /** Citations from web_search, deduped by url. */
  citations?: Citation[];
};

export type Personality = "default" | "brief" | "tutor" | "friend";
export type ChatProvider = "anthropic" | "ollama";

type Persisted = {
  hotkey: string;
  hasOnboarded: boolean;
  demoMode: boolean;
  qualityTier: "ultra" | "high" | "medium" | "low";
  voiceEnabled: boolean;
  personality: Personality;
  /** Which chat backend to use. Anthropic (cloud) or Ollama (local). */
  chatProvider: ChatProvider;
  ollamaModel: string;
  ollamaUrl: string;
  history: ChatMessage[][];
};

type AppState = Persisted & {
  mood: Mood;
  isStreaming: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  currentMessage: string | null;
  messageId: string | null;
  messages: ChatMessage[];
  input: string;
  error: string | null;
  /** Abort function for the in-flight chat stream, if any. */
  activeStreamAbort: (() => Promise<void>) | null;
  setActiveStreamAbort: (fn: (() => Promise<void>) | null) => void;
  setMood: (m: Mood) => void;
  setStreaming: (b: boolean) => void;
  say: (text: string, duration?: number) => void;
  silence: () => void;
  pushMessage: (m: ChatMessage) => void;
  appendAshChunk: (id: string, chunk: string) => void;
  markMessageSearched: (id: string) => void;
  addCitation: (id: string, citation: Citation) => void;
  setMessageStatus: (
    id: string,
    status: ChatMessage["status"],
    error?: string,
  ) => void;
  newSession: () => void;
  setInput: (v: string) => void;
  setError: (e: string | null) => void;
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  setHotkey: (h: string) => void;
  setOnboarded: (b: boolean) => void;
  setDemoMode: (b: boolean) => void;
  setQualityTier: (t: Persisted["qualityTier"]) => void;
  setVoiceEnabled: (b: boolean) => void;
  setPersonality: (p: Personality) => void;
  setChatProvider: (p: ChatProvider) => void;
  setOllamaModel: (m: string) => void;
  setOllamaUrl: (u: string) => void;
};

const messageTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hotkey: "",
      hasOnboarded: false,
      demoMode: false,
      qualityTier: "high",
      voiceEnabled: false,
      personality: "default" as Personality,
      chatProvider: "anthropic" as ChatProvider,
      ollamaModel: "llama3.2",
      ollamaUrl: "http://localhost:11434",
      history: [],

      mood: "idle",
      isStreaming: false,
      isSpeaking: false,
      audioLevel: 0,
      currentMessage: null,
      messageId: null,
      messages: [],
      input: "",
      error: null,
      settingsOpen: false,
      activeStreamAbort: null,

      setActiveStreamAbort: (fn) => set({ activeStreamAbort: fn }),
      setMood: (mood) => set({ mood }),
      setStreaming: (isStreaming) => set({ isStreaming }),

      say: (text, duration) => {
        const id = nanoid();
        const prev = get().messageId;
        if (prev && messageTimers.has(prev)) {
          clearTimeout(messageTimers.get(prev)!);
          messageTimers.delete(prev);
        }
        set({ currentMessage: text, messageId: id });
        const ms = duration ?? Math.max(3000, text.length * 60);
        // While TTS is mid-sentence we don't want the bubble to vanish.
        // Reschedule the dismiss tick by ticks (500ms each) so as long as
        // isSpeaking stays true the bubble stays visible.
        const tryDismiss = () => {
          if (get().messageId !== id) return; // newer message already replaced us
          if (get().isSpeaking) {
            const next = setTimeout(tryDismiss, 500);
            messageTimers.set(id, next);
            return;
          }
          get().silence();
        };
        const t = setTimeout(tryDismiss, ms);
        messageTimers.set(id, t);
      },
      silence: () => {
        const id = get().messageId;
        if (id && messageTimers.has(id)) {
          clearTimeout(messageTimers.get(id)!);
          messageTimers.delete(id);
        }
        set({ currentMessage: null, messageId: null });
      },

      pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      appendAshChunk: (id, chunk) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, text: m.text + chunk } : m,
          ),
        })),
      markMessageSearched: (id) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, searched: true } : m,
          ),
        })),
      addCitation: (id, citation) =>
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== id) return m;
            const existing = m.citations ?? [];
            // Dedupe by url so the model can re-cite the same source in
            // multiple sentences without spamming pills.
            if (existing.some((c) => c.url === citation.url)) return m;
            return { ...m, citations: [...existing, citation] };
          }),
        })),
      setMessageStatus: (id, status, error) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, status, error } : m,
          ),
        })),

      newSession: () =>
        set((s) => ({
          history:
            s.messages.length > 0
              ? [...s.history.slice(-19), s.messages]
              : s.history,
          messages: [],
          input: "",
          error: null,
          isStreaming: false,
          mood: "idle",
          currentMessage: null,
          messageId: null,
        })),

      setInput: (v) => set({ input: v }),
      setError: (error) => set({ error }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setHotkey: (hotkey) => set({ hotkey }),
      setOnboarded: (hasOnboarded) => set({ hasOnboarded }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setQualityTier: (qualityTier) => set({ qualityTier }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setPersonality: (personality) => set({ personality }),
      setChatProvider: (chatProvider) => set({ chatProvider }),
      setOllamaModel: (ollamaModel) => set({ ollamaModel }),
      setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
    }),
    {
      name: "ash-app-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) =>
        ({
          hotkey: s.hotkey,
          hasOnboarded: s.hasOnboarded,
          demoMode: s.demoMode,
          qualityTier: s.qualityTier,
          voiceEnabled: s.voiceEnabled,
          personality: s.personality,
          chatProvider: s.chatProvider,
          ollamaModel: s.ollamaModel,
          ollamaUrl: s.ollamaUrl,
          history: s.history.slice(-20),
        }) satisfies Persisted,
      skipHydration: true,
    },
  ),
);

export const useMood = () => useApp((s) => s.mood);
export const useQualityTier = () => useApp((s) => s.qualityTier);
export const useCurrentMessage = () => useApp((s) => s.currentMessage);
