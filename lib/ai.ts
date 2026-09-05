import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV1 } from "ai";
import type { AiRequestConfig, ProviderId } from "./types";
import { PROVIDERS } from "./providers";

/**
 * Given user-supplied provider config, return the correct AI SDK model instance.
 * This runs server-side only — the API key is used transiently and never stored.
 */
export function createModel(config: AiRequestConfig): LanguageModelV1 {
  const { provider, apiKey, model, baseUrl } = config;

  if (!apiKey?.trim()) {
    throw new Error("API key is required. This is a bring-your-own-key app — we don't store keys.");
  }

  switch (provider as ProviderId) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model || PROVIDERS.openai.defaultModel);
    }

    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model || PROVIDERS.google.defaultModel);
    }

    case "openrouter": {
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: baseUrl || PROVIDERS.openrouter.baseUrl!,
        apiKey,
      });
      return openrouter.chatModel(model || PROVIDERS.openrouter.defaultModel);
    }

    case "groq": {
      const groq = createOpenAICompatible({
        name: "groq",
        baseURL: baseUrl || PROVIDERS.groq.baseUrl!,
        apiKey,
      });
      return groq.chatModel(model || PROVIDERS.groq.defaultModel);
    }

    case "deepseek": {
      const deepseek = createOpenAICompatible({
        name: "deepseek",
        baseURL: baseUrl || PROVIDERS.deepseek.baseUrl!,
        apiKey,
      });
      return deepseek.chatModel(model || PROVIDERS.deepseek.defaultModel);
    }

    case "mistral": {
      const mistral = createOpenAICompatible({
        name: "mistral",
        baseURL: baseUrl || PROVIDERS.mistral.baseUrl!,
        apiKey,
      });
      return mistral.chatModel(model || PROVIDERS.mistral.defaultModel);
    }

    case "together": {
      const together = createOpenAICompatible({
        name: "together",
        baseURL: baseUrl || PROVIDERS.together.baseUrl!,
        apiKey,
      });
      return together.chatModel(model || PROVIDERS.together.defaultModel);
    }

    case "xai": {
      const xai = createOpenAICompatible({
        name: "xai",
        baseURL: baseUrl || PROVIDERS.xai.baseUrl!,
        apiKey,
      });
      return xai.chatModel(model || PROVIDERS.xai.defaultModel);
    }

    case "custom": {
      if (!baseUrl?.trim()) {
        throw new Error("Custom provider requires a base URL (e.g. https://api.example.com/v1)");
      }
      const custom = createOpenAICompatible({
        name: "custom",
        baseURL: baseUrl,
        apiKey,
      });
      return custom.chatModel(model);
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
