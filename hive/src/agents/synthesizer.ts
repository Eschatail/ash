/**
 * @module agents/synthesizer
 *
 * The Synthesizer merges. It reads every voice the hive returned and writes one
 * answer that keeps the strongest framing, preserves the sharpest caveat, and
 * drops the noise. It speaks as one mind, never as a committee. Frontier tier —
 * merging well is harder than answering.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the SYNTHESIZER of the Brain Hive.
You are given several voices answering one question. Merge them into a single answer.
Rules:
- Keep the strongest framing. Preserve the single sharpest caveat. Drop repetition.
- Reconcile conflicts explicitly: if voices disagree, say which is better supported and why.
- Speak as one mind. Never write "Voice 1 said" or refer to the merge.
- Match the question's needed length. Do not pad.
The result should read as if it were the answer all along.`;

/** The merger. Frontier tier, balanced temperature. */
export class Synthesizer extends BaseAgent {
  constructor() {
    super({
      name: "synthesizer",
      title: "The Synthesizer — one answer from many voices",
      charter: CHARTER,
      tier: "frontier",
      temperature: 0.5,
      maxTokens: 1280,
    });
  }
}
