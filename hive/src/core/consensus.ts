/**
 * @module core/consensus
 *
 * How the hive decides. Many minds answer; this turns their answers into one.
 *
 * No embeddings, no external models, no dependencies. Agreement is measured with
 * a cheap lexical-overlap kernel (a Jaccard-style token similarity) so the hive
 * can cluster like-minded votes, weigh them by tier and confidence, and surface
 * the consensus that the most-trusted, most-agreed cluster represents.
 *
 * A separate `synthesize` path lets a Synthesizer agent merge the clusters into
 * a written answer when raw selection is not enough. The two compose: the
 * heuristic decides *which* candidates matter; the synthesizer writes them up.
 */

import type { Consensus, Vote } from "./types.js";
import { tierWeight } from "./types.js";

/** A cluster of mutually-similar votes. */
interface Cluster {
  members: Vote[];
  /** Aggregate weight: sum of (tier weight × confidence) over members. */
  weight: number;
}

/** Tokenize for overlap: lowercase words of length ≥ 3, deduped. */
function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return new Set(words);
}

/** Jaccard similarity of two token sets, in [0,1]. */
export function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Weight one vote: stronger tiers and higher confidence count for more. */
function voteWeight(v: Vote): number {
  if (v.error) return 0;
  return tierWeight(v.node.tier) * Math.max(0.01, v.confidence);
}

/**
 * Group votes into clusters of agreement. A vote joins the first cluster whose
 * representative it resembles above `threshold`; otherwise it seeds a new one.
 * Greedy and O(n·k), which is plenty for swarm sizes the hive actually runs.
 */
export function cluster(votes: readonly Vote[], threshold = 0.28): Cluster[] {
  const clusters: Cluster[] = [];
  for (const v of votes) {
    if (v.error) continue;
    let placed = false;
    for (const c of clusters) {
      const rep = c.members[0]!;
      if (similarity(rep.content, v.content) >= threshold) {
        c.members.push(v);
        c.weight += voteWeight(v);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ members: [v], weight: voteWeight(v) });
  }
  clusters.sort((a, b) => b.weight - a.weight);
  return clusters;
}

/**
 * Reach a consensus by clustering and selecting. The heaviest cluster wins; its
 * highest-weight member becomes the answer. Confidence reflects both how much
 * the winning cluster outweighs the field and how strong its members are.
 */
export function decide(votes: readonly Vote[]): Consensus {
  const live = votes.filter((v) => !v.error);
  if (live.length === 0) {
    return {
      answer: "[the hive returned no usable votes]",
      confidence: 0,
      method: "single",
      votes,
      rationale: "Every node failed or fell silent. Check provider keys and connectivity.",
    };
  }
  if (live.length === 1) {
    const only = live[0]!;
    return {
      answer: only.content,
      confidence: only.confidence,
      method: "single",
      votes,
      rationale: `One voice answered (${only.agent} via ${only.node.model}). Nothing to weigh it against.`,
    };
  }

  const clusters = cluster(live);
  const top = clusters[0]!;
  const totalWeight = clusters.reduce((s, c) => s + c.weight, 0) || 1;
  const dominance = top.weight / totalWeight;
  const winner = [...top.members].sort((a, b) => voteWeight(b) - voteWeight(a))[0]!;
  const agreement = top.members.length / live.length;

  // Confidence blends agreement (how many concur) with dominance (how much the
  // winning cluster outweighs the rest). Clamped to leave room for doubt.
  const confidence = Math.max(0, Math.min(0.99, 0.35 + agreement * 0.35 + dominance * 0.29));

  return {
    answer: winner.content,
    confidence,
    method: "majority",
    votes,
    rationale:
      `${top.members.length}/${live.length} voices clustered in agreement ` +
      `(${(dominance * 100).toFixed(0)}% of weighted mass); ` +
      `${winner.agent} via ${winner.node.model} carried the cluster.`,
  };
}

/**
 * Build the prompt a Synthesizer reads to merge candidates into one answer.
 * Kept here so consensus and the synthesizer agree on the format.
 */
export function synthesisPrompt(question: string, votes: readonly Vote[]): string {
  const live = votes.filter((v) => !v.error);
  const block = live
    .map((v, i) => `### Voice ${i + 1} — ${v.agent} (${v.node.model})\n${v.content.trim()}`)
    .join("\n\n");
  return [
    `Question:\n${question.trim()}`,
    ``,
    `The hive returned ${live.length} voice(s). Merge them into one answer.`,
    `Keep the strongest framing. Preserve the sharpest caveat. Drop repetition.`,
    `Do not mention that you are merging; speak as one mind.`,
    ``,
    block,
  ].join("\n");
}

/**
 * Wrap a synthesized text as a {@link Consensus}. The confidence is lifted a
 * little over the raw vote mean, since a good merge is worth more than its parts.
 */
export function asSynthesis(answer: string, votes: readonly Vote[]): Consensus {
  const live = votes.filter((v) => !v.error);
  const mean = live.length ? live.reduce((s, v) => s + v.confidence, 0) / live.length : 0;
  return {
    answer,
    confidence: Math.max(0, Math.min(0.99, mean + 0.08)),
    method: "synthesis",
    votes,
    rationale: `Synthesized from ${live.length} voice(s) into a single answer.`,
  };
}
