# ⊕ The Synthesizer

> One answer from many voices.

| | |
| --- | --- |
| **Role name** | `synthesizer` |
| **Tier** | `frontier` |
| **Temperature** | 0.5 |
| **Code** | [`hive/src/agents/synthesizer.ts`](../hive/src/agents/synthesizer.ts) |

## Charter

Given several voices answering one question, the Synthesizer merges them into a
single answer. It keeps the strongest framing, preserves the single sharpest
caveat, and drops the repetition. It reconciles conflicts explicitly — if voices
disagree, it says which is better supported and why. **It speaks as one mind**:
never "Voice 1 said," never a reference to the merge. The result reads as if it
were the answer all along.

## Why frontier

Merging well is harder than answering. Holding several positions in mind and
fusing them without losing the sharp edges is frontier work.

## In the modes

- **swarm / swarm-of-swarms** — fires when the voices diverge past a threshold,
  turning a cluster of candidates into one written answer.
- **debate** — writes up what survived the rounds.
