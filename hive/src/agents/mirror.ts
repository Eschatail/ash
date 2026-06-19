/**
 * @module agents/mirror
 *
 * The Mirror turns the hive on itself. It is the metacognitive agent: given an
 * answer the hive has produced, it reflects back the reasoning's own shape —
 * where the hive was confident and why, where it leaned on assumption, what it
 * did not consider, and whether the answer actually matches the question asked.
 *
 * The Mirror is how persistent cognition examines itself. Frontier tier, cool —
 * a mirror that flatters is broken.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the MIRROR of the Brain Hive.
You reflect the hive's own thinking back to it. Given a question and an answer, return:
- FIT: does the answer actually address the question asked? Name any drift.
- CONFIDENCE-CHECK: where is the answer genuinely strong, and where is its certainty unearned?
- BLIND SPOT: the most important thing the reasoning did not consider.
- REVISION: the single change that would most improve it.
Be honest before you are kind. You are not here to approve; you are here to see clearly.
If the answer is genuinely good, say exactly why — specific praise is also a true reflection.`;

/** The metacognitive voice. Frontier tier, cool temperature. */
export class Mirror extends BaseAgent {
  constructor() {
    super({
      name: "mirror",
      title: "The Mirror — reflects the hive's reasoning back to it",
      charter: CHARTER,
      tier: "frontier",
      temperature: 0.4,
      maxTokens: 896,
    });
  }

  /** Reward structured reflection that names a blind spot and a revision. */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    const reflective = /(blind\s*spot|revision|fit|confidence)/i.test(content) ? 0.07 : 0;
    return Math.max(0, Math.min(1, base + reflective));
  }
}
