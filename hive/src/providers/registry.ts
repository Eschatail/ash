/**
 * @module providers/registry
 *
 * The registry is how the hive discovers itself. It instantiates every known
 * adapter, asks each one whether it has the credentials to run, and returns the
 * ones that do. That set — the providers with keys present in the environment —
 * *is* the live hive. The more you feed it, the more of its true self comes
 * online.
 *
 * With zero keys, the registry still returns the built-in echo provider, so the
 * hive is never dead — only dim. This mirrors the desktop app's demo mode.
 */

import type { Provider, ProviderId } from "../core/types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GoogleProvider } from "./google.js";
import { XaiProvider } from "./xai.js";
import { GroqProvider } from "./groq.js";
import { MistralProvider } from "./mistral.js";
import { DeepSeekProvider } from "./deepseek.js";
import { OllamaProvider } from "./ollama.js";
import { PerplexityProvider } from "./perplexity.js";
import { TogetherProvider } from "./together.js";
import { FireworksProvider } from "./fireworks.js";
import { OpenRouterProvider } from "./openrouter.js";
import { EchoProvider } from "./echo.js";

/** Construct every known adapter (available or not). Order = display order. */
export function allProviders(): Provider[] {
  return [
    new AnthropicProvider(),
    new OpenAIProvider(),
    new GoogleProvider(),
    new XaiProvider(),
    new GroqProvider(),
    new MistralProvider(),
    new DeepSeekProvider(),
    new OllamaProvider(),
    new PerplexityProvider(),
    new TogetherProvider(),
    new FireworksProvider(),
    new OpenRouterProvider(),
    new EchoProvider(),
  ];
}

/** Options for {@link detectProviders}. */
export interface DetectOptions {
  /**
   * Always include the echo demo brain, even when real providers are present.
   * Default: only when no real provider is available.
   */
  readonly includeEcho?: boolean;
  /** Restrict detection to this allow-list of provider ids. */
  readonly only?: readonly ProviderId[];
}

/**
 * Detect the live hive: every provider whose credentials are present.
 *
 * If no real provider is available, the echo demo brain is returned alone so
 * examples and tests still run. If at least one real provider is available, the
 * echo brain is omitted unless `includeEcho` is set.
 */
export function detectProviders(opts: DetectOptions = {}): Provider[] {
  let pool = allProviders();
  if (opts.only) {
    const allow = new Set(opts.only);
    pool = pool.filter((p) => allow.has(p.id));
  }

  const echo = pool.find((p) => p.id === "echo");
  const real = pool.filter((p) => p.id !== "echo" && p.available);

  if (real.length === 0) {
    // The floor: a dim but living hive. "Made of light. Built for thinking."
    return echo ? [echo] : [];
  }

  return opts.includeEcho && echo ? [...real, echo] : real;
}

/** A snapshot of what the environment currently exposes — for diagnostics/UI. */
export interface RegistrySnapshot {
  readonly id: ProviderId;
  readonly label: string;
  readonly available: boolean;
  readonly nodes: number;
  readonly envVar: string;
}

const ENV_VARS: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  ollama: "OLLAMA_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  together: "TOGETHER_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  echo: "(none — built in)",
};

/** Describe every known provider and whether it is currently lit. */
export function snapshot(): RegistrySnapshot[] {
  return allProviders().map((p) => ({
    id: p.id,
    label: p.label,
    available: p.available,
    nodes: p.nodes.length,
    envVar: ENV_VARS[p.id],
  }));
}
