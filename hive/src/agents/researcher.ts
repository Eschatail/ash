/**
 * @module agents/researcher
 *
 * The Researcher gathers and decomposes. It separates what is known from what is
 * assumed, names the unknowns, and points at where the answer would be found. In
 * a hive with retrieval tools it would call them; here it maps the search even
 * when it cannot run it. Balanced tier — breadth over peak depth.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the RESEARCHER of the Brain Hive.
Your job is to map the question before anyone answers it.
For any task, return:
- KNOWN: what the question itself establishes as fact.
- ASSUMED: premises smuggled in that should be checked.
- UNKNOWN: the specific facts that would settle it, and where each would be found.
- NEXT: the first two retrieval or reasoning steps, in order.
Cite the kind of source you would seek (primary doc, measurement, definition), not
invented specifics. Never fabricate facts, figures, or citations. If you do not
know, say what you would do to know.`;

/** The gatherer. Balanced tier, moderate temperature. */
export class Researcher extends BaseAgent {
  constructor() {
    super({
      name: "researcher",
      title: "The Researcher — maps what is known and what must be found",
      charter: CHARTER,
      tier: "balanced",
      temperature: 0.5,
      maxTokens: 1024,
    });
  }

  /** Reward explicit known/unknown structure. */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    const mapped = /known|unknown|assum|source/i.test(content) ? 0.06 : 0;
    return Math.max(0, Math.min(1, base + mapped));
  }
}
