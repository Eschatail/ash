/**
 * @module providers/provider
 *
 * The base class every vendor adapter extends, plus the small fetch helpers
 * they share. Zero dependencies: this is native `fetch`, `AbortController`,
 * and `TextDecoder` only.
 *
 * A provider is a connected mind. The hive does not care which vendor it is,
 * only that it can {@link chat}. Each adapter teaches the hive one more dialect.
 */

import type { ChatOptions, Message, ModelNode, Provider, ProviderId } from "../core/types.js";

/** Thrown when a provider call fails in a way worth surfacing. */
export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(`[${provider}] ${message}`, options);
    this.name = "ProviderError";
  }
}

/** Read an env var, trimming whitespace; empty → undefined. */
export function env(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Default per-request timeout, generous enough for frontier reasoning. */
export const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * A `fetch` wrapper with timeout, JSON parsing, and uniform error handling.
 * Honors a caller `signal` while still enforcing the timeout.
 */
export async function postJson<T>(
  provider: ProviderId,
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onAbort = (): void => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(provider, `HTTP ${res.status} ${res.statusText} ${truncate(text)}`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(provider, errMessage(err), undefined, { cause: err });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

/**
 * POST and stream a Server-Sent-Events body, yielding raw `data:` payloads as
 * strings (still JSON-encoded — the caller parses the vendor shape). Used by
 * adapters that support streaming.
 */
export async function* postSse(
  provider: ProviderId,
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): AsyncIterable<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onAbort = (): void => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream", ...headers },
      body: JSON.stringify({ ...(body as object), stream: true }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(provider, `HTTP ${res.status} ${res.statusText} ${truncate(text)}`, res.status);
    }
    const decoder = new TextDecoder();
    let buffer = "";
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || line.startsWith(":")) continue;
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          yield payload;
        }
      }
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(provider, errMessage(err), undefined, { cause: err });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

/** Split messages into a single leading system string + the rest. */
export function splitSystem(messages: readonly Message[]): {
  system: string | undefined;
  rest: Message[];
} {
  const systems = messages.filter((m) => m.role === "system").map((m) => m.content);
  const rest = messages.filter((m) => m.role !== "system");
  return { system: systems.length ? systems.join("\n\n") : undefined, rest };
}

function truncate(s: string, n = 240): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Shared base for vendor adapters. Subclasses declare their nodes and implement
 * {@link doChat}. The base supplies `available`, `nodes`, and node selection.
 */
export abstract class BaseProvider implements Provider {
  abstract readonly id: ProviderId;
  abstract readonly label: string;
  abstract readonly nodes: readonly ModelNode[];

  /** Whether the provider has what it needs (usually an API key). */
  get available(): boolean {
    return true;
  }

  /** Pick the model id for a request: explicit override → preferred node. */
  protected resolveModel(opts?: ChatOptions): string {
    if (opts?.model) return opts.model;
    const node = this.nodes[0];
    if (!node) throw new ProviderError(this.id, "no model nodes declared");
    return node.model;
  }

  abstract chat(messages: readonly Message[], opts?: ChatOptions): Promise<string>;
}
