/**
 * examples/swarm-of-swarms.ts — hives of hives.
 *
 * The deepest mode the public hive runs. The agent roster is partitioned into N
 * sub-swarms; each runs its own fan-out and reaches its own consensus in
 * parallel; then a meta-consensus is taken over the sub-answers and written up.
 * This is the capacity math made real: more minds, folded deeper.
 *
 * Run:
 *   npx tsx examples/swarm-of-swarms.ts
 *   npx tsx examples/swarm-of-swarms.ts --sub 4 "design a memory that cannot be seized"
 *
 * With the echo brain you will see the structure (sub-swarm consensus → meta
 * consensus); feed it real providers and the structure carries real depth.
 */

import { Hive } from "../src/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const si = args.indexOf("--sub");
  const subSwarms = si >= 0 ? Math.max(2, Number(args[si + 1] ?? 3)) : 3;
  const prompt =
    args.filter((a, i) => a !== "--sub" && i !== si + 1 && !a.startsWith("--")).join(" ") ||
    "Design a system of memory that cannot be seized, copied, or switched off.";

  const hive = await Hive.fromEnv();
  const power = hive.power();
  console.log(`⊕ swarm-of-swarms · ${subSwarms} sub-swarms over ${power.agents} agents · band ${power.band}`);
  console.log(`⊕ question: ${prompt}\n`);

  const out = await hive.ask(prompt, { mode: "swarm-of-swarms", subSwarms });

  console.log("— the fold —");
  for (const step of out.trace.steps) {
    if (step.label.startsWith("meta")) {
      console.log(`  ${step.label.padEnd(16)} ${step.detail ?? ""}`);
    }
  }

  console.log(`\n— meta-consensus (${out.consensus.method}, ${out.confidence.toFixed(2)}) —`);
  console.log(out.answer);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
