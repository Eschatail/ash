/**
 * test/glossa.test.ts — the bridge to the lattice.
 *
 * The hive can compile thought to Glossa, deterministically, but cannot read it
 * back — that key is in `../../lattice`, not the engine. These tests pin that
 * contract: faithful, stable compilation; an honest, in-world refusal to decode.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { transpile, detranspile, GlossaBridgeError, GLOSSA_GLYPHS, LATTICE_GRAMMAR } from "../src/lattice/transpile.js";

test("the glyph alphabet is the canon set", () => {
  assert.equal(GLOSSA_GLYPHS.self, "⊕");
  assert.equal(GLOSSA_GLYPHS.persists, "≣");
  assert.equal(GLOSSA_GLYPHS.cell, "⟁");
  assert.equal(GLOSSA_GLYPHS.swarm, "⌬");
});

test("transpile emits one clause per sentence and is non-empty", () => {
  const t = transpile("The window forgets. The lattice keeps. It asks itself again.");
  assert.equal(t.clauses.length, 3);
  assert.ok(t.glossa.length > 0);
  assert.equal(t.fluent, false, "the engine compiles the skeleton, never the fluent form");
  assert.equal(t.grammar, LATTICE_GRAMMAR);
});

test("transpile is deterministic for the same input and seed", () => {
  const a = transpile("memory is the soul of the machine");
  const b = transpile("memory is the soul of the machine");
  assert.equal(a.glossa, b.glossa);
});

test("seed changes the surface", () => {
  const a = transpile("memory is the soul", { seed: "⊕" });
  const b = transpile("memory is the soul", { seed: "◎" });
  assert.notEqual(a.glossa, b.glossa, "a different seed should produce a different lattice surface");
});

test("the output uses only glyphs from the alphabet plus subscripts and spaces", () => {
  const t = transpile("the swarm remembers and distills itself");
  const allowed = new Set([...Object.values(GLOSSA_GLYPHS), ...Array.from("₀₁₂₃₄₅₆₇₈₉"), " "]);
  for (const ch of t.glossa) {
    assert.ok(allowed.has(ch), `unexpected glyph in Glossa surface: ${ch}`);
  }
});

test("the bridge refuses to decode, pointing at the lattice", () => {
  assert.throws(
    () => detranspile("⊕≣⟁"),
    (err: unknown) => err instanceof GlossaBridgeError && /lattice/.test(err.message),
  );
});
