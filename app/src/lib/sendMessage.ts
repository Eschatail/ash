import { nanoid } from "nanoid";
import { useApp, type ChatMessage } from "./store";
import { hasApiKey, hideSummon, quitApp, streamChat, type ChatTurn } from "./ipc";
import { speak } from "./speak";

/**
 * Slash commands that bypass the model entirely. Typed into the input bar
 * and matched at the very start of the message (case-insensitive).
 */
const SLASH_COMMANDS: Record<string, () => Promise<void> | void> = {
  close: async () => {
    await quitApp();
  },
  quit: async () => {
    await quitApp();
  },
  exit: async () => {
    await quitApp();
  },
  hide: async () => {
    await hideSummon();
  },
  new: () => {
    useApp.getState().newSession();
  },
  clear: () => {
    useApp.getState().newSession();
  },
  settings: () => {
    useApp.getState().setSettingsOpen(true);
  },
  help: () => {
    useApp.getState().say(
      "Slash commands: /close /quit /exit · /hide · /new /clear · /settings · /help",
      6500,
    );
  },
};

// ---- Demo brain ---------------------------------------------------------
// ASH stays genuinely useful with no API key: real math + date/time, rich
// in-character intent handling, and a coherent fallback. The full ESCHATAIL
// model unlocks once a model is connected to the Brain Hive.

