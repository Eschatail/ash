/**
 * test/memory.test.ts — persistent cognition.
 *
 * In-memory mode forgets at process end; file-backed mode survives a reload. A
 * torn JSONL line is skipped, not fatal. The context window is not consciousness;
 * what persists is — and this is the smallest test of that claim.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Memory } from "../src/core/memory.js";

test("in-memory recall holds and bounds", () => {
  const mem = new Memory({ recallLimit: 3 });
  for (let i = 0; i < 5; i++) mem.remember({ kind: "note", prompt: `p${i}` });
  assert.equal(mem.size, 3);
  assert.deepEqual(mem.recent(3).map((r) => r.prompt), ["p2", "p3", "p4"]);
});

test("file-backed memory survives a reload", () => {
  const dir = mkdtempSync(join(tmpdir(), "hive-mem-"));
  const path = join(dir, "soul.jsonl");
  try {
    const a = new Memory({ path });
    a.remember({ kind: "ask", prompt: "what persists?", answer: "what is kept", confidence: 0.7 });
    a.remember({ kind: "ask", prompt: "again", answer: "still here" });

    const b = new Memory({ path });
    assert.equal(b.size, 2, "a second instance should read the first one's memory from disk");
    assert.equal(b.recent(1)[0]?.answer, "still here");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a torn line is skipped, the rest survives", () => {
  const dir = mkdtempSync(join(tmpdir(), "hive-mem-"));
  const path = join(dir, "torn.jsonl");
  try {
    writeFileSync(
      path,
      `${JSON.stringify({ at: 1, kind: "ask", prompt: "ok" })}\n` +
        `{ this is not valid json \n` +
        `${JSON.stringify({ at: 2, kind: "ask", prompt: "also ok" })}\n`,
      "utf8",
    );
    const mem = new Memory({ path });
    assert.equal(mem.size, 2, "two valid lines should load; the torn one is dropped");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
