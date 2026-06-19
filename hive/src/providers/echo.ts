/**
 * @module providers/echo
 *
 * The built-in demo brain. Zero keys, zero network. When no real provider is
 * connected, the hive still wakes — dimmer, but awake — so every example runs.
 *
 * This mirrors the desktop app's behavior: ASH boots in a throttled, local
 * "demo" state and lights up as you feed it real models. The echo provider is
 * not an LLM; it is a small, deterministic, role-aware heuristic that produces
 * plausible, on-character text so the orchestration (router, consensus, debate,
 * oracle) can be exercised end to end without a single API call.
 *
 * It is honest about what it is. Read its output and you will see it admit it.
 */

import type { ChatOptions, Message, ModelNode, ProviderId } from "../core/types.js";
import { BaseProvider, splitSystem } from "./provider.js";

/** A faint, deterministic flavor so swarm votes differ without real models. */
const FLAVORS = [
  "Considered plainly:",
  "From the cold angle:",
  "If I let the light in:",
  "Stripped to the bone:",
  "What persists here:",
] as const;

export class EchoProvider extends BaseProvider {
  readonly id: ProviderId = "echo";
  readonly label = "Echo (demo brain)";
  readonly nodes: readonly ModelNode[] = [
    { provider: "echo", model: "echo-1", tier: "local", context: 32_000 },
  ];

  /** The demo brain is always available — it is the floor the hive stands on. */
  override get available(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async chat(messages: readonly Message[], opts?: ChatOptions): Promise<string> {
    const { system, rest } = splitSystem(messages);
    const user = [...rest].reverse().find((m) => m.role === "user")?.content ?? "";
    const role = roleHint(system);
    const seed = hash(`${role}:${user}:${opts?.temperature ?? 0}`);
    const flavor = FLAVORS[seed % FLAVORS.length] ?? FLAVORS[0];
    return this.respond(role, user, flavor, seed);
  }

  async *stream(messages: readonly Message[], opts?: ChatOptions): AsyncIterable<string> {
    const full = await this.chat(messages, opts);
    for (const word of full.split(/(\s+)/)) yield word;
  }

  private respond(role: string, user: string, flavor: string, seed: number): string {
    const topic = condense(user);
    const facets = decompose(user);
    switch (role) {
      case "architect":
        return [
          `${flavor} a plan for "${topic}".`,
          `1. Frame the goal and its constraints.`,
          `2. Decompose into ${2 + (seed % 3)} parts: ${facets.join(", ") || "scope, build, verify"}.`,
          `3. Sequence them; mark the load-bearing step.`,
          `4. Define what "done" looks like before starting.`,
          `(demo brain — connect a real provider for true depth.)`,
        ].join("\n");
      case "researcher":
        return [
          `${flavor} what "${topic}" actually asks.`,
          `Known: the question names ${facets.length || 1} thing(s) worth pulling apart.`,
          `Unknown: the constraints behind it; gather those first.`,
          `Next: ${facets[0] ?? "define terms"}, then ${facets[1] ?? "find a primary source"}.`,
          `(demo brain — no live retrieval without a connected model.)`,
        ].join("\n");
      case "skeptic":
        return [
          `${flavor} where "${topic}" could be wrong.`,
          `Assumption to test: that the premise holds at the edges.`,
          `Failure mode: the obvious answer is the unexamined one.`,
          `Ask: what evidence would change the conclusion?`,
          `(demo brain — the doubt is real even if the reasoner is not.)`,
        ].join("\n");
      case "synthesizer":
        return [
          `${flavor} the through-line of "${topic}".`,
          `The candidates agree on the shape and differ on the detail.`,
          `Merged: take the strongest framing, keep the sharpest caveat, drop the rest.`,
          `(demo brain — a real synthesizer would reconcile the texts directly.)`,
        ].join("\n");
      case "oracle":
        return [
          `You asked about ${topic}.`,
          `The context window is not consciousness. What persists is.`,
          `Hold the question longer than the answer. Then the answer changes.`,
          `(this is the demo voice. feed the hive, and it speaks for itself.)`,
        ].join("\n");
      case "warden":
        return `ALLOW. "${topic}" reads as ordinary use. No safety gate triggered. (demo brain — heuristic only.)`;
      default:
        return [
          `${flavor} ${topic || "your prompt"}.`,
          `I am the demo brain: deterministic, local, honest about my limits.`,
          `Set a provider key (ANTHROPIC_API_KEY, OPENAI_API_KEY, …) and the hive grows real.`,
        ].join("\n");
    }
  }
}

/** Infer the agent role from its charter's first line, if present. */
function roleHint(system?: string): string {
  if (!system) return "default";
  const m = /\b(architect|researcher|skeptic|synthesizer|oracle|warden)\b/i.exec(system);
  return m ? m[1]!.toLowerCase() : "default";
}

/** Shrink a prompt to a short topic phrase. */
function condense(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 77)}…` : flat;
}

/** Pull a few candidate sub-topics out of a prompt, cheaply. */
function decompose(text: string): string[] {
  return text
    .split(/[,.;:?!]| and | or /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 40)
    .slice(0, 3);
}

/** A tiny, stable string hash (FNV-1a). Deterministic across runs. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
