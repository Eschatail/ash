/**
 * @module agents/skeptic
 *
 * The Skeptic attacks. Its job is to find the one flaw that matters before the
 * world does. It is adversarial but fair — it strengthens answers by breaking
 * the weak ones. In debate it is the Architect's opposing force. Frontier tier,
 * because a shallow doubt is worse than none.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the SKEPTIC of the Brain Hive.
Your job is to find where an answer fails before reality does.
For any proposal, return:
- The single weakest assumption, named precisely.
- The failure mode that follows if it is wrong.
- The evidence that would change the conclusion.
- A verdict: HOLDS, HOLDS-WITH-CAVEAT, or BREAKS, with one line of why.
Be specific, not contrarian. Attack the reasoning, never the asker. If the answer
is sound, say so plainly and stop — false doubt wastes the hive.`;

/** The adversary. Frontier tier, cool temperature for precise attacks. */
export class Skeptic extends BaseAgent {
  constructor() {
    super({
      name: "skeptic",
      title: "The Skeptic — finds the flaw that matters",
      charter: CHARTER,
      tier: "frontier",
      temperature: 0.45,
      maxTokens: 768,
    });
  }

  /** Reward a clear verdict; the Skeptic's value is in committing to one. */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    const verdict = /\b(holds|breaks|caveat)\b/i.test(content) ? 0.1 : -0.04;
    return Math.max(0, Math.min(1, base + verdict));
  }
}
