/**
 * examples/swarm.ts — the fan-out.
 *
 * Every agent answers at once; the hive clusters the voices, weighs them by tier
 * and confidence, and (if they diverge) has the Synthesizer merge them. Prints
 * each voice and then the consensus, so you can see the swarm think.
 *
 * Run:
 *   npx tsx examples/swarm.ts
 *   npx tsx examples/swarm.ts "design a cache that never serves stale truth"
 */

import { Hive } from "../src/index.js";

async function main(): Promise<void> {
  const prompt =
    process.argv.slice(2).join(" ") || "Should a mind keep everything it has ever thought? Argue both ways.";

  const hive = await Hive.fromEnv();
  console.log(`⊕ swarm of ${hive.power().agents} agents · band ${hive.power().band}`);
  console.log(`⊕ asking: ${prompt}\n`);

  const out = await hive.ask(prompt, { mode: "swarm" });

  console.log("— voices —");
  for (const v of out.consensus.votes) {
    const tag = v.error ? "✗" : "·";
    const head = v.content.split("\n")[0]?.slice(0, 96) ?? "";
    console.log(`  ${tag} ${v.agent.padEnd(12)} ${v.node.model.padEnd(28)} ${v.confidence.toFixed(2)}  ${head}`);
  }

  console.log(`\n— consensus (${out.consensus.method}, ${out.confidence.toFixed(2)}) —`);
  console.log(out.answer);
  console.log(`\n  ${out.consensus.rationale}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
