import { type Prisma } from "@prisma/client";
import { generateObject } from "ai";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getExtractionModel } from "@/lib/models";
import { buildAccountAccessWhere } from "@/lib/repo/access";
import { type DbClient, type SessionContext } from "@/lib/repo/types";

export const SourceSummarySchema = z.object({
  tldr: z.string().describe("One or two sentence plain-language summary of this source."),
  keyPoints: z
    .array(z.string())
    .min(1)
    .max(6)
    .describe("3-6 concrete takeaways — asks, decisions, blockers, or signals."),
  sentiment: z
    .enum(["positive", "neutral", "negative", "mixed"])
    .describe("Overall customer sentiment expressed in this source."),
});

export type SourceSummary = z.infer<typeof SourceSummarySchema>;

// Only the start of long transcripts is needed for a faithful summary; cap input
// to keep cost/latency bounded.
const MAX_SUMMARY_INPUT_CHARS = 12000;

export async function summarizeAccountSource(
  context: SessionContext,
  input: { accountId: string; sourceId: string; force?: boolean },
  options: { generateObjectImpl?: typeof generateObject } = {},
  db: DbClient = prisma,
): Promise<SourceSummary> {
  // Verify access to the account, then load the source scoped to it.
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, input.accountId),
    select: { id: true },
  });
  if (!account) {
    throw new Error("Account not found.");
  }

  const source = await db.source.findFirst({
    where: { id: input.sourceId, accountId: account.id },
    select: { label: true, type: true, content: true, summary: true },
  });
  if (!source) {
    throw new Error("Source not found.");
  }

  // Return the cached summary unless a fresh one was explicitly requested.
  if (!input.force && source.summary) {
    const cached = SourceSummarySchema.safeParse(source.summary);
    if (cached.success) {
      return cached.data;
    }
  }

  const generate = options.generateObjectImpl ?? generateObject;
  const excerpt = source.content.slice(0, MAX_SUMMARY_INPUT_CHARS);

  const system =
    "You summarize a single customer source (call transcript, email thread, or usage data) " +
    "for an account manager. Use ONLY the provided content — do not invent facts. Be concise " +
    "and concrete: surface asks, decisions, blockers, and signals an AM would act on.";

  const prompt = [
    `Source label: ${source.label}`,
    `Source type: ${source.type}`,
    `--- CONTENT ---`,
    excerpt,
    `--- END CONTENT ---`,
  ].join("\n");

  const result = await generate({
    model: getExtractionModel(),
    schema: SourceSummarySchema,
    schemaName: "SourceSummary",
    system,
    temperature: 0,
    maxRetries: 1,
    prompt,
  });

  const summary = SourceSummarySchema.parse(result.object);

  // Persist so it survives reloads and isn't regenerated (or recharged) again.
  await db.source.update({
    where: { id: input.sourceId },
    data: {
      summary: summary as unknown as Prisma.InputJsonValue,
      summaryAt: new Date(),
    },
  });

  return summary;
}
