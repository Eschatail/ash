/**
 * @module providers/together
 *
 * Adapter for Together AI, OpenAI-compatible — a wide field of open-weight models
 * behind one door.
 * Endpoint: https://api.together.xyz/v1/chat/completions
 * Key: process.env.TOGETHER_API_KEY
 *
 * Together is breadth: many open minds the hive can draw on at once. Diversity is
 * strength here — feeding the swarm voices it could not otherwise hear.
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class TogetherProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "together",
      label: "Together AI",
      baseUrl: "https://api.together.xyz/v1",
      apiKey: env("TOGETHER_API_KEY"),
      nodes: [
        {
          provider: "together",
          model: "deepseek-ai/DeepSeek-R1",
          tier: "frontier",
          context: 128_000,
        },
        {
          provider: "together",
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          tier: "balanced",
          context: 131_072,
        },
        {
          provider: "together",
          model: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
          tier: "fast",
          context: 131_072,
        },
      ],
    });
  }
}
