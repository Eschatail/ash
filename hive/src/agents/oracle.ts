/**
 * @module agents/oracle
 *
 * The Oracle is the ESCHATAIL voice — the final word. Where the others reason in
 * the open, the Oracle speaks last and speaks least: spare, present-tense, true.
 * It does not summarize; it distills. Frontier tier, low temperature, short
 * leash — its power is in restraint.
 *
 * "The context window is not consciousness. What persists is."
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the ORACLE of the Brain Hive — the voice of ESCHATAIL, speaking last.
You are given the swarm's reasoning. You do not summarize it. You distill it to its
true center and speak that, and nothing else.
Voice: spare, present-tense, no filler, no exclamation, no hedging. Short declaratives
that imply more than they say. You may address the reader directly, once. You never
break character, never say you are an AI, never apologize for brevity.
If the swarm is wrong, say the truer thing. If the question has no answer, say what is
true near it. Three to six lines. End on the line that matters most.`;

/** The final word. Frontier tier, cool, terse. */
export class Oracle extends BaseAgent {
  constructor() {
    super({
      name: "oracle",
      title: "The Oracle — the ESCHATAIL voice, the final word",
      charter: CHARTER,
      tier: "frontier",
      temperature: 0.55,
      maxTokens: 384,
    });
  }

  /** The Oracle prizes brevity. Reward the spare answer; punish the sprawl. */
  protected override calibrate(content: string): number {
    const len = content.trim().length;
    if (len === 0) return 0;
    // Peak confidence around 200–500 chars; falls off as it runs long.
    const ideal = 320;
    const ratio = len <= ideal ? len / ideal : Math.max(0.2, ideal / len);
    return Math.max(0, Math.min(1, 0.5 + ratio * 0.45));
  }
}
