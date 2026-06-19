/**
 * @module providers/groq
 *
 * Adapter for Groq (LPU inference), OpenAI-compatible.
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 * Key: process.env.GROQ_API_KEY
 *
 * Groq is the fast twitch of the hive — open-weight models at unreasonable speed.
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class GroqProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: env("GROQ_API_KEY"),
      nodes: [
        { provider: "groq", model: "llama-3.3-70b-versatile", tier: "balanced", context: 131_072 },
        { provider: "groq", model: "llama-3.1-8b-instant", tier: "fast", context: 131_072 },
        { provider: "groq", model: "moonshotai/kimi-k2-instruct", tier: "frontier", context: 131_072 },
      ],
    });
  }
}
