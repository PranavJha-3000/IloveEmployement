// ─── AI Provider Types ───────────────────────────────────────────────────────

export type ProviderId =
  | "openai"
  | "google"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "together"
  | "xai"
  | "custom";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseUrl?: string;
  defaultModel: string;
  models: string[];
  docsUrl: string;
  keyPrefix?: string;
}

export interface AiRequestConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}
