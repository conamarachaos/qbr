import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

type ModelRole = "extraction" | "narrative";

const DEFAULT_MODELS: Record<ModelRole, string> = {
  extraction: "claude-sonnet-4-6",
  narrative: "claude-opus-4-8",
};

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

  return process.env.NARRATIVE_MODEL || DEFAULT_MODELS.narrative;
}

export function getExtractionModel() {
  return resolveModel(getModelId("extraction"));
}

export function getNarrativeModel() {
  return resolveModel(getModelId("narrative"));
}

export function getModelSummary() {
  return {
    extractionModel: getModelId("extraction"),
    narrativeModel: getModelId("narrative"),
  };
}
