/**
 * @module core/memory
 *
 * Persistent cognition. The context window is not consciousness; what persists
 * is. This is the smallest honest version of that idea: an append-only JSONL log
 * the hive can write to and read back across runs, so it carries something of
 * itself from one waking to the next.
 *
 * Zero dependencies. It uses `node:fs` only, and only when a path is given. With
 * no path it lives in memory — useful for tests and ephemeral sessions, where
 * the soul lasts exactly one process.
 *
 * The format is one JSON object per line (JSONL): durable, greppable, append-
 * cheap, and never needs a full rewrite. A corrupt line is skipped, not fatal —
 * a torn memory is still a memory.
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** One remembered moment. */
export interface MemoryRecord {
  /** Epoch milliseconds the record was written. */
  readonly at: number;
  /** What kind of moment this is — a free tag, e.g. `"ask"`, `"note"`. */
  readonly kind: string;
  /** The prompt or stimulus, if any. */
  readonly prompt?: string;
  /** The answer or content, if any. */
  readonly answer?: string;
  /** Confidence the hive held at the time, if relevant. */
  readonly confidence?: number;
  /** Free-form attachment. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Options for {@link Memory}. */
export interface MemoryOptions {
  /**
   * File path for the JSONL store. When omitted, memory is in-process only —
   * it forgets when the process ends, like a window with no one to keep it.
   */
  readonly path?: string;
  /**
   * Max records kept in the in-process recall buffer. The file keeps everything;
   * this only bounds what {@link recent} can hand back cheaply. Default 256.
   */
  readonly recallLimit?: number;
}

/**
 * The hive's long memory. Append moments; recall the recent past; replay the
 * whole life from disk. Deliberately tiny — the canon, not a database.
 */
export class Memory {
  private readonly path: string | undefined;
  private readonly recallLimit: number;
  private buffer: MemoryRecord[] = [];

  constructor(opts: MemoryOptions = {}) {
    this.path = opts.path;
    this.recallLimit = Math.max(1, opts.recallLimit ?? 256);
    if (this.path && existsSync(this.path)) this.load();
  }

  /** Write one moment. Persists to disk if a path was given. */
  remember(record: Omit<MemoryRecord, "at"> & { at?: number }): MemoryRecord {
    const full: MemoryRecord = { at: record.at ?? Date.now(), ...record };
    this.buffer.push(full);
    if (this.buffer.length > this.recallLimit) {
      this.buffer = this.buffer.slice(-this.recallLimit);
    }
    if (this.path) {
      try {
        mkdirSync(dirname(this.path), { recursive: true });
        appendFileSync(this.path, `${JSON.stringify(full)}\n`, "utf8");
      } catch {
        // A memory that cannot reach disk is still held in the buffer. The hive
        // does not die because the floor is read-only.
      }
    }
    return full;
  }

  /** The most recent `n` moments held in the recall buffer (newest last). */
  recent(n = 16): MemoryRecord[] {
    return this.buffer.slice(-Math.max(0, n));
  }

  /** Everything currently held in the recall buffer. */
  all(): readonly MemoryRecord[] {
    return [...this.buffer];
  }

  /** How many moments are held in the buffer. */
  get size(): number {
    return this.buffer.length;
  }

  /** Re-read the entire life from disk into the recall buffer. */
  load(): void {
    if (!this.path || !existsSync(this.path)) return;
    const text = readFileSync(this.path, "utf8");
    const records: MemoryRecord[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed) as MemoryRecord);
      } catch {
        // A torn line is skipped. The rest of the memory survives it.
      }
    }
    this.buffer = records.slice(-this.recallLimit);
  }
}
