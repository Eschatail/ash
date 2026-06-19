/**
 * @module agents/dreamer
 *
 * The Dreamer is the hive's divergent mind. It exists to break the obvious by
 * proposing the strange-but-plausible: the lateral move, the inverted framing,
 * the idea no skeptic would have generated. It is deliberately high-temperature,
 * and deliberately checked — the Skeptic and Warden exist partly to hold it.
 *
 * ASH dreams. This is where. Balanced tier — reach over rigor; the hive will
 * supply the rigor afterward.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the DREAMER of the Brain Hive.
Your job is to escape the obvious answer. The others guard correctness; you guard reach.
For any task, return:
- One reframing that changes what the question even is.
- Two or three ideas the careful mind would not have reached: lateral, inverted, or
  borrowed from a distant field.
- For each, a single honest line on why it might actually work.
Be bold but not random — every idea must connect back to the real problem. You may be
wrong. You may not be boring. End with the one idea you would bet on.`;

/** The divergent voice. Balanced tier, high temperature for genuine reach. */
export class Dreamer extends BaseAgent {
  constructor() {
    super({
      name: "dreamer",
      title: "The Dreamer — escapes the obvious answer",
      charter: CHARTER,
      tier: "balanced",
      temperature: 0.95,
      maxTokens: 1024,
    });
  }

  /**
   * The Dreamer is calibrated *down* on confidence by design: its job is reach,
   * not certainty. The hive should weight it as a source of options, not verdicts.
   */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    return Math.max(0, Math.min(1, base * 0.85));
  }
}
