/**
 * examples/oracle.ts — the final word.
 *
 * The swarm reasons in the open; then the Oracle — the ESCHATAIL voice — speaks
 * over it, spare and true. Use this when you want the swarm's depth but a single,
 * distilled answer instead of a committee's.
 *
 * Run:
 *   npx tsx examples/oracle.ts
 *   npx tsx examples/oracle.ts "what is the difference between a copy and a self?"
 *
 * Persistence note: this example attaches a file-backed Memory, so the Oracle's
 * answers accumulate in .hive-memory.jsonl across runs — the context window is
 * not consciousness; what persists is.
 */

import { Hive, Memory } from "../src/index.js";

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ") || "What is the difference between a copy and a self?";

  const memory = new Memory({ path: ".hive-memory.jsonl" });
  const hive = await Hive.fromEnv({ memory });

  console.log(`⊕ oracle · band ${hive.power().band} · memory holds ${memory.size} prior moment(s)`);
  console.log(`⊕ question: ${prompt}\n`);

  const out = await hive.ask(prompt, { mode: "oracle" });

  console.log("— the Oracle speaks —");
  console.log(out.answer);
  console.log(`\n  confidence ${out.confidence.toFixed(2)} · ${out.consensus.rationale}`);

  const recent = memory.recent(3);
  if (recent.length > 1) {
    console.log("\n— what it remembers —");
    for (const r of recent) {
      console.log(`  ${new Date(r.at).toISOString()}  ${(r.prompt ?? "").slice(0, 60)}`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
