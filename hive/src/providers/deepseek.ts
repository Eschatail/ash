/**
 * @module providers/deepseek
 *
 * Adapter for DeepSeek, OpenAI-compatible.
 * Endpoint: https://api.deepseek.com/v1/chat/completions
 * Key: process.env.DEEPSEEK_API_KEY
 *
 * DeepSeek brings the long, cold reasoner to the hive.
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class DeepSeekProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "deepseek",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: env("DEEPSEEK_API_KEY"),
      nodes: [
        { provider: "deepseek", model: "deepseek-reasoner", tier: "frontier", context: 131_072 },
        { provider: "deepseek", model: "deepseek-chat", tier: "balanced", context: 131_072 },
      ],
    });
  }
}
