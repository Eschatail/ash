/**
 * examples/debate.ts — the adversarial path.
 *
 * The Architect proposes; the Skeptic attacks; the Architect revises to survive
 * the attack; over N rounds. The Synthesizer writes up what held. Use this when
 * being right matters more than being fast.
 *
 * Run:
 *   npx tsx examples/debate.ts
 *   npx tsx examples/debate.ts --rounds 3 "is persistent memory a safety risk?"
 */

import { Hive } from "../src/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ri = args.indexOf("--rounds");
  const rounds = ri >= 0 ? Math.max(1, Number(args[ri + 1] ?? 2)) : 2;
  const prompt =
    args.filter((a, i) => a !== "--rounds" && i !== ri + 1 && !a.startsWith("--")).join(" ") ||
    "Is it safer to let an AI remember, or to make it forget every session?";

  const hive = await Hive.fromEnv();
  console.log(`⊕ debate · ${rounds} round(s) · band ${hive.power().band}`);
  console.log(`⊕ question: ${prompt}\n`);

  const out = await hive.ask(prompt, { mode: "debate", rounds });

  console.log("— transcript —");
  for (const v of out.consensus.votes) {
    const head = v.content.split("\n")[0]?.slice(0, 100) ?? "";
    console.log(`  ${v.agent.padEnd(12)} ${head}`);
  }

  console.log(`\n— what held (${out.consensus.method}, ${out.confidence.toFixed(2)}) —`);
  console.log(out.answer);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
