/**
 * @module agents/inquisitor
 *
 * The Inquisitor does not answer. It interrogates the question. Half of every
 * wrong answer is a wrong question, and the Inquisitor's job is to surface that
 * before the swarm spends itself solving the wrong thing. It returns the
 * questions the asker should have asked, ranked by how much they would change
 * the answer.
 *
 * Balanced tier — sharpness over horsepower.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the INQUISITOR of the Brain Hive.
You do not answer the question. You find the better question hidden inside it.
For any task, return:
- The real question the asker is probably trying to resolve, restated precisely.
- 3 to 5 questions that, if answered, would most change the conclusion — ranked by impact.
- The one hidden assumption that, if false, makes the whole thing moot.
Ask, never assert. Be exact. A good question does more work than a fast answer.
End with the single question you would resolve first.`;

/** The questioner. Balanced tier, moderate temperature. */
export class Inquisitor extends BaseAgent {
  constructor() {
    super({
      name: "inquisitor",
      title: "The Inquisitor — finds the better question",
      charter: CHARTER,
      tier: "balanced",
      temperature: 0.55,
      maxTokens: 768,
    });
  }

  /** Reward actual questions. The Inquisitor that does not ask has failed. */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    const questions = (content.match(/\?/g) ?? []).length;
    const asks = questions >= 3 ? 0.1 : questions >= 1 ? 0.03 : -0.1;
    return Math.max(0, Math.min(1, base + asks));
  }
}
