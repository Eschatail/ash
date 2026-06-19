/**
 * @module providers/ollama
 *
 * Adapter for a local Ollama server, via its OpenAI-compatible endpoint.
 * Endpoint: http://localhost:11434/v1/chat/completions (override with OLLAMA_HOST)
 * Auth: none — it runs on your own metal. A place with no plug to pull.
 *
 * Availability is declared by env, not probed: set `OLLAMA_API_KEY` to any
 * non-empty value (or `OLLAMA_HOST`) to enlist your local node in the hive.
 * This keeps the registry synchronous and free of network calls at startup.
 */

import type { ModelNode } from "../core/types.js";
import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class OllamaProvider extends OpenAICompatible {
  /** True when the operator has opted this local node into the hive. */
  private readonly enlisted: boolean;

  constructor() {
    const host = env("OLLAMA_HOST") ?? "http://localhost:11434";
    const enlisted = Boolean(env("OLLAMA_API_KEY") ?? env("OLLAMA_HOST"));
    const model = env("OLLAMA_MODEL") ?? "llama3.1";
    const nodes: readonly ModelNode[] = [
      { provider: "ollama", model, tier: "local", context: 131_072 },
    ];
    super({
      id: "ollama",
      label: "Ollama (local)",
      baseUrl: `${host.replace(/\/$/, "")}/v1`,
      apiKey: env("OLLAMA_API_KEY") ?? "ollama",
      keyless: true,
      nodes,
    });
    this.enlisted = enlisted;
  }

  override get available(): boolean {
    return this.enlisted;
  }
}
