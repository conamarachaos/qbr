import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

type ModelRole = "extraction" | "narrative" | "routing";

const DEFAULT_MODELS: Record<ModelRole, string> = {
  extraction: "claude-sonnet-4-6",
  narrative: "claude-opus-4-8",
  // Routing is a cheap, high-volume classification step (which account is this
  // file?) — use the fast model so analyzing a big upload batch stays snappy.
  routing: "claude-haiku-4-5-20251001",
};

// Some environments export ANTHROPIC_BASE_URL without the required `/v1` suffix
// (e.g. `https://api.anthropic.com`). The provider appends `/messages`, so a
// missing `/v1` makes every request 404. Normalize it so the pipeline works
// regardless; an unset value falls back to the SDK default.
function resolveAnthropicBaseURL(): string | undefined {
  const raw = process.env.ANTHROPIC_BASE_URL?.trim();
  if (!raw) {
    return undefined;
  }
  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  return /\/v\d+$/.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/v1`;
}

const baseURL = resolveAnthropicBaseURL();
const anthropic = createAnthropic(baseURL ? { baseURL } : {});

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run the QBR Agent pipeline.`);
  }
  return value;
}

function resolveModel(modelId: string): LanguageModel {
  if (modelId.startsWith("anthropic:")) {
    return anthropic(modelId.replace("anthropic:", ""));
  }

  if (modelId.startsWith("claude")) {
    requireEnv("ANTHROPIC_API_KEY");
    return anthropic(modelId);
  }

  throw new Error(
    `Unsupported model "${modelId}". Use an Anthropic model id such as claude-sonnet-4-6 or anthropic:claude-sonnet-4-6.`,
  );
}

export function getModelId(role: ModelRole) {
  if (role === "extraction") {
    return process.env.EXTRACTION_MODEL || DEFAULT_MODELS.extraction;
  }

  if (role === "routing") {
    return process.env.ROUTING_MODEL || DEFAULT_MODELS.routing;
  }

  return process.env.NARRATIVE_MODEL || DEFAULT_MODELS.narrative;
}

export function getExtractionModel() {
  return resolveModel(getModelId("extraction"));
}

export function getNarrativeModel() {
  return resolveModel(getModelId("narrative"));
}

export function getRoutingModel() {
  return resolveModel(getModelId("routing"));
}

export function getModelSummary() {
  return {
    extractionModel: getModelId("extraction"),
    narrativeModel: getModelId("narrative"),
    routingModel: getModelId("routing"),
  };
}
