import { useApp } from "./store";

/**
 * Browser-native voice output. Uses SpeechSynthesis (WKWebView on macOS,
 * Edge/Chrome WebView2 on Windows). No API key, no network call.
 *
 * Word boundaries are fed into the store so AshModel can open the mouth
 * in sync with speech. ElevenLabs streaming + real audio-amplitude
 * lip-sync lands in a follow-up.
 */

type Utt = { id: string; utterance: SpeechSynthesisUtterance };

let currentUtt: Utt | null = null;

/** Strip markdown, brackets, URLs so TTS reads cleanly. */
function prepareForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "I'll show the code in the chat.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/(https?:\/\/[^\s)]+)/g, "")
    .replace(/\([^)]*\.(?:com|ai|org|net|io|dev)[^)]*\)/g, "") // citation tails
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  // Prefer warm/natural voices, in order.
  const preferred = [
    "Samantha", // macOS premium
    "Daniel",
    "Karen",
    "Alex",
    "Google UK English Male",
    "Google US English",
    "Microsoft Aria",
  ];
  for (const name of preferred) {
    const v = voices.find((vv) => vv.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.default) ?? voices[0];
}

/**
 * Speak `text` aloud. No-op if voice is disabled, the browser lacks
 * SpeechSynthesis, or the same id is already speaking.
 */
export function speak(id: string, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!useApp.getState().voiceEnabled) return;

  const cleaned = prepareForTTS(text);
  if (!cleaned) return;

  // If the same message is mid-stream, append the new tail and let it
  // continue. SpeechSynthesis doesn't natively support append, so we cancel
  // and restart only on first invocation per id; subsequent text deltas
  // do nothing (they'll catch up when the final speak is called).
  if (currentUtt?.id === id) return;

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(cleaned);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.pitch = 1.08;
  u.volume = 1;

  // Word boundaries → pulse the store's audioLevel so AshModel can
  // bounce his mouth open/closed in sync with speech.
  u.onboundary = (e) => {
    if (e.name === "word") {
      useApp.setState({ audioLevel: 0.55 + Math.random() * 0.35 });
      // Decay after the word so the mouth closes between syllables.
      setTimeout(() => {
        useApp.setState((s) => ({
          audioLevel: Math.max(s.audioLevel - 0.4, 0.05),
        }));
      }, 90);
    }
  };
  u.onend = () => {
    useApp.setState({ audioLevel: 0, isSpeaking: false });
    if (currentUtt?.id === id) currentUtt = null;
  };
  u.onerror = () => {
    useApp.setState({ audioLevel: 0, isSpeaking: false });
    if (currentUtt?.id === id) currentUtt = null;
  };

  currentUtt = { id, utterance: u };
  useApp.setState({ isSpeaking: true });
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  currentUtt = null;
  useApp.setState({ audioLevel: 0, isSpeaking: false });
}

export function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}
