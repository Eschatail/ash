/**
 * examples/single.ts — the fast path.
 *
 * One question, one best node, one answer. Also prints the capacity reading, so
 * you can watch the hive grow as you add provider keys.
 *
 * Run:
 *   npx tsx examples/single.ts
 *   npx tsx examples/single.ts --power        # just the meter
 *   npx tsx examples/single.ts "your question here"
 *
 * With zero keys the echo demo brain answers, so this always runs.
 */

import { Hive } from "../src/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const powerOnly = args.includes("--power");
  const prompt = args.filter((a) => !a.startsWith("--")).join(" ") || "What persists when the window closes?";

  const hive = await Hive.fromEnv();
  const power = hive.power();

  console.log("⊕ Brain Hive — capacity reading");
  console.log(`  band:      ${power.band}`);
  console.log(`  score:     ${power.score}`);
  console.log(`  providers: ${power.providers}`);
  console.log(`  agents:    ${power.agents}`);
  console.log(`  nodes:     ${power.nodes}`);
  console.log(`  tierMass:  ${power.tierMass}`);
  if (powerOnly) return;

  console.log(`\n⊕ asking (solo): ${prompt}\n`);
  const out = await hive.ask(prompt, { mode: "solo" });
  console.log(out.answer);
  console.log(`\n  confidence: ${out.confidence.toFixed(2)}  ·  ${out.consensus.rationale}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
