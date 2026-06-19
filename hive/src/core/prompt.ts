/**
 * @module core/prompt
 *
 * Prompt construction. The hive keeps its prompts small, explicit, and honest.
 * No hidden jailbreaks, no padding. An agent's charter is a `system` message;
 * memory and history precede the live `user` turn.
 */

import type { Message, Task } from "./types.js";

/** Build a `system` message from a charter plus any task-level framing. */
export function systemMessage(charter: string, taskSystem?: string): Message {
  const content = taskSystem ? `${charter.trim()}\n\n${taskSystem.trim()}` : charter.trim();
  return { role: "system", content };
}

/**
 * Assemble the message array for an agent: charter → history → the live prompt.
 * History is clamped so a long memory never blows the context window.
 */
export function buildMessages(
  charter: string,
  task: Task,
  opts: { historyLimit?: number } = {},
): Message[] {
  const messages: Message[] = [systemMessage(charter, task.system)];
  const limit = opts.historyLimit ?? 16;
  const history = (task.history ?? []).slice(-limit);
  for (const m of history) messages.push(m);
  messages.push({ role: "user", content: task.prompt });
  return messages;
}

/**
 * Render a set of candidate answers into a numbered block a synthesizer or
 * skeptic can reason over. Used by consensus and debate.
 */
export function renderCandidates(candidates: readonly { label: string; content: string }[]): string {
  return candidates
    .map((c, i) => `### Candidate ${i + 1} — ${c.label}\n${c.content.trim()}`)
    .join("\n\n");
}

/** Squeeze whitespace and trim — vendors charge for every token. */
export function compact(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Estimate token count cheaply (~4 chars/token). Good enough for clamping. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
