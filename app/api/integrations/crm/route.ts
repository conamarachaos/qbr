import { getCrmAdapter } from "@/lib/integrations/crm";
import { IntegrationBriefPayloadSchema } from "@/lib/integrations/shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const brief = IntegrationBriefPayloadSchema.parse(await request.json());
  const adapter = getCrmAdapter();
  const result = await adapter.upsertAccountBrief(brief);

  return Response.json({
    provider: "mock",
    ...result,
  });
}
