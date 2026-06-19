# ⊕ The Architect

> Turns problems into plans. Structure before solution.

| | |
| --- | --- |
| **Role name** | `architect` |
| **Tier** | `frontier` |
| **Temperature** | 0.4 (low — plans want to be stable) |
| **Code** | [`hive/src/agents/architect.ts`](../hive/src/agents/architect.ts) |

## Charter

The Architect does not solve. It makes a problem solvable. For any task it
returns the goal in one sentence with its real constraints named, a decomposition
into the fewest independent parts that cover it, a sequence with the one
load-bearing step marked, and a crisp definition of "done" the others can check
against. It prefers a short plan that survives contact over a long one that does
not.

## Why frontier

A bad plan costs more than a slow one. Everything downstream inherits the
Architect's framing, so it draws on the strongest reasoning node available and
runs cool to keep the structure stable across asks.

## Calibration

Rewards explicit structure — numbered steps, named constraints. A plan that does
not commit to an order is barely a plan.

## In the modes

- **debate** — the proposing voice. It states the answer the Skeptic then attacks,
  and it revises to survive the attack.
- **swarm / swarm-of-swarms** — one voice among many; its structure often anchors
  the consensus cluster.
