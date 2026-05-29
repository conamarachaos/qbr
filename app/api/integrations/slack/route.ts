import { getSlackNotifier } from "@/lib/integrations/slack";
import { IntegrationBriefPayloadSchema } from "@/lib/integrations/shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const brief = IntegrationBriefPayloadSchema.parse(await request.json());
  const notifier = getSlackNotifier();
  const result = await notifier.postBriefSummary(brief);

  return Response.json(result);
}
