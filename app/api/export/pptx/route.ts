import { z } from "zod";

import { buildBriefDeck } from "@/lib/deck";
import {
  BriefSchema,
  GapSchema,
  GoalSchema,
  OpportunitySchema,
  UsageItemSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

const ExportPayloadSchema = z.object({
  brief: BriefSchema,
  goals: z.array(GoalSchema),
  usage: z.array(UsageItemSchema),
  gaps: z.array(GapSchema),
  opportunities: z.array(OpportunitySchema),
});

export async function POST(request: Request) {
  const payload = ExportPayloadSchema.parse(await request.json());
  const buffer = await buildBriefDeck(payload);
  const safeName = payload.brief.accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${safeName || "qbr-brief"}.pptx"`,
    },
  });
}
