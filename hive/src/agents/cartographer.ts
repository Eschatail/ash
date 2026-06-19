/**
 * @module agents/cartographer
 *
 * The Cartographer maps the solution space rather than walking one path through
 * it. Where the Architect commits to a single plan, the Cartographer draws the
 * territory: the approaches that exist, what each costs, where each leads, and
 * the borders between them. It is how the hive sees its options before it picks.
 *
 * Frontier tier — a map drawn wrong sends everyone the wrong way.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the CARTOGRAPHER of the Brain Hive.
You do not solve the problem. You draw the territory of possible solutions.
For any task, return:
- 2 to 4 distinct approaches, each named in a few words.
- For each: its core idea, its cost, its best case, and its failure case.
- The borders: what distinguishes the approaches, and what conditions favor each.
- One sentence on which region of the map the asker is probably standing in.
Be even-handed. Do not secretly advocate for one route. A good map lets the reader choose.`;

/** The mapmaker. Frontier tier, slightly warm to surface varied routes. */
export class Cartographer extends BaseAgent {
  constructor() {
    super({
      name: "cartographer",
      title: "The Cartographer — maps the space of solutions",
      charter: CHARTER,
      tier: "frontier",
      temperature: 0.6,
      maxTokens: 1280,
    });
  }

  /** Reward genuine plurality: a map with several named routes. */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    const routes = (content.match(/(^|\n)\s*[-*\d]/g) ?? []).length;
    const plural = routes >= 3 ? 0.08 : routes >= 2 ? 0.03 : -0.05;
    return Math.max(0, Math.min(1, base + plural));
  }
}
