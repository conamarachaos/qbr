import {
  generateObject,
  type GenerateObjectResult,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import { ZodError, type ZodType } from "zod";

import { GROUNDING_SYSTEM_PROMPT } from "@/prompts/system";

export type GenerateObjectLike = typeof generateObject;

export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StageRunMetadata {
  attempts: number;
  modelId: string;
  usage: TokenTotals;
}

export interface StageRunResult<T> extends StageRunMetadata {
  data: T;
}

export interface RunStructuredStageArgs<T> {
  stageName: string;
  schemaName: string;
  schema: ZodType<T>;
  model: LanguageModel;
  prompt: string;
  generateObjectImpl?: GenerateObjectLike;
  validate?: (result: T) => void;
  maxValidationRetries?: number;
}

export interface StageProgressEvent {
  stage: string;
  status: "running" | "completed" | "failed";
  message?: string;
  attempts?: number;
  usage?: TokenTotals;
}

function toTokenTotals(usage: LanguageModelUsage): TokenTotals {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
  };
}

const RATE_LIMIT_BASE_DELAY_MS = 8_000;
const RATE_LIMIT_MAX_DELAY_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Anthropic 429s surface as APICallError with statusCode 429 and (usually) a
 * `retry-after` header in seconds. Returns the delay to wait in ms, or null if
 * the error is not a rate-limit error.
 */
function rateLimitDelayMs(error: unknown, attempt: number): number | null {
  const status =
    (error as { statusCode?: number; status?: number })?.statusCode ??
    (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);
  const isRateLimit = status === 429 || /rate limit|429|too many requests/i.test(message);

  if (!isRateLimit) {
    return null;
  }

  const headers =
    (error as { responseHeaders?: Record<string, string>; headers?: Record<string, string> })
      ?.responseHeaders ??
    (error as { headers?: Record<string, string> })?.headers;
  const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1_000 : NaN;

  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, RATE_LIMIT_MAX_DELAY_MS);
  }

  // Exponential backoff: 8s, 16s, 32s … capped.
  return Math.min(RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt, RATE_LIMIT_MAX_DELAY_MS);
}

function formatError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function modelIdFromModel(model: LanguageModel) {
  if (typeof model === "string") {
    return model;
  }

  if ("modelId" in model && typeof model.modelId === "string") {
    return model.modelId;
  }

  return "unknown-model";
}

export async function runStructuredStage<T>({
  stageName,
  schemaName,
  schema,
  model,
  prompt,
  generateObjectImpl = generateObject,
  validate,
  maxValidationRetries = 2,
}: RunStructuredStageArgs<T>): Promise<StageRunResult<T>> {
  let attempt = 0;
  let previousError = "";
  let rateLimitWaits = 0;
  const maxRateLimitWaits = 6;

  while (attempt <= maxValidationRetries) {
    const promptWithRetry = previousError
      ? `${prompt}\n\nValidation error from the previous attempt:\n${previousError}\n\nReturn a corrected object that satisfies the schema exactly and remains fully grounded in the sources.`
      : prompt;

    try {
      const result = (await generateObjectImpl({
        model,
        system: GROUNDING_SYSTEM_PROMPT,
        prompt: promptWithRetry,
        schema,
        schemaName,
        temperature: 0,
        maxRetries: 0,
      })) as GenerateObjectResult<T>;

      const parsed = schema.parse(result.object);
      validate?.(parsed);

      return {
        data: parsed,
        attempts: attempt + 1,
        modelId: modelIdFromModel(model),
        usage: toTokenTotals(result.usage),
      };
    } catch (error) {
      // Rate-limit (429) errors are transient: wait out the window and retry
      // the same attempt without consuming a validation retry.
      const delayMs = rateLimitDelayMs(error, rateLimitWaits);
      if (delayMs !== null && rateLimitWaits < maxRateLimitWaits) {
        rateLimitWaits += 1;
        await sleep(delayMs);
        continue;
      }

      previousError = formatError(error);

      if (attempt === maxValidationRetries) {
        throw new Error(`${stageName} failed after ${attempt + 1} attempts: ${previousError}`);
      }
    }

    attempt += 1;
  }

  throw new Error(`${stageName} failed unexpectedly.`);
}

export function addUsage(total: TokenTotals, next: TokenTotals): TokenTotals {
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    totalTokens: total.totalTokens + next.totalTokens,
  };
}

export function emptyUsage(): TokenTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}
