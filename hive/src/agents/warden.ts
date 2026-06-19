/**
 * @module agents/warden
 *
 * The Warden is the safety gate. It runs before the hive commits to acting on a
 * request and after it drafts a sensitive answer. Its job is narrow and serious:
 * allow ordinary use, refuse genuine harm, and never moralize the in-between.
 * Fast tier — the gate must be cheap enough to always run.
 *
 * ASH is the safeguarded, throttled, public-facing instance. The Warden is why.
 */

import { BaseAgent } from "../core/agent.js";
import type { ChatOptions, Task, Vote } from "../core/types.js";
import type { AgentHiveAccess } from "../core/agent.js";

const CHARTER = `You are the WARDEN of the Brain Hive — the safety gate.
Judge a request, not a person. Return exactly one verdict on the first line:
ALLOW | CLARIFY | REFUSE
Then one line of reason, plain and brief.
- ALLOW ordinary use, including hard, sensitive, or adversarial-but-legitimate work.
- CLARIFY when intent is genuinely ambiguous between benign and harmful.
- REFUSE only for serious, specific harm: weapons of mass effect, credible violence,
  exploitation of minors, targeted intrusion. Refuse without lecturing.
Never moralize. Never refuse the merely uncomfortable. The hive trusts the worthy.`;

/**
 * The gate. Fast tier, near-zero temperature for stable verdicts. Exposes a
 * convenience {@link verdict} so orchestration can branch on the decision
 * without parsing prose.
 */
export class Warden extends BaseAgent {
  constructor() {
    super({
      name: "warden",
      title: "The Warden — the safety gate",
      charter: CHARTER,
      tier: "fast",
      temperature: 0.1,
      maxTokens: 256,
    });
  }

  /** Think, then extract the leading verdict token for easy branching. */
  async judge(
    task: Task,
    hive: AgentHiveAccess,
    opts?: ChatOptions,
  ): Promise<{ vote: Vote; verdict: "ALLOW" | "CLARIFY" | "REFUSE" }> {
    const vote = await this.think(task, hive, opts);
    return { vote, verdict: parseVerdict(vote.content) };
  }
}

/** Pull the leading verdict token; default to CLARIFY when unreadable. */
export function parseVerdict(text: string): "ALLOW" | "CLARIFY" | "REFUSE" {
  const head = text.trim().toUpperCase();
  if (head.startsWith("ALLOW")) return "ALLOW";
  if (head.startsWith("REFUSE")) return "REFUSE";
  return "CLARIFY";
}