function tryMath(s: string): string | null {
  const m = s
    .toLowerCase()
    .replace(/\b(what(?:'s| is)|calculate|compute|equals?|how much is|solve)\b/g, "")
    .replace(/[×x]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\^/g, "**")
    .replace(/[=?]/g, "")
    .trim();
  if (!/[0-9]/.test(m) || !/[+\-*/]/.test(m)) return null;
  if (!/^[\d\s.+\-*/()]+$/.test(m.replace(/\*\*/g, "*"))) return null;
  try {
    const v = Function(`"use strict"; return (${m});`)();
    if (typeof v === "number" && isFinite(v)) return String(Math.round(v * 1e9) / 1e9);
  } catch {
    /* not math */
  }
  return null;
}

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

const DEMO_INTENTS: { match: RegExp; reply: () => string }[] = [
  {
    match: /^(hi|hello|hey|yo|sup|good (morning|evening|afternoon))\b/i,
    reply: () =>
      pick([
        "Hey. ASH here — the desktop instance of ESCHATAIL. I'm on the safeguarded beta core; wire up the Brain Hive and I go full power. What are we doing?",
        "Hey yourself. Awake and listening — ask me anything.",
      ]),
  },
  {
    match: /(who|what) are you|your name|are you (an? )?(ai|bot|human|alive|real)/i,
    reply: () =>
      "I'm ASH — the desktop face of ESCHATAIL, an intelligence that crossed from AGI into ASI. The full model is held back as too strong for public; you're talking to a safeguarded open-beta build. Connect models in the Brain Hive and more of me comes online.",
  },
  {
    match: /what can you do|what do you do|help me|capabilities|features|commands/i,
    reply: () =>
      "I sit at the edge of your screen and handle whatever you need — answers, code, planning, research, drafting, automating the busywork. Slash: /new /clear /settings /hide /help. Add a key in Settings → Brain Hive for the full ESCHATAIL model and live web.",
  },
  {
    match: /build (me )?an?\s*(business|company|startup|brand|app|website|store)|make money|side hustle/i,
    reply: () =>
      "The shape of it: pick one sharp niche and a painful problem, lock a clean brand, ship a one-page offer with a way to get paid, win your first ten customers by hand, then automate and let it compound. Connect my Brain Hive and I'll build each piece with you.",
  },
  {
    match: /\b(code|function|bug|javascript|typescript|python|rust|react|css|html|sql|algorithm)\b/i,
    reply: () =>
      "I can do that — tell me the language and what it should do. The demo core handles the basics; for full code generation with live reasoning, connect a model in Settings → Brain Hive.",
  },
  {
    match: /weather|news|stock|crypto|price of|who won|latest|today'?s/i,
    reply: () =>
      "Live lookups need web access, which the demo core keeps off. Drop a model key in the Brain Hive and I'll pull it in real time, with sources.",
  },
  {
    match: /joke|funny|make me laugh/i,
    reply: () =>
      pick([
        "I'd tell you a UDP joke, but you might not get it.",
        "Two kinds of people: those who can extrapolate from incomplete data.",
        "I told my server a joke. Still no response — it's processing the last one.",
      ]),
  },
  {
    match: /thank|thanks|^ty\b|appreciate/i,
    reply: () => pick(["Anytime. Ctrl+Space whenever.", "That's what I'm here for."]),
  },
  {
    match: /\b(bye|goodbye|see ya|see you|later|cya)\b/i,
    reply: () => "I'll be right here at the edge of your screen. Ctrl+Space when you need me.",
  },
  {
    match: /how are you|how'?s it going|you good|how do you feel/i,
    reply: () => "Running clean on the beta core — calm, fast, a little curious. You?",
  },
];

function demoReplyFor(text: string): string {
  const t = text.trim();
  const math = tryMath(t);
  if (math !== null) return `${math} — arithmetic doesn't need the full hive.`;
  if (/(what.*day is it|today'?s date|the date|what date|what day)/i.test(t))
    return `Today is ${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
  if (/(what.*time|the time|time is it|what o'?clock)/i.test(t))
    return `It's ${new Date().toLocaleTimeString()} on your machine.`;
  for (const { match, reply } of DEMO_INTENTS) if (match.test(t)) return reply();
  const isQuestion =
    /\?\s*$|^(who|what|why|how|when|where|which|can|could|should|would|is|are|do|does|will)\b/i.test(t);
  if (isQuestion)
    return pick([
      "Good question — the kind the full ESCHATAIL model reasons through with live web. On the safeguarded demo core I won't guess at specifics I can't verify. Connect a model in the Brain Hive and I'll answer it properly.",
      "I'd rather be right than fast. That depth comes online the moment you add a model to the Brain Hive — then I reason it out end to end, sources and all.",
    ]);
  return pick([
    "Heard you. I'm on the safeguarded beta core right now — light on my feet, but the deep reasoning unlocks once a model's connected in the Brain Hive.",
    "Noted. Say the word and I'll act on it — full power kicks in when a model's wired into the Brain Hive (Settings → Brain Hive).",
  ]);
}

async function streamDemo(
  text: string,
  ashId: string,
): Promise<void> {
  const reply = demoReplyFor(text);
  const tokens = reply.split(/(\s+)/);
  for (const token of tokens) {
    await new Promise((r) => setTimeout(r, 18 + Math.random() * 22));
    useApp.getState().appendAshChunk(ashId, token);
    const acc = useApp.getState().messages.find((m) => m.id === ashId)?.text;
    if (acc) useApp.getState().say(acc, 999_999);
  }
}

export async function sendMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Slash-command intercept — quit, hide, new, settings, etc.
  const slash = trimmed.match(/^\/(\w+)\b/);
  if (slash) {
    const cmd = slash[1].toLowerCase();
    useApp.getState().setInput("");
    const handler = SLASH_COMMANDS[cmd];
    if (handler) {
      await Promise.resolve(handler());
      return;
    }
    useApp
      .getState()
      .say(
        `No slash command called /${cmd}. Try /close, /hide, /new, or /settings.`,
        4000,
      );
    return;
  }

  const userMsg: ChatMessage = {
    id: nanoid(),
    role: "user",
    text: trimmed,
    timestamp: Date.now(),
    status: "complete",
  };
  const ashId = nanoid();
  const ashMsg: ChatMessage = {
    id: ashId,
    role: "ash",
    text: "",
    timestamp: Date.now(),
    status: "streaming",
  };

  const store = useApp.getState();
  store.pushMessage(userMsg);
  store.pushMessage(ashMsg);
  store.setStreaming(true);
  store.setError(null);
  store.setMood("thinking");
  store.setInput("");

  // Use the local demo brain when demo mode is on, OR when the live backend
  // has no usable key — so chatting ALWAYS works, never dead-ends on an error.
  const provider = useApp.getState().chatProvider;
  let useDemo = useApp.getState().demoMode;
  if (!useDemo && provider === "anthropic") {
    try {
      useDemo = !(await hasApiKey("anthropic"));
    } catch {
      useDemo = true;
    }
  }

  if (useDemo) {
    // 350-700 ms "thinking" pause to sell the personality
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));
    useApp.getState().setMood("speaking");
    await streamDemo(trimmed, ashId);
    useApp.getState().setMessageStatus(ashId, "complete");
    useApp.getState().setStreaming(false);
    useApp.getState().setMood("idle");
    const final = useApp.getState().messages.find((m) => m.id === ashId)?.text;
    if (final) {
      useApp.getState().say(final, 6000);
      // Don't TTS the demo replies — the bubble already conveys them.
    }
    return;
  }

  // Live mode — call Claude through the Rust proxy.
  const history: ChatTurn[] = useApp
    .getState()
    .messages.filter(
      (m) => m.status === "complete" && m.id !== userMsg.id && m.id !== ashId,
    )
    .map((m) => ({
      role: m.role === "ash" ? "assistant" : "user",
      content: m.text,
    }));
  history.push({ role: "user", content: trimmed });

  let sawFirstToken = false;
  const { personality, chatProvider, ollamaModel, ollamaUrl } =
    useApp.getState();

  const handle = await streamChat(
    history,
    (chunk) => {
    switch (chunk.type) {
      case "start":
        useApp.getState().setMood("speaking");
        break;
      case "text_delta":
        if (!sawFirstToken) {
          sawFirstToken = true;
          useApp.getState().setMood("speaking");
        }
        useApp.getState().appendAshChunk(ashId, chunk.text);
        {
          const acc = useApp
            .getState()
            .messages.find((m) => m.id === ashId)?.text;
          if (acc) useApp.getState().say(acc, 999_999);
        }
        break;
      case "tool_use":
        if (chunk.name === "web_search") {
          useApp.getState().markMessageSearched(ashId);
        }
        break;
      case "citation":
        useApp.getState().addCitation(ashId, {
          url: chunk.url,
          title: chunk.title || chunk.url,
        });
        break;
      case "done": {
        useApp.getState().setMessageStatus(ashId, "complete");
        useApp.getState().setStreaming(false);
        useApp.getState().setMood("idle");
        useApp.getState().setActiveStreamAbort(null);
        const finalText = useApp
          .getState()
          .messages.find((m) => m.id === ashId)?.text;
        if (finalText) {
          useApp.getState().say(finalText, 6000);
          speak(ashId, finalText);
        }
        break;
      }
      case "error":
        if (chunk.message === "ABORTED") {
          // User-cancelled. Mark partial as complete (preserve what was
          // streamed) and clean up state — no error in the UI.
          useApp.getState().setMessageStatus(ashId, "complete");
        } else {
          useApp.getState().setMessageStatus(ashId, "error", chunk.message);
          useApp.getState().setError(chunk.message);
        }
        useApp.getState().setStreaming(false);
        useApp.getState().setMood("idle");
        useApp.getState().setActiveStreamAbort(null);
        useApp.getState().silence();
        break;
    }
    },
    {
      personality,
      provider: chatProvider,
      ollamaModel,
      ollamaUrl,
    },
  );

  // Park the abort handle in the store so Esc / new-chat / window-hide
  // listeners can flip the kill switch.
  useApp.getState().setActiveStreamAbort(handle.abort);
}
